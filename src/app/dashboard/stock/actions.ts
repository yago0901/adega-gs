
"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";

function getText(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

function getQuantity(formData: FormData) {
  const raw = getText(formData, "quantity").replace(",", ".");
  const quantity = Number(raw);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Informe uma quantidade maior que zero.");
  }

  return quantity;
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
      balance: true,
    },
  });

  if (!product || !product.balance) {
    throw new Error("Produto ou saldo de estoque não encontrado.");
  }

  return product;
}

export async function registerStockEntry(formData: FormData) {
  const session = await requireModuleAccess("STOCK");

  const productId = getText(formData, "productId");
  const quantity = getQuantity(formData);
  const reason = getReason(formData);

  const product = await getProduct(productId);

  await prisma.$transaction(async (tx) => {
    await tx.stockBalance.update({
      where: { productId },
      data: {
        quantity: { increment: quantity },
      },
    });

    await tx.stockMovement.create({
      data: {
        type: "PURCHASE",
        quantity,
        reason,
        productId,
        userId: session.user.id,
      },
    });
  });

  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard/stock/movements");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
}

export async function registerStockLoss(formData: FormData) {
  const session = await requireModuleAccess("STOCK");

  const productId = getText(formData, "productId");
  const quantity = getQuantity(formData);
  const reason = getReason(formData);

  await getProduct(productId);

  await prisma.$transaction(async (tx) => {
    const result = await tx.stockBalance.updateMany({
      where: {
        productId,
        quantity: { gte: quantity },
      },
      data: {
        quantity: { decrement: quantity },
      },
    });

    if (result.count === 0) {
      throw new Error("Estoque insuficiente para registrar essa perda.");
    }

    await tx.stockMovement.create({
      data: {
        type: "LOSS",
        quantity,
        reason,
        productId,
        userId: session.user.id,
      },
    });
  });

  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard/stock/movements");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
}

export async function registerStockAdjustment(formData: FormData) {
  const session = await requireModuleAccess("STOCK");

  const productId = getText(formData, "productId");
  const newQuantity = getQuantity(formData);
  const reason = getReason(formData);

  await getProduct(productId);

  await prisma.$transaction(async (tx) => {
    const balance = await tx.stockBalance.findUnique({
      where: { productId },
    });

    if (!balance) {
      throw new Error("Saldo de estoque não encontrado.");
    }

    const difference = newQuantity - balance.quantity.toNumber();

    if (difference === 0) {
      throw new Error("A quantidade informada já é o saldo atual.");
    }

    // Atualização otimista: impede sobrescrever uma alteração concorrente.
    const result = await tx.stockBalance.updateMany({
      where: {
        productId,
        quantity: balance.quantity,
      },
      data: {
        quantity: newQuantity,
      },
    });

    if (result.count === 0) {
      throw new Error(
        "O estoque foi alterado por outra operação. Atualize a página e tente novamente."
      );
    }

    await tx.stockMovement.create({
      data: {
        type: "ADJUSTMENT",
        quantity: difference,
        reason,
        productId,
        userId: session.user.id,
      },
    });
  });

  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard/stock/movements");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
}
