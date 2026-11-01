
"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";

type PaymentMethod =
  | "CASH"
  | "PIX"
  | "CREDIT_CARD"
  | "DEBIT_CARD";

type SaleRequestItem = {
  productId: string;
  quantity: number;
};

type SaleResult =
  | { success: true; saleId: string; total: string }
  | { success: false; error: string };

const allowedPaymentMethods: PaymentMethod[] = [
  "CASH",
  "PIX",
  "CREDIT_CARD",
  "DEBIT_CARD",
];

export async function finalizeSale(
  items: SaleRequestItem[],
  paymentMethod: PaymentMethod,
): Promise<SaleResult> {
  try {
    const session = await requireModuleAccess("POS");

    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return { success: false, error: "Forma de pagamento inválida." };
    }

    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, error: "Adicione produtos à venda." };
    }

    if (items.length > 100) {
      return { success: false, error: "Limite de 100 itens por venda." };
    }

    const quantities = new Map<string, Prisma.Decimal>();

    for (const item of items) {
      if (
        typeof item.productId !== "string" ||
        !item.productId ||
        typeof item.quantity !== "number" ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !/^\d+(\.\d{1,3})?$/.test(String(item.quantity))
      ) {
        return {
          success: false,
          error: "Um dos itens possui quantidade inválida.",
        };
      }

      const quantity = new Prisma.Decimal(String(item.quantity));

      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? new Prisma.Decimal(0)).plus(quantity),
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const productIds = Array.from(quantities.keys());

      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          active: true,
          type: { in: ["STANDARD", "SUPPLY"] },
        },
        include: {
          balance: true,
        },
      });

      if (products.length !== productIds.length) {
        throw new Error("Um ou mais produtos não estão disponíveis para venda.");
      }

      let total = new Prisma.Decimal(0);

      const saleItems = products.map((product) => {
        const quantity = quantities.get(product.id)!;
        const unitPrice = new Prisma.Decimal(product.salePrice);
        const itemTotal = unitPrice.mul(quantity);

        total = total.plus(itemTotal);

        return {
          product,
          quantity,
          unitPrice,
          itemTotal,
        };
      });

      for (const item of saleItems) {
        if (!item.product.balance) {
          throw new Error(
            `O produto ${item.product.name} não possui saldo de estoque.`,
          );
        }

        const updated = await tx.stockBalance.updateMany({
          where: {
            productId: item.product.id,
            quantity: { gte: item.quantity },
          },
          data: {
            quantity: { decrement: item.quantity },
          },
        });

        if (updated.count !== 1) {
          throw new Error(`Estoque insuficiente para ${item.product.name}.`);
        }
      }

      const sale = await tx.sale.create({
        data: {
          total,
          paymentMethod,
          userId: session.user.id,
          items: {
            create: saleItems.map((item) => ({
              productId: item.product.id,
              productName: item.product.name,
              productCode: item.product.code,
              unit: item.product.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.itemTotal,
            })),
          },
        },
      });

      await tx.stockMovement.createMany({
        data: saleItems.map((item) => ({
          type: "SALE",
          quantity: item.quantity.negated(),
          reason: `Venda ${sale.id}`,
          reference: sale.id,
          saleId: sale.id,
          productId: item.product.id,
          userId: session.user.id,
        })),
      });

      return sale;
    });

    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/stock");
    revalidatePath("/dashboard/stock/movements");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard");

    return {
      success: true,
      saleId: result.id,
      total: result.total.toString(),
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível finalizar a venda.",
    };
  }
}
