import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { lockOpenCashRegister } from "./cash-register.service";
import { allocateCreditToOpenDebtsInTransaction } from "./customer-account.service";
import type {
  CancelDeliveryResult,
  CompleteDeliveryResult,
  DeliveryCancellationResolution,
  DispatchDeliveryResult,
} from "./types";

export async function dispatchDeliveryRecord(
  userId: string,
  deliveryId: string,
  motoboyId: string,
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

    await prisma.$transaction(
      async (tx) => {
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
            fee: true,
            sale: {
              select: {
                id: true,
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

        const fee = delivery.sale.deliveryFee;
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

export async function completeDeliveryRecord(
  userId: string,
  deliveryId: string,
): Promise<CompleteDeliveryResult> {
  try {
    if (typeof deliveryId !== "string" || !deliveryId.trim()) {
      return {
        success: false,
        error: "Entrega inválida.",
      };
    }

    await prisma.$transaction(
      async (tx) => {
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
            predictedCashReceived: true,
            predictedChangeAmount: true,
            payments: {
              select: {
                type: true,
                method: true,
                amount: true,
              },
            },
            sale: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        });

        if (!delivery) {
          throw new Error("Entrega não encontrada.");
        }

        if (delivery.status !== "OUT_FOR_DELIVERY") {
          throw new Error(
            "Só é possível concluir entregas que já saíram para entrega.",
          );
        }

        if (delivery.sale.status !== "PENDING_DELIVERY") {
          throw new Error(
            "A venda desta entrega não está mais aguardando entrega.",
          );
        }

        if (delivery.payments.length === 0) {
          throw new Error(
            "Esta entrega não possui pagamentos registrados.",
          );
        }

        const cashRegister = await lockOpenCashRegister(tx);

        const totalsByMethod = new Map<
          "CASH" | "PIX" | "CREDIT_CARD" | "DEBIT_CARD",
          Prisma.Decimal
        >();

        for (const payment of delivery.payments) {
          const current =
            totalsByMethod.get(payment.method) ?? new Prisma.Decimal(0);
          totalsByMethod.set(payment.method, current.plus(payment.amount));
        }

        const cashTotal = totalsByMethod.get("CASH") ?? new Prisma.Decimal(0);
        const cashApplied = cashTotal.minus(delivery.predictedChangeAmount);

        if (cashApplied.lt(0)) {
          throw new Error(
            "Os valores de dinheiro e troco da entrega estão inconsistentes.",
          );
        }

        const salePayments: Array<{
          paymentMethod: "CASH" | "PIX" | "CREDIT_CARD" | "DEBIT_CARD";
          amount: Prisma.Decimal;
        }> = [];

        if (cashApplied.gt(0)) {
          salePayments.push({
            paymentMethod: "CASH",
            amount: cashApplied,
          });
        }

        for (const method of ["PIX", "CREDIT_CARD", "DEBIT_CARD"] as const) {
          const amount = totalsByMethod.get(method);
          if (amount && amount.gt(0)) {
            salePayments.push({
              paymentMethod: method,
              amount,
            });
          }
        }

        if (salePayments.length === 0) {
          throw new Error(
            "Não há pagamentos válidos para lançar no caixa.",
          );
        }

        const returnedAt = new Date();

        const updatedDelivery = await tx.delivery.updateMany({
          where: {
            id: delivery.id,
            status: "OUT_FOR_DELIVERY",
          },
          data: {
            status: "COMPLETED",
            returnedAt,
            returnedById: userId,
          },
        });

        if (updatedDelivery.count !== 1) {
          throw new Error(
            "Não foi possível concluir a entrega. Atualize a página.",
          );
        }

        const updatedSale = await tx.sale.updateMany({
          where: {
            id: delivery.sale.id,
            status: "PENDING_DELIVERY",
          },
          data: {
            status: "COMPLETED",
            cashRegisterId: cashRegister.id,
            cashReceived: delivery.predictedCashReceived,
            changeAmount: delivery.predictedChangeAmount,
          },
        });

        if (updatedSale.count !== 1) {
          throw new Error(
            "Não foi possível concluir a venda da entrega. Atualize a página.",
          );
        }

        await tx.salePayment.createMany({
          data: salePayments.map((payment) => ({
            saleId: delivery.sale.id,
            paymentMethod: payment.paymentMethod,
            amount: payment.amount,
          })),
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
          : "Não foi possível concluir a entrega.",
    };
  }
}

export async function cancelDeliveryRecord(
  userId: string,
  deliveryId: string,
  resolution: DeliveryCancellationResolution,
  reason: string,
  applyCreditToDebts = false,
): Promise<CancelDeliveryResult> {
  try {
    if (typeof deliveryId !== "string" || !deliveryId.trim()) {
      return {
        success: false,
        error: "Entrega inválida.",
      };
    }

    if (resolution !== "REFUND" && resolution !== "CUSTOMER_CREDIT") {
      return {
        success: false,
        error: "Selecione uma resolução válida para o cancelamento.",
      };
    }

    const normalizedReason = reason.trim();

    if (normalizedReason.length < 3) {
      return {
        success: false,
        error: "Informe o motivo do cancelamento.",
      };
    }

    await prisma.$transaction(
      async (tx) => {
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
            payments: {
              select: {
                type: true,
                amount: true,
              },
            },
            sale: {
              select: {
                id: true,
                status: true,
                customerId: true,
              },
            },
          },
        });

        if (!delivery) {
          throw new Error("Entrega não encontrada.");
        }

        if (
          delivery.status !== "PENDING" &&
          delivery.status !== "OUT_FOR_DELIVERY"
        ) {
          throw new Error(
            "Só é possível cancelar entregas pendentes ou em andamento.",
          );
        }

        if (delivery.sale.status !== "PENDING_DELIVERY") {
          throw new Error(
            "A venda desta entrega não está mais aguardando entrega.",
          );
        }

        const prepaidAmount = delivery.payments.reduce(
          (sum, payment) =>
            payment.type === "PREPAID" ? sum.plus(payment.amount) : sum,
          new Prisma.Decimal(0),
        );

        if (resolution === "CUSTOMER_CREDIT") {
          if (!delivery.sale.customerId) {
            throw new Error(
              "Não é possível gerar crédito sem cliente vinculado.",
            );
          }

          if (prepaidAmount.lte(0)) {
            throw new Error(
              "Não há valor antecipado para gerar crédito ao cliente.",
            );
          }
        }

        const stockMovements = await tx.stockMovement.findMany({
          where: {
            saleId: delivery.sale.id,
            type: "SALE",
          },
        });

        if (stockMovements.length === 0) {
          throw new Error(
            "Não foram encontradas movimentações de estoque para esta venda.",
          );
        }

        const cancelledAt = new Date();

        const updatedDelivery = await tx.delivery.updateMany({
          where: {
            id: delivery.id,
            status: {
              in: ["PENDING", "OUT_FOR_DELIVERY"],
            },
          },
          data: {
            status: "CANCELLED",
            cancelledAt,
            cancellationReason: normalizedReason,
            cancellationResolution: resolution,
            cancellationRefundAmount: prepaidAmount,
            cancellationResolvedAt: cancelledAt,
            cancelledById: userId,
            cancellationResolvedById: userId,
          },
        });

        if (updatedDelivery.count !== 1) {
          throw new Error(
            "Não foi possível cancelar a entrega. Atualize a página.",
          );
        }

        const updatedSale = await tx.sale.updateMany({
          where: {
            id: delivery.sale.id,
            status: "PENDING_DELIVERY",
          },
          data: {
            status: "CANCELLED",
            cancelledAt,
          },
        });

        if (updatedSale.count !== 1) {
          throw new Error(
            "Não foi possível cancelar a venda da entrega. Atualize a página.",
          );
        }

        for (const movement of stockMovements) {
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
              userId,
              reason: "Cancelamento de entrega",
              reference: delivery.sale.id,
              stockItemId: movement.stockItemId,
              stockPackagingId: movement.stockPackagingId,
              saleId: delivery.sale.id,
            },
          });
        }

        if (resolution === "CUSTOMER_CREDIT" && prepaidAmount.gt(0)) {
          const creditMovement = await tx.customerAccountMovement.create({
            data: {
              type: "CREDIT",
              amount: prepaidAmount,
              description: `Crédito por cancelamento da entrega ${delivery.sale.id.slice(-6).toUpperCase()}`,
              customerId: delivery.sale.customerId!,
              userId,
              saleId: delivery.sale.id,
              deliveryCreditForId: delivery.id,
            },
          });

          if (applyCreditToDebts) {
            await allocateCreditToOpenDebtsInTransaction(
              tx,
              delivery.sale.customerId!,
              creditMovement.id,
              prepaidAmount,
            );
          }
        }
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
          : "Não foi possível cancelar a entrega.",
    };
  }
}
