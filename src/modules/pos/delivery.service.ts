import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { DispatchDeliveryResult } from "./types";

export async function dispatchDeliveryRecord(userId: string, 
  deliveryId: string,
  motoboyId: string,
  feeInput: string,
): Promise<DispatchDeliveryResult> {
  try {
    if (
      typeof deliveryId !== "string" ||
      !deliveryId.trim() ||
      typeof motoboyId !== "string" ||
      !motoboyId.trim()
    ) {
      return {
        success: false,
        error: "Entrega ou motoboy inválido.",
      };
    }

    if (typeof feeInput !== "string") {
      return {
        success: false,
        error: "Informe uma taxa de entrega válida.",
      };
    }

    const normalizedFee = feeInput.trim().replace(",", ".");

    if (!/^\d+(\.\d{1,2})?$/.test(normalizedFee)) {
      return {
        success: false,
        error: "Informe uma taxa de entrega válida.",
      };
    }

    const fee = new Prisma.Decimal(normalizedFee);

    if (fee.lt(0) || fee.gt("9999999999.99")) {
      return {
        success: false,
        error: "A taxa de entrega informada é inválida.",
      };
    }

    await prisma.$transaction(
      async (tx) => {
        // Bloqueia a entrega para evitar despachos simultâneos.
        const [lockedDelivery] = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id"
          FROM "Delivery"
          WHERE "id" = ${deliveryId}
          FOR UPDATE
        `;

        if (!lockedDelivery) {
          throw new Error("Entrega não encontrada.");
        }

        const delivery = await tx.delivery.findUnique({
          where: {
            id: deliveryId,
          },
          select: {
            id: true,
            status: true,
            sale: {
              select: {
                id: true,
                total: true,
                deliveryFee: true,
              },
            },
          },
        });

        if (!delivery) {
          throw new Error("Entrega não encontrada.");
        }

        if (delivery.status !== "PENDING") {
          throw new Error(
            "Esta entrega não está mais pendente. Atualize a página.",
          );
        }

        const motoboy = await tx.motoboy.findFirst({
          where: {
            id: motoboyId,
            active: true,
          },
          select: {
            id: true,
          },
        });

        if (!motoboy) {
          throw new Error(
            "Motoboy não encontrado ou inativo. Atualize a página.",
          );
        }

        const itemsTotal = delivery.sale.total.minus(delivery.sale.deliveryFee);
        const saleTotal = itemsTotal.plus(fee);
        const dispatchedAt = new Date();

        const updated = await tx.delivery.updateMany({
          where: {
            id: deliveryId,
            status: "PENDING",
          },
          data: {
            status: "OUT_FOR_DELIVERY",
            motoboyId: motoboy.id,
            fee,
            dispatchedAt,
            dispatchedById: userId,
          },
        });

        if (updated.count !== 1) {
          throw new Error(
            "Não foi possível despachar a entrega. Atualize a página.",
          );
        }

        await tx.sale.update({
          where: {
            id: delivery.sale.id,
          },
          data: {
            deliveryFee: fee,
            total: saleTotal,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return {
      success: true,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return {
        success: false,
        error:
          "A entrega foi alterada durante a operação. Atualize a página e tente novamente.",
      };
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível despachar a entrega.",
    };
  }
}
