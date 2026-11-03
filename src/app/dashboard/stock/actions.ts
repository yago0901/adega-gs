
"use server";

import { randomUUID } from "node:crypto";
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
        throw new Error(`Estoque insuficiente de ${product.name}.`);
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

export async function openCommercialPackaging(formData: FormData) {
  const session = await requireModuleAccess("STOCK");
  const productId = getText(formData, "productId");

  if (!productId) {
    throw new Error("Produto não informado.");
  }

  const reference = randomUUID();

  await prisma.$transaction(async (tx) => {
    const parentProduct = await tx.product.findFirst({
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
        packagingChildProduct: {
          include: {
            stockItem: {
              include: {
                balance: true,
              },
            },
          },
        },
      },
    });

    if (!parentProduct) {
      throw new Error("Produto não encontrado ou inativo.");
    }

    if (
      parentProduct.type !== "STANDARD" &&
      parentProduct.type !== "SUPPLY"
    ) {
      throw new Error("Somente produtos comuns podem ser abertos.");
    }

    const parentStockItem = parentProduct.stockItem;
    const childProduct = parentProduct.packagingChildProduct;
    const conversionFactor = parentProduct.packagingChildQuantity;

    if (!parentStockItem || !parentStockItem.balance) {
      throw new Error("Saldo da embalagem não encontrado.");
    }

    if (parentStockItem.unit !== "UNIT") {
      throw new Error(
        "A embalagem comercial precisa controlar seu estoque em unidades.",
      );
    }

    if (!childProduct || !conversionFactor) {
      throw new Error(
        "Este produto não possui uma conversão de embalagem configurada.",
      );
    }

    if (!childProduct.active || !childProduct.stockItem) {
      throw new Error("O produto convertido está inativo ou sem estoque.");
    }

    if (
      childProduct.type !== "STANDARD" &&
      childProduct.type !== "SUPPLY"
    ) {
      throw new Error("O produto convertido não é um produto comum.");
    }

    if (
      childProduct.stockItem.unit !== "UNIT" ||
      !childProduct.stockItem.active
    ) {
      throw new Error(
        "O produto convertido precisa ter estoque próprio em unidades.",
      );
    }

    if (!childProduct.stockItem.balance) {
      throw new Error("Saldo do produto convertido não encontrado.");
    }

    if (
      childProduct.stockPackagingId !== null ||
      childProduct.packagingChildProductId !== null
    ) {
      throw new Error(
        "O produto convertido não pode possuir outra conversão de embalagem.",
      );
    }

    if (conversionFactor.lessThanOrEqualTo(0)) {
      throw new Error("Fator de conversão inválido.");
    }

    const parentUpdate = await tx.stockBalance.updateMany({
      where: {
        stockItemId: parentStockItem.id,
        quantity: {
          gte: new Prisma.Decimal(1),
        },
      },
      data: {
        quantity: {
          decrement: new Prisma.Decimal(1),
        },
      },
    });

    if (parentUpdate.count !== 1) {
      throw new Error(
        `Estoque insuficiente de ${parentProduct.name}.`,
      );
    }

    const childUpdate = await tx.stockBalance.updateMany({
      where: {
        stockItemId: childProduct.stockItem.id,
      },
      data: {
        quantity: {
          increment: conversionFactor,
        },
      },
    });

    if (childUpdate.count !== 1) {
      throw new Error(
        `Não foi possível atualizar o estoque de ${childProduct.name}.`,
      );
    }

    await tx.stockMovement.create({
      data: {
        type: "OPEN_PACKAGING",
        quantity: new Prisma.Decimal(-1),
        unit: "UNIT",
        reason: `Abertura de ${parentProduct.name}: conversão para ${conversionFactor.toString()} ${childProduct.name}.`,
        reference,
        stockItemId: parentStockItem.id,
        userId: session.user.id,
      },
    });

    await tx.stockMovement.create({
      data: {
        type: "OPEN_PACKAGING",
        quantity: conversionFactor,
        unit: "UNIT",
        reason: `Recebimento por abertura de ${parentProduct.name}.`,
        reference,
        stockItemId: childProduct.stockItem.id,
        userId: session.user.id,
      },
    });
  });

  revalidateStockPages();
}

export async function openStockBottle(formData: FormData) {
  const session = await requireModuleAccess("STOCK");

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
  const reference = randomUUID();

  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
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

    if (product.type !== "STANDARD" && product.type !== "SUPPLY") {
      throw new Error("Somente produtos comuns podem ter garrafas abertas.");
    }

    const stockItem = product.stockItem;
    const packaging = product.stockPackaging;

    if (!stockItem || !packaging) {
      throw new Error("Este produto não possui embalagem própria configurada.");
    }

    if (stockItem.unit !== "ML") {
      throw new Error(
        "A abertura de garrafas exige que o estoque do produto seja controlado em ml.",
      );
    }

    if (!stockItem.active || !stockItem.balance) {
      throw new Error("Saldo do estoque aberto não encontrado.");
    }

    if (!packaging.balance) {
      throw new Error("Saldo das garrafas fechadas não encontrado.");
    }

    if (
      product.packagingChildProductId ||
      packaging.conversionFactor.lessThanOrEqualTo(0)
    ) {
      throw new Error("Configuração de embalagem inválida.");
    }

    const quantityToAdd = packaging.conversionFactor.mul(quantity);

    const closedUpdate = await tx.stockPackagingBalance.updateMany({
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

    if (closedUpdate.count !== 1) {
      throw new Error(
        `Não há garrafas fechadas suficientes de ${product.name}.`,
      );
    }

    const openUpdate = await tx.stockBalance.updateMany({
      where: {
        stockItemId: stockItem.id,
      },
      data: {
        quantity: {
          increment: quantityToAdd,
        },
      },
    });

    if (openUpdate.count !== 1) {
      throw new Error("Não foi possível atualizar o estoque aberto.");
    }

    await tx.stockMovement.create({
      data: {
        type: "OPEN_PACKAGING",
        quantity: quantity.negated(),
        unit: "UNIT",
        reason: `Abertura de ${quantity.toString()} garrafa(s) de ${product.name}.`,
        reference,
        stockItemId: stockItem.id,
        stockPackagingId: packaging.id,
        userId: session.user.id,
      },
    });

    await tx.stockMovement.create({
      data: {
        type: "OPEN_PACKAGING",
        quantity: quantityToAdd,
        unit: "ML",
        reason: `Recebimento de ${quantityToAdd.toString()} ml pela abertura de ${product.name}.`,
        reference,
        stockItemId: stockItem.id,
        userId: session.user.id,
      },
    });
  });

  revalidateStockPages();
}