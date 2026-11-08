import { Prisma } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";

export async function openStockBottleInTransaction(
  tx: Prisma.TransactionClient,
  productId: string,
  quantity: Prisma.Decimal,
  userId: string,
) {
  const reference = randomUUID();

  if (
    quantity.lte(0) ||
    !quantity.isInteger() ||
    quantity.gt(10000)
  ) {
    throw new Error("Informe uma quantidade válida de garrafas.");
  }

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
    throw new Error("A abertura de garrafas exige estoque controlado em ml.");
  }

  if (!stockItem.active || !stockItem.balance) {
    throw new Error("Saldo do estoque aberto não encontrado.");
  }

  if (!packaging.balance) {
    throw new Error("Saldo das garrafas fechadas não encontrado.");
  }

  if (
    product.packagingChildProductId ||
    packaging.conversionFactor.lte(0) ||
    !packaging.conversionFactor.isInteger()
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
      userId,
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
      userId,
    },
  });
}
