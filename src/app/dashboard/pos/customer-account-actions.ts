"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

type CustomerDebtItem = {
    id: string;
    saleId: string | null;
    description: string | null;
    createdAt: string;
    originalAmount: string;
    paidAmount: string;
    remainingAmount: string;
};

type CustomerOpenDebtsResult =
    | {
        success: true;
        customerName: string;
        totalDebt: string;
        debts: CustomerDebtItem[];
    }
    | {
        success: false;
        error: string;
    };

type SalePaymentRequest = {
    paymentMethod: "CASH" | "PIX" | "CREDIT_CARD" | "DEBIT_CARD";
    amount: string;
};

type DebtPaymentResult =
    | {
        success: true;
        movementId: string;
        amountPaid: string;
        cashReceived: string;
        changeAmount: string;
    }
    | {
        success: false;
        error: string;
    };

async function lockOpenCashRegister(tx: Prisma.TransactionClient) {
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

export async function getCustomerOpenDebts(
    customerId: string,
): Promise<CustomerOpenDebtsResult> {
    try {
        await requireModuleAccess("POS");

        if (
            typeof customerId !== "string" ||
            !customerId.trim()
        ) {
            return {
                success: false,
                error: "Selecione um cliente válido.",
            };
        }

        const customer = await prisma.customer.findFirst({
            where: {
                id: customerId,
                active: true,
            },
            select: {
                id: true,
                name: true,
            },
        });

        if (!customer) {
            return {
                success: false,
                error: "Cliente não encontrado ou inativo.",
            };
        }

        const movements = await prisma.customerAccountMovement.findMany({
            where: {
                customerId: customer.id,
                type: "DEBIT",
            },
            include: {
                allocationsAsDebit: {
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

        const debts = movements.flatMap((movement) => {
            const paidAmount = movement.allocationsAsDebit.reduce(
                (sum, allocation) => sum.plus(allocation.amount),
                new Prisma.Decimal(0),
            );

            const remainingAmount = movement.amount.minus(paidAmount);

            if (remainingAmount.lte(0)) {
                return [];
            }

            return [
                {
                    id: movement.id,
                    saleId: movement.saleId,
                    description: movement.description,
                    createdAt: movement.createdAt.toISOString(),
                    originalAmount: movement.amount.toString(),
                    paidAmount: paidAmount.toString(),
                    remainingAmount: remainingAmount.toString(),
                },
            ];
        });

        const totalDebt = debts.reduce(
            (sum, debt) => sum.plus(debt.remainingAmount),
            new Prisma.Decimal(0),
        );

        return {
            success: true,
            customerName: customer.name,
            totalDebt: totalDebt.toString(),
            debts,
        };
    } catch (error) {
        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : "Não foi possível consultar as dívidas do cliente.",
        };
    }
}

export async function receiveCustomerDebtPayment(
    customerId: string,
    amountToApplyInput: string,
    payments: SalePaymentRequest[],
): Promise<DebtPaymentResult> {
    try {
        const session = await requireModuleAccess("POS");

        if (
            typeof customerId !== "string" ||
            !customerId.trim()
        ) {
            return {
                success: false,
                error: "Selecione um cliente válido.",
            };
        }

        if (
            typeof amountToApplyInput !== "string" ||
            !/^\d+(\.\d{1,2})?$/.test(amountToApplyInput.trim())
        ) {
            return {
                success: false,
                error: "Informe um valor válido para o recebimento.",
            };
        }

        const amountToApply = new Prisma.Decimal(
            amountToApplyInput.trim(),
        );

        if (
            amountToApply.lte(0) ||
            amountToApply.gt("9999999999.99")
        ) {
            return {
                success: false,
                error: "O valor do recebimento é inválido.",
            };
        }

        if (!Array.isArray(payments) || payments.length === 0) {
            return {
                success: false,
                error: "Informe pelo menos uma forma de pagamento.",
            };
        }

        if (payments.length > 4) {
            return {
                success: false,
                error: "Limite de 4 formas de pagamento.",
            };
        }

        const validPaymentMethods = [
            "CASH",
            "PIX",
            "CREDIT_CARD",
            "DEBIT_CARD",
        ] as const;

        const paymentMethods = new Set<string>();

        for (const payment of payments) {
            if (
                !payment ||
                !validPaymentMethods.includes(
                    payment.paymentMethod as (typeof validPaymentMethods)[number],
                ) ||
                typeof payment.amount !== "string" ||
                !/^\d+(\.\d{1,2})?$/.test(payment.amount.trim())
            ) {
                return {
                    success: false,
                    error: "Um dos pagamentos possui dados inválidos.",
                };
            }

            if (paymentMethods.has(payment.paymentMethod)) {
                return {
                    success: false,
                    error: "Não repita a mesma forma de pagamento.",
                };
            }

            paymentMethods.add(payment.paymentMethod);

            const amount = new Prisma.Decimal(payment.amount.trim());

            if (amount.lte(0) || amount.gt("9999999999.99")) {
                return {
                    success: false,
                    error: "O valor de um dos pagamentos é inválido.",
                };
            }
        }

        const result = await prisma.$transaction(
            async (tx) => {
                // Primeiro bloqueia o caixa para impedir fechamento
                // ou outra movimentação simultânea.
                const cashRegister = await lockOpenCashRegister(tx);

                const customer = await tx.customer.findFirst({
                    where: {
                        id: customerId,
                        active: true,
                    },
                    select: {
                        id: true,
                        name: true,
                    },
                });

                if (!customer) {
                    throw new Error(
                        "Cliente não encontrado ou inativo.",
                    );
                }

                // Bloqueia os débitos do cliente em ordem FIFO.
                await tx.$queryRaw<{ id: string }[]>`
          SELECT "id"
          FROM "CustomerAccountMovement"
          WHERE "customerId" = ${customer.id}
            AND "type" = 'DEBIT'
          ORDER BY "createdAt" ASC, "id" ASC
          FOR UPDATE
        `;

                // Recalcula as dívidas depois de obter os bloqueios.
                const debts = await tx.customerAccountMovement.findMany({
                    where: {
                        customerId: customer.id,
                        type: "DEBIT",
                    },
                    include: {
                        allocationsAsDebit: {
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

                const openDebts = debts.flatMap((debt) => {
                    const paidAmount = debt.allocationsAsDebit.reduce(
                        (sum, allocation) => sum.plus(allocation.amount),
                        new Prisma.Decimal(0),
                    );

                    const remainingAmount = debt.amount.minus(paidAmount);

                    if (remainingAmount.lte(0)) {
                        return [];
                    }

                    return [
                        {
                            id: debt.id,
                            remainingAmount,
                        },
                    ];
                });

                const totalDebt = openDebts.reduce(
                    (sum, debt) => sum.plus(debt.remainingAmount),
                    new Prisma.Decimal(0),
                );

                if (amountToApply.gt(totalDebt)) {
                    throw new Error(
                        `O valor informado supera a dívida atual do cliente. Saldo disponível: R$ ${totalDebt.toFixed(2)}.`,
                    );
                }

                const totalTendered = payments.reduce(
                    (sum, payment) => sum.plus(payment.amount.trim()),
                    new Prisma.Decimal(0),
                );

                const cashReceived = payments.reduce(
                    (sum, payment) =>
                        payment.paymentMethod === "CASH"
                            ? sum.plus(payment.amount.trim())
                            : sum,
                    new Prisma.Decimal(0),
                );

                if (totalTendered.lt(amountToApply)) {
                    throw new Error(
                        "O valor recebido não pode ser inferior ao valor que será abatido da dívida.",
                    );
                }

                const changeAmount = totalTendered.minus(amountToApply);

                if (
                    changeAmount.gt(0) &&
                    (cashReceived.lte(0) || changeAmount.gt(cashReceived))
                ) {
                    throw new Error(
                        "O troco só pode ser devolvido em dinheiro. Verifique os valores informados.",
                    );
                }

                const cashApplied = cashReceived.minus(changeAmount);

                const normalizedPayments = payments.flatMap((payment) => {
                    const amount =
                        payment.paymentMethod === "CASH"
                            ? cashApplied
                            : new Prisma.Decimal(payment.amount.trim());

                    if (amount.lte(0)) {
                        return [];
                    }

                    return [
                        {
                            method: payment.paymentMethod,
                            amount,
                        },
                    ];
                });

                const normalizedTotal = normalizedPayments.reduce(
                    (sum, payment) => sum.plus(payment.amount),
                    new Prisma.Decimal(0),
                );

                if (!normalizedTotal.equals(amountToApply)) {
                    throw new Error(
                        "A distribuição dos pagamentos não corresponde ao valor do recebimento.",
                    );
                }

                const creditMovement = await tx.customerAccountMovement.create({
                    data: {
                        type: "CREDIT",
                        amount: amountToApply,
                        description: "Recebimento de dívida",
                        customerId: customer.id,
                        userId: session.user.id,
                        cashRegisterId: cashRegister.id,
                        cashReceived,
                        changeAmount,
                        payments: {
                            create: normalizedPayments,
                        },
                    },
                });

                // Distribui o crédito pelas dívidas mais antigas.
                let remainingToAllocate = amountToApply;

                for (const debt of openDebts) {
                    if (remainingToAllocate.lte(0)) {
                        break;
                    }

                    const allocationAmount = Prisma.Decimal.min(
                        remainingToAllocate,
                        debt.remainingAmount,
                    );

                    if (allocationAmount.lte(0)) {
                        continue;
                    }

                    await tx.customerAccountAllocation.create({
                        data: {
                            creditMovementId: creditMovement.id,
                            debitMovementId: debt.id,
                            amount: allocationAmount,
                        },
                    });

                    remainingToAllocate = remainingToAllocate.minus(
                        allocationAmount,
                    );
                }

                if (remainingToAllocate.gt(0)) {
                    throw new Error(
                        "Não foi possível distribuir todo o recebimento entre as dívidas.",
                    );
                }

                return {
                    movementId: creditMovement.id,
                    amountPaid: amountToApply.toString(),
                    cashReceived: cashReceived.toString(),
                    changeAmount: changeAmount.toString(),
                };
            },
            {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
        );

        revalidatePath("/dashboard/pos");
        revalidatePath("/dashboard/history");
        revalidatePath("/dashboard/fiados");

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
                error:
                    "O caixa ou as dívidas foram alterados durante a operação. Atualize os dados e tente novamente.",
            };
        }

        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : "Não foi possível registrar o recebimento.",
        };
    }
}