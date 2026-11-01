
"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";

export async function cancelSale(saleId: string) {
  try {
    await requireModuleAccess("HISTORY");

    if (!saleId) {
      return {
        success: false,
        error: "Venda inválida.",
      };
    }

    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: {
          id: saleId,
        },
      });

      if (!sale) {
        throw new Error("Venda não encontrada.");
      }

      if (sale.status === "CANCELLED") {
        throw new Error("Esta venda já foi cancelada.");
      }

      const movements = await tx.stockMovement.findMany({
        where: {
          saleId: sale.id,
          type: "SALE",
        },
      });

      if (movements.length === 0) {
        throw new Error(
          "Não foram encontradas movimentações de estoque para esta venda. O cancelamento automático foi interrompido.",
        );
      }

      const cancellation = await tx.sale.updateMany({
        where: {
          id: sale.id,
          status: "COMPLETED",
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      });

      if (cancellation.count !== 1) {
        throw new Error(
          "Esta venda já foi alterada. Atualize a página e tente novamente.",
        );
      }

      for (const movement of movements) {
        if (movement.quantity.greaterThanOrEqualTo(0)) {
          throw new Error(
            "Foi encontrada uma movimentação de venda com quantidade inválida.",
          );
        }

        const quantityToRestore = movement.quantity.negated();

        if (movement.stockPackagingId) {
          const result = await tx.stockPackagingBalance.updateMany({
            where: {
              stockPackagingId: movement.stockPackagingId,
            },
            data: {
              quantity: {
                increment: quantityToRestore,
              },
            },
          });

          if (result.count !== 1) {
            throw new Error(
              `Não foi possível restaurar o estoque da embalagem ${movement.stockPackagingId}.`,
            );
          }
        } else {
          const result = await tx.stockBalance.updateMany({
            where: {
              stockItemId: movement.stockItemId,
            },
            data: {
              quantity: {
                increment: quantityToRestore,
              },
            },
          });

          if (result.count !== 1) {
            throw new Error(
              `Não foi possível restaurar o estoque do item ${movement.stockItemId}.`,
            );
          }
        }

        await tx.stockMovement.create({
          data: {
            type: "REVERSAL",
            quantity: quantityToRestore,
            unit: movement.unit,
            reason: "Cancelamento de venda",
            reference: sale.id,
            stockItemId: movement.stockItemId,
            stockPackagingId: movement.stockPackagingId,
            saleId: sale.id,
          },
        });
      }
    });

    revalidatePath("/dashboard/history");
    revalidatePath("/dashboard/stock");
    revalidatePath("/dashboard/stock/movements");
    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard");

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível cancelar a venda.",
    };
  }
}
