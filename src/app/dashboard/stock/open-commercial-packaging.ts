
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";

type Transaction = Prisma.TransactionClient;

export async function openCommercialPackagingInTransaction(
  tx: Transaction,
  parentProductId: string,
  quantity: Prisma.Decimal,
  userId: string,
) {
  if (!quantity.isInteger() || quantity.lessThanOrEqualTo(0)) {
    throw new Error(
      "A quantidade de embalagens deve ser um inteiro positivo.",
    );
  }

  const parentProduct = await tx.product.findFirst({
    where: {
      id: parentProductId,
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

  if (!parentStockItem?.active) {
    throw new Error("O estoque da embalagem está inativo.");
  }

  if (!parentStockItem.balance) {
    throw new Error("Saldo da embalagem não encontrado.");
  }

  if (parentStockItem.unit !== "UNIT") {
    throw new Error(
      "A embalagem comercial precisa controlar seu estoque em unidades.",
    );
  }

  if (parentProduct.stockPackagingId !== null) {
    throw new Error(
      "A embalagem comercial não pode possuir embalagem própria do tipo SELF.",
    );
  }

  const childProduct = parentProduct.packagingChildProduct;
  const conversionFactor = parentProduct.packagingChildQuantity;

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

  if (childProduct.stockPackagingId !== null) {
    throw new Error(
      "O produto convertido não pode possuir embalagem própria do tipo SELF.",
    );
  }

  if (
    conversionFactor.lessThanOrEqualTo(0) ||
    !conversionFactor.isInteger()
  ) {
    throw new Error(
      "O fator de conversão precisa ser um número inteiro maior que zero.",
    );
  }

  const parentBalance = parentStockItem.balance;
  const childBalance = childProduct.stockItem.balance;

  const quantityToGenerate = quantity.mul(conversionFactor);

  const parentUpdate = await tx.stockBalance.updateMany({
    where: {
      id: parentBalance.id,
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

  if (parentUpdate.count !== 1) {
    throw new Error(
      `Estoque insuficiente de ${parentProduct.name}.`,
    );
  }

  const childUpdate = await tx.stockBalance.updateMany({
    where: {
      id: childBalance.id,
    },
    data: {
      quantity: {
        increment: quantityToGenerate,
      },
    },
  });

  if (childUpdate.count !== 1) {
    throw new Error(
      `Não foi possível atualizar o estoque de ${childProduct.name}.`,
    );
  }

  const reference = randomUUID();

  await tx.stockMovement.createMany({
    data: [
      {
        type: "OPEN_PACKAGING",
        quantity: quantity.negated(),
        unit: "UNIT",
        reason: `Abertura de ${parentProduct.name}: conversão para ${quantityToGenerate.toString()} ${childProduct.name}.`,
        reference,
        stockItemId: parentStockItem.id,
        userId,
      },
      {
        type: "OPEN_PACKAGING",
        quantity: quantityToGenerate,
        unit: "UNIT",
        reason: `Recebimento por abertura de ${parentProduct.name}.`,
        reference,
        stockItemId: childProduct.stockItem.id,
        userId,
      },
    ],
  });
}
