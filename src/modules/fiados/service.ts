import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { allocateCreditToOpenDebtsInTransaction } from "@/modules/pos/customer-account.service";

export type AllocateCreditsResult =
  | {
      success: true;
      allocatedAmount: string;
      remainingCredit: string;
    }
  | { success: false; error: string };

export async function allocateCustomerAvailableCreditsRecord(
  customerId: string,
  creditMovementId?: string,
): Promise<AllocateCreditsResult> {
  try {
    if (typeof customerId !== "string" || !customerId.trim()) {
      return {
        success: false,
        error: "Cliente inválido.",
      };
    }

    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        active: true,
      },
      select: {
        id: true,
      },
    });

    if (!customer) {
      return {
        success: false,
        error: "Cliente não encontrado ou inativo.",
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const credits = await tx.customerAccountMovement.findMany({
        where: {
          customerId: customer.id,
          type: "CREDIT",
          reversedBy: null,
          ...(creditMovementId
            ? {
                id: creditMovementId,
              }
            : {}),
        },
        include: {
          allocationsAsCredit: {
            select: {
              amount: true,
            },
          },
        },
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" },
        ],
      });

      let allocatedTotal = new Prisma.Decimal(0);
      let remainingCredit = new Prisma.Decimal(0);

      for (const credit of credits) {
        const alreadyAllocated = credit.allocationsAsCredit.reduce(
          (sum, allocation) => sum.plus(allocation.amount),
          new Prisma.Decimal(0),
        );
        const available = credit.amount.minus(alreadyAllocated);

        if (available.lte(0)) {
          continue;
        }

        const allocated = await allocateCreditToOpenDebtsInTransaction(
          tx,
          customer.id,
          credit.id,
          available,
        );

        allocatedTotal = allocatedTotal.plus(allocated);
        remainingCredit = remainingCredit.plus(available.minus(allocated));
      }

      if (allocatedTotal.lte(0) && creditMovementId) {
        throw new Error(
          "Não há crédito disponível ou dívidas em aberto para abater.",
        );
      }

      return {
        allocatedAmount: allocatedTotal.toFixed(2),
        remainingCredit: remainingCredit.toFixed(2),
      };
    });

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível abater o crédito nas dívidas.",
    };
  }
}
