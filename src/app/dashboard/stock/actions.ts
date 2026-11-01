
"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";

function getText(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

function getQuantity(formData: FormData, allowZero = false) {
  const raw = getText(formData, "quantity").replace(",", ".");
  const quantity = Number(raw);

  if (
    !Number.isFinite(quantity) ||
    (allowZero ? quantity < 0 : quantity <= 0)
  ) {
    throw new Error(
      allowZero
        ? "Informe uma quantidade igual ou maior que zero."
        : "Informe uma quantidade maior que zero.",
    );
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

async function getProduct(productId: string) {
  const product = await prisma.product.findFirst({
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
    },
  });

  if (!product) {
    throw new Error("Produto não encontrado ou inativo.");
  }

  if (!product.stockItem) {
    throw new Error(
      "Este produto não possui vínculo direto com um item de estoque. Movimente o ingrediente correspondente.",
    );
  }

  if (product.stockPackaging && !product.stockPackaging.balance) {
    throw new Error("Saldo da embalagem não encontrado.");
  }

  if (!product.stockPackaging && !product.stockItem.balance) {
    throw new Error("Saldo do item de estoque não encontrado.");
  }

  return product;
}

function revalidateStockPages() {
  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard/stock/movements");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
}

export async function registerStockEntry(formData: FormData) {
  const session = await requireModuleAccess("STOCK");

  const productId = getText(formData, "productId");
  const quantity = getQuantity(formData);
  const reason = getReason(formData);

  const product = await getProduct(productId);

  await prisma.$transaction(async (tx) => {
    if (product.stockPackaging) {
      const result = await tx.stockPackagingBalance.updateMany({
        where: {
          stockPackagingId: product.stockPackaging.id,
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
          stockPackagingId: product.stockPackaging.id,
          userId: session.user.id,
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
          userId: session.user.id,
        },
      });
    }
  });

  revalidateStockPages();
}

export async function registerStockLoss(formData: FormData) {
  const session = await requireModuleAccess("STOCK");

  const productId = getText(formData, "productId");
  const quantity = getQuantity(formData);
  const reason = getReason(formData);

  const product = await getProduct(productId);

  await prisma.$transaction(async (tx) => {
    if (product.stockPackaging) {
      const result = await tx.stockPackagingBalance.updateMany({
        where: {
          stockPackagingId: product.stockPackaging.id,
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
          `Estoque insuficiente de ${product.name}.`,
        );
      }

      await tx.stockMovement.create({
        data: {
          type: "LOSS",
          quantity: quantity.negated(),
          unit: "UNIT",
          reason,
          stockItemId: product.stockItem!.id,
          stockPackagingId: product.stockPackaging.id,
          userId: session.user.id,
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
          userId: session.user.id,
        },
      });
    }
  });

  revalidateStockPages();
}

export async function registerStockAdjustment(formData: FormData) {
  const session = await requireModuleAccess("STOCK");

  const productId = getText(formData, "productId");
  const newQuantity = getQuantity(formData, true);
  const reason = getReason(formData);

  const product = await getProduct(productId);

  await prisma.$transaction(async (tx) => {
    if (product.stockPackaging) {
      const balance = await tx.stockPackagingBalance.findUnique({
        where: {
          stockPackagingId: product.stockPackaging.id,
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
          stockPackagingId: product.stockPackaging.id,
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
          stockPackagingId: product.stockPackaging.id,
          userId: session.user.id,
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
          userId: session.user.id,
        },
      });
    }
  });

  revalidateStockPages();
}
