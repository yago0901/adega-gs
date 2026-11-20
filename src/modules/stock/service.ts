import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { openCommercialPackagingInTransaction } from "@/modules/stock/open-commercial-packaging";
import { openStockBottleInTransaction } from "@/modules/stock/open-stock-bottle";

function getText(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

function getQuantity(formData: FormData, allowZero = false) {
  const raw = getText(formData, "quantity").replace(",", ".");
  const quantity = Number(raw);

  if (
    !Number.isSafeInteger(quantity) ||
    (allowZero ? quantity < 0 : quantity <= 0)
  ) {
    throw new Error("Informe uma quantidade inteira válida.");
  }

  return new Prisma.Decimal(String(quantity));
}

function getReason(formData: FormData) {
  const reason = getText(formData, "reason");

  if (reason.length < 3) {
    throw new Error("Informe uma justificativa.");
  }

  return reason;
}

type StockMutationProduct = NonNullable<
  Awaited<ReturnType<typeof fetchStockMutationProduct>>
>;

async function fetchStockMutationProduct(productId: string) {
  return prisma.product.findFirst({
    where: {
      id: productId,
      active: true,
    },
    include: {
      stockItem: {
        include: {
          balance: true,
        },
      },
      stockPackaging: {
        include: {
          balance: true,
        },
      },
      packagingChildProduct: true,
    },
  });
}

function resolveStockTarget(
  formData: FormData,
  product: StockMutationProduct,
): "PACKAGING" | "OPEN" {
  if (product.packagingChildProduct) {
    return "OPEN";
  }

  if (!product.stockPackaging) {
    return "OPEN";
  }

  if (product.stockItem!.unit !== "ML") {
    return "PACKAGING";
  }

  const raw = getText(formData, "stockTarget");
  return raw === "OPEN" ? "OPEN" : "PACKAGING";
}

function usesPackagingBalance(
  product: StockMutationProduct,
  target: "PACKAGING" | "OPEN",
) {
  return Boolean(product.stockPackaging) && target === "PACKAGING";
}

async function getProduct(productId: string, formData: FormData) {
  const product = await fetchStockMutationProduct(productId);

  if (!product) {
    throw new Error("Produto não encontrado ou inativo.");
  }

  if (!product.stockItem) {
    throw new Error(
      "Este produto não possui vínculo direto com um item de estoque. Movimente o ingrediente correspondente.",
    );
  }

  const target = resolveStockTarget(formData, product);

  if (usesPackagingBalance(product, target) && !product.stockPackaging!.balance) {
    throw new Error("Saldo da embalagem não encontrado.");
  }

  if (!usesPackagingBalance(product, target) && !product.stockItem.balance) {
    throw new Error("Saldo do item de estoque não encontrado.");
  }

  return { product, target };
}

export async function registerStockEntryRecord(
  formData: FormData,
  userId: string,
) {
  const productId = getText(formData, "productId");
  const quantity = getQuantity(formData);
  const reason = getReason(formData);

  const { product, target } = await getProduct(productId, formData);

  await prisma.$transaction(async (tx) => {
    if (usesPackagingBalance(product, target)) {
      const packaging = product.stockPackaging!;
      const result = await tx.stockPackagingBalance.updateMany({
        where: {
          stockPackagingId: packaging.id,
        },
        data: {
          quantity: {
            increment: quantity,
          },
        },
      });

      if (result.count !== 1) {
        throw new Error("Saldo da embalagem não encontrado.");
      }

      await tx.stockMovement.create({
        data: {
          type: "PURCHASE",
          quantity,
          unit: "UNIT",
          reason,
          stockItemId: product.stockItem!.id,
          stockPackagingId: packaging.id,
          userId,
        },
      });
    } else {
      const result = await tx.stockBalance.updateMany({
        where: {
          stockItemId: product.stockItem!.id,
        },
        data: {
          quantity: {
            increment: quantity,
          },
        },
      });

      if (result.count !== 1) {
        throw new Error("Saldo do item de estoque não encontrado.");
      }

      await tx.stockMovement.create({
        data: {
          type: "PURCHASE",
          quantity,
          unit: product.stockItem!.unit,
          reason,
          stockItemId: product.stockItem!.id,
          userId,
        },
      });
    }
  });
}

export async function registerStockLossRecord(
  formData: FormData,
  userId: string,
) {
  const productId = getText(formData, "productId");
  const quantity = getQuantity(formData);
  const reason = getReason(formData);

  const { product, target } = await getProduct(productId, formData);

  await prisma.$transaction(async (tx) => {
    if (usesPackagingBalance(product, target)) {
      const packaging = product.stockPackaging!;
      const result = await tx.stockPackagingBalance.updateMany({
        where: {
          stockPackagingId: packaging.id,
          quantity: {
            gte: quantity,
          },
        },
        data: {
          quantity: {
            decrement: quantity,
          },
        },
      });

      if (result.count !== 1) {
        throw new Error(`Estoque insuficiente de ${product.name}.`);
      }

      await tx.stockMovement.create({
        data: {
          type: "LOSS",
          quantity: quantity.negated(),
          unit: "UNIT",
          reason,
          stockItemId: product.stockItem!.id,
          stockPackagingId: packaging.id,
          userId,
        },
      });
    } else {
      const result = await tx.stockBalance.updateMany({
        where: {
          stockItemId: product.stockItem!.id,
          quantity: {
            gte: quantity,
          },
        },
        data: {
          quantity: {
            decrement: quantity,
          },
        },
      });

      if (result.count !== 1) {
        throw new Error(
          `Estoque insuficiente de ${product.stockItem!.name}.`,
        );
      }

      await tx.stockMovement.create({
        data: {
          type: "LOSS",
          quantity: quantity.negated(),
          unit: product.stockItem!.unit,
          reason,
          stockItemId: product.stockItem!.id,
          userId,
        },
      });
    }
  });
}

export async function registerStockAdjustmentRecord(
  formData: FormData,
  userId: string,
) {
  const productId = getText(formData, "productId");
  const newQuantity = getQuantity(formData, true);
  const reason = getReason(formData);

  const { product, target } = await getProduct(productId, formData);

  await prisma.$transaction(async (tx) => {
    if (usesPackagingBalance(product, target)) {
      const packaging = product.stockPackaging!;
      const balance = await tx.stockPackagingBalance.findUnique({
        where: {
          stockPackagingId: packaging.id,
        },
      });

      if (!balance) {
        throw new Error("Saldo da embalagem não encontrado.");
      }

      const difference = newQuantity.minus(balance.quantity);

      if (difference.equals(0)) {
        throw new Error("A quantidade informada já é o saldo atual.");
      }

      const result = await tx.stockPackagingBalance.updateMany({
        where: {
          stockPackagingId: packaging.id,
          quantity: balance.quantity,
        },
        data: {
          quantity: newQuantity,
        },
      });

      if (result.count !== 1) {
        throw new Error(
          "O estoque foi alterado por outra operação. Atualize a página e tente novamente.",
        );
      }

      await tx.stockMovement.create({
        data: {
          type: "ADJUSTMENT",
          quantity: difference,
          unit: "UNIT",
          reason,
          stockItemId: product.stockItem!.id,
          stockPackagingId: packaging.id,
          userId,
        },
      });
    } else {
      const balance = await tx.stockBalance.findUnique({
        where: {
          stockItemId: product.stockItem!.id,
        },
      });

      if (!balance) {
        throw new Error("Saldo do item de estoque não encontrado.");
      }

      const difference = newQuantity.minus(balance.quantity);

      if (difference.equals(0)) {
        throw new Error("A quantidade informada já é o saldo atual.");
      }

      const result = await tx.stockBalance.updateMany({
        where: {
          stockItemId: product.stockItem!.id,
          quantity: balance.quantity,
        },
        data: {
          quantity: newQuantity,
        },
      });

      if (result.count !== 1) {
        throw new Error(
          "O estoque foi alterado por outra operação. Atualize a página e tente novamente.",
        );
      }

      await tx.stockMovement.create({
        data: {
          type: "ADJUSTMENT",
          quantity: difference,
          unit: product.stockItem!.unit,
          reason,
          stockItemId: product.stockItem!.id,
          userId,
        },
      });
    }
  });
}

export async function openCommercialPackagingRecord(
  formData: FormData,
  userId: string,
) {
  const productId = getText(formData, "productId");
  const rawQuantity = getText(formData, "quantity");
  const quantityNumber = Number(rawQuantity);

  if (!productId) {
    throw new Error("Produto não informado.");
  }

  if (
    !Number.isSafeInteger(quantityNumber) ||
    quantityNumber <= 0 ||
    quantityNumber > 10000
  ) {
    throw new Error("Informe uma quantidade válida de embalagens.");
  }

  const quantity = new Prisma.Decimal(quantityNumber);

  await prisma.$transaction(async (tx) => {
    await openCommercialPackagingInTransaction(
      tx,
      productId,
      quantity,
      userId,
    );
  });
}

export async function openStockBottleRecord(formData: FormData, userId: string) {
  const productId = getText(formData, "productId");
  const rawQuantity = getText(formData, "quantity");
  const quantityNumber = Number(rawQuantity);

  if (!productId) {
    throw new Error("Produto não informado.");
  }

  if (
    !Number.isSafeInteger(quantityNumber) ||
    quantityNumber <= 0 ||
    quantityNumber > 10000
  ) {
    throw new Error("Informe uma quantidade válida de garrafas.");
  }

  const quantity = new Prisma.Decimal(quantityNumber);

  await prisma.$transaction(async (tx) => {
    await openStockBottleInTransaction(tx, productId, quantity, userId);
  });
}