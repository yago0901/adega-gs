import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CashMovementResult,
  CloseCashRegisterResult,
  OpenCashRegisterResult,
} from "./types";

export async function lockOpenCashRegister(
  tx: Prisma.TransactionClient,
) {
  const [lockedCashRegister] = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "CashRegister"
    WHERE "status" = 'OPEN'
    LIMIT 1
    FOR UPDATE
  `;

  if (!lockedCashRegister) {
    throw new Error("Nenhum caixa aberto foi encontrado.");
  }

  const cashRegister = await tx.cashRegister.findUnique({
    where: {
      id: lockedCashRegister.id,
    },
  });

  if (!cashRegister || cashRegister.status !== "OPEN") {
    throw new Error("Nenhum caixa aberto foi encontrado.");
  }

  return cashRegister;
}


async function getPhysicalCashBalance(
  tx: Prisma.TransactionClient,
  cashRegisterId: string,
  openingAmount: Prisma.Decimal,
) {
  const cashSales = await tx.salePayment.aggregate({
    where: {
      paymentMethod: "CASH",
      sale: {
        cashRegisterId,
        status: "COMPLETED",
      },
    },
    _sum: {
      amount: true,
    },
  });

  const cashDebtPayments =
    await tx.customerAccountMovementPayment.aggregate({
      where: {
        method: "CASH",
        movement: {
          cashRegisterId,
          type: "CREDIT",
        },
      },
      _sum: {
        amount: true,
      },
    });

  const movements = await tx.cashMovement.groupBy({
    by: ["type"],
    where: {
      cashRegisterId,
    },
    _sum: {
      amount: true,
    },
  });

  const supplies =
    movements.find((movement) => movement.type === "SUPPLY")
      ?._sum.amount ?? new Prisma.Decimal(0);

  const withdrawals =
    movements.find((movement) => movement.type === "WITHDRAWAL")
      ?._sum.amount ?? new Prisma.Decimal(0);

  return openingAmount
    .plus(cashSales._sum.amount ?? 0)
    .plus(cashDebtPayments._sum.amount ?? 0)
    .plus(supplies)
    .minus(withdrawals);
}


export async function openCashRegisterRecord(
  openingAmount: string,
  userId: string,
): Promise<OpenCashRegisterResult> {
  try {
    const normalizedAmount = openingAmount.trim().replace(",", ".");

    if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
      return {
        success: false,
        error: "Informe um valor inicial válido.",
      };
    }

    const amount = new Prisma.Decimal(normalizedAmount);

    if (amount.gt("9999999999.99")) {
      return {
        success: false,
        error: "O valor inicial informado é muito alto.",
      };
    }

    const cashRegister = await prisma.$transaction(
      async (tx) => {
        const existingCashRegister = await tx.cashRegister.findFirst({
          where: {
            status: "OPEN",
          },
        });

        if (existingCashRegister) {
          throw new Error("Já existe um caixa aberto.");
        }

        return tx.cashRegister.create({
          data: {
            openingAmount: amount,
            openedById: userId,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
    return {
      success: true,
      cashRegisterId: cashRegister.id,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "Já existe um caixa aberto.",
      };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return {
        success: false,
        error: "Não foi possível abrir o caixa. Tente novamente.",
      };
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível abrir o caixa.",
    };
  }
}

export async function closeCashRegisterRecord(
  countedAmount: string,
  userId: string,
): Promise<CloseCashRegisterResult> {
  try {
    const normalizedAmount = countedAmount.trim().replace(",", ".");

    if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
      return {
        success: false,
        error: "Informe um valor contado válido.",
      };
    }

    const counted = new Prisma.Decimal(normalizedAmount);

    if (counted.gt("9999999999.99")) {
      return {
        success: false,
        error: "O valor contado é muito alto.",
      };
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const [lockedCashRegister] = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id"
          FROM "CashRegister"
          WHERE "status" = 'OPEN'
          LIMIT 1
          FOR UPDATE
        `;

        if (!lockedCashRegister) {
          throw new Error("Nenhum caixa aberto foi encontrado.");
        }

        const cashRegister = await tx.cashRegister.findUnique({
          where: {
            id: lockedCashRegister.id,
          },
        });

        if (!cashRegister || cashRegister.status !== "OPEN") {
          throw new Error("Nenhum caixa aberto foi encontrado.");
        }

        const paymentTotals = await tx.salePayment.groupBy({
          by: ["paymentMethod"],
          where: {
            sale: {
              cashRegisterId: cashRegister.id,
              status: "COMPLETED",
            },
          },
          _sum: {
            amount: true,
          },
        });

        const debtPaymentTotals =
          await tx.customerAccountMovementPayment.groupBy({
            by: ["method"],
            where: {
              movement: {
                cashRegisterId: cashRegister.id,
                type: "CREDIT",
              },
            },
            _sum: {
              amount: true,
            },
          });

        const cashTotal =
          paymentTotals.find((payment) => payment.paymentMethod === "CASH")
            ?._sum.amount ?? new Prisma.Decimal(0);

        const pixTotal =
          paymentTotals.find((payment) => payment.paymentMethod === "PIX")
            ?._sum.amount ?? new Prisma.Decimal(0);

        const creditCardTotal =
          paymentTotals.find((payment) => payment.paymentMethod === "CREDIT_CARD")
            ?._sum.amount ?? new Prisma.Decimal(0);

        const debitCardTotal =
          paymentTotals.find((payment) => payment.paymentMethod === "DEBIT_CARD")
            ?._sum.amount ?? new Prisma.Decimal(0);

        const totalSales = cashTotal
          .plus(pixTotal)
          .plus(creditCardTotal)
          .plus(debitCardTotal);

        const debtCashTotal =
          debtPaymentTotals.find(
            (payment) => payment.method === "CASH",
          )?._sum.amount ?? new Prisma.Decimal(0);

        const debtPixTotal =
          debtPaymentTotals.find(
            (payment) => payment.method === "PIX",
          )?._sum.amount ?? new Prisma.Decimal(0);

        const debtCreditCardTotal =
          debtPaymentTotals.find(
            (payment) => payment.method === "CREDIT_CARD",
          )?._sum.amount ?? new Prisma.Decimal(0);

        const debtDebitCardTotal =
          debtPaymentTotals.find(
            (payment) => payment.method === "DEBIT_CARD",
          )?._sum.amount ?? new Prisma.Decimal(0);

        const totalDebtPayments = debtCashTotal
          .plus(debtPixTotal)
          .plus(debtCreditCardTotal)
          .plus(debtDebitCardTotal);

        const supplies = await tx.cashMovement.aggregate({
          where: {
            cashRegisterId: cashRegister.id,
            type: "SUPPLY",
          },
          _sum: {
            amount: true,
          },
        });

        const withdrawals = await tx.cashMovement.aggregate({
          where: {
            cashRegisterId: cashRegister.id,
            type: "WITHDRAWAL",
          },
          _sum: {
            amount: true,
          },
        });

        const expected = cashRegister.openingAmount
          .plus(cashTotal)
          .plus(debtCashTotal)
          .plus(supplies._sum.amount ?? 0)
          .minus(withdrawals._sum.amount ?? 0);

        const difference = counted.minus(expected);

        const updated = await tx.cashRegister.updateMany({
          where: {
            id: cashRegister.id,
            status: "OPEN",
          },
          data: {
            status: "CLOSED",
            expectedAmount: expected,
            countedAmount: counted,
            difference,
            closedAt: new Date(),
            closedById: userId,
          },
        });

        if (updated.count !== 1) {
          throw new Error("Não foi possível fechar o caixa.");
        }

        return {
          expectedAmount: expected.toString(),
          countedAmount: counted.toString(),
          difference: difference.toString(),
          paymentTotals: {
            cash: cashTotal.toString(),
            pix: pixTotal.toString(),
            creditCard: creditCardTotal.toString(),
            debitCard: debitCardTotal.toString(),
            total: totalSales.toString(),
          },
          debtPaymentTotals: {
            cash: debtCashTotal.toString(),
            pix: debtPixTotal.toString(),
            creditCard: debtCreditCardTotal.toString(),
            debitCard: debtDebitCardTotal.toString(),
            total: totalDebtPayments.toString(),
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return {
        success: false,
        error: "O caixa foi alterado durante o fechamento. Tente novamente.",
      };
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível fechar o caixa.",
    };
  }
}

export async function registerCashSupplyRecord(
  amountInput: string,
  userId: string,
  description?: string,
): Promise<CashMovementResult> {
  try {
    if (typeof amountInput !== "string") {
      return {
        success: false,
        error: "Informe um valor válido.",
      };
    }

    const normalizedAmount = amountInput.trim().replace(",", ".");

    if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
      return {
        success: false,
        error: "Informe um valor válido.",
      };
    }

    const amount = new Prisma.Decimal(normalizedAmount);

    if (amount.lte(0) || amount.gt("9999999999.99")) {
      return {
        success: false,
        error: "O valor do suprimento é inválido.",
      };
    }

    if (
      description !== undefined &&
      (typeof description !== "string" || description.trim().length > 200)
    ) {
      return {
        success: false,
        error: "A descrição deve ter no máximo 200 caracteres.",
      };
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const cashRegister = await lockOpenCashRegister(tx);

        const movement = await tx.cashMovement.create({
          data: {
            type: "SUPPLY",
            amount,
            description: description?.trim() || null,
            cashRegisterId: cashRegister.id,
            userId: userId,
          },
        });

        const balance = await getPhysicalCashBalance(
          tx,
          cashRegister.id,
          cashRegister.openingAmount,
        );

        return {
          movementId: movement.id,
          balance: balance.toString(),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return {
        success: false,
        error: "O caixa foi alterado durante a operação. Tente novamente.",
      };
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível registrar o suprimento.",
    };
  }
}


export async function registerCashWithdrawalRecord(
  amountInput: string,
  userId: string,
  description?: string,
): Promise<CashMovementResult> {
  try {
    if (typeof amountInput !== "string") {
      return {
        success: false,
        error: "Informe um valor válido.",
      };
    }

    const normalizedAmount = amountInput.trim().replace(",", ".");

    if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
      return {
        success: false,
        error: "Informe um valor válido.",
      };
    }

    const amount = new Prisma.Decimal(normalizedAmount);

    if (amount.lte(0) || amount.gt("9999999999.99")) {
      return {
        success: false,
        error: "O valor da sangria é inválido.",
      };
    }

    if (
      description !== undefined &&
      (typeof description !== "string" || description.trim().length > 200)
    ) {
      return {
        success: false,
        error: "A descrição deve ter no máximo 200 caracteres.",
      };
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const cashRegister = await lockOpenCashRegister(tx);

        const currentBalance = await getPhysicalCashBalance(
          tx,
          cashRegister.id,
          cashRegister.openingAmount,
        );

        if (amount.gt(currentBalance)) {
          throw new Error(
            `Saldo insuficiente. Dinheiro disponível: R$ ${currentBalance.toFixed(2)}.`,
          );
        }

        const movement = await tx.cashMovement.create({
          data: {
            type: "WITHDRAWAL",
            amount,
            description: description?.trim() || null,
            cashRegisterId: cashRegister.id,
            userId: userId,
          },
        });

        const newBalance = currentBalance.minus(amount);

        return {
          movementId: movement.id,
          balance: newBalance.toString(),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return {
        success: false,
        error: "O caixa foi alterado durante a operação. Tente novamente.",
      };
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a sangria.",
    };
  }
}
