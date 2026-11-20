import "server-only";

import { prisma } from "@/lib/prisma";

export async function loadHistoryPageData() {
  const [sales, cashRegisters, accountCredits] = await Promise.all([
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { name: true },
        },
        customer: {
          select: {
            name: true,
            phone: true,
          },
        },
        items: true,
        payments: true,
        delivery: {
          select: {
            payments: {
              select: {
                type: true,
                method: true,
                amount: true,
              },
            },
          },
        },
        accountMovements: {
          where: { type: "DEBIT" },
          select: { amount: true },
        },
      },
    }),

    prisma.cashRegister.findMany({
      orderBy: { openedAt: "desc" },
      include: {
        openedBy: {
          select: { name: true },
        },
        closedBy: {
          select: { name: true },
        },
        movements: {
          include: {
            user: {
              select: { name: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        sales: {
          include: {
            payments: true,
            delivery: {
              select: {
                payments: {
                  select: {
                    method: true,
                    amount: true,
                  },
                },
              },
            },
            accountMovements: {
              where: { type: "DEBIT" },
              select: { amount: true },
            },
          },
        },
      },
    }),

    prisma.customerAccountMovement.findMany({
      where: {
        type: "CREDIT",
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
        customer: {
          select: {
            name: true,
            phone: true,
          },
        },
        payments: true,
      },
    }),
  ]);

  const formattedSales = sales.map((sale) => {
    const salePayments = sale.payments.map((payment) => ({
      paymentMethod: payment.paymentMethod,
      amount: Number(payment.amount),
    }));

    const deliveryPayments =
      sale.delivery?.payments.map((payment) => ({
        paymentMethod: payment.method,
        amount: Number(payment.amount),
        deliveryType: payment.type as "PREPAID" | "TO_COLLECT",
      })) ?? [];

    return {
      id: sale.id,
      status: sale.status,
      isDelivery: Boolean(sale.delivery),
      payments: salePayments,
      deliveryPayments,
      accountAmount: sale.accountMovements.reduce(
        (sum, movement) => sum + Number(movement.amount),
        0,
      ),
      total: Number(sale.total),
      deliveryFee: Number(sale.deliveryFee),
      cashReceived: Number(sale.cashReceived),
      changeAmount: Number(sale.changeAmount),
      createdAt: sale.createdAt.toISOString(),
      cancelledAt: sale.cancelledAt?.toISOString() ?? null,
      employee: sale.user.name,
      items: sale.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        productCode: item.productCode,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
      customer: sale.customer
        ? {
            name: sale.customer.name,
            phone: sale.customer.phone,
          }
        : null,
    };
  });

  const formattedDebtPayments = accountCredits.map((movement) => ({
    id: movement.id,
    kind: movement.deliveryCreditForId
      ? ("CANCELLATION_CREDIT" as const)
      : ("DEBT_RECEIPT" as const),
    description: movement.description,
    amount: Number(movement.amount),
    createdAt: movement.createdAt.toISOString(),
    employee: movement.user.name,
    customer: {
      name: movement.customer.name,
      phone: movement.customer.phone,
    },
    payments: movement.payments.map((payment) => ({
      paymentMethod: payment.method,
      amount: Number(payment.amount),
    })),
    cashReceived: Number(movement.cashReceived),
    changeAmount: Number(movement.changeAmount),
  }));

  const formattedCashRegisters = cashRegisters.map((register) => ({
    id: register.id,
    status: register.status,
    openingAmount: Number(register.openingAmount),
    expectedAmount:
      register.expectedAmount !== null
        ? Number(register.expectedAmount)
        : null,
    countedAmount:
      register.countedAmount !== null
        ? Number(register.countedAmount)
        : null,
    difference:
      register.difference !== null ? Number(register.difference) : null,
    openedAt: register.openedAt.toISOString(),
    closedAt: register.closedAt?.toISOString() ?? null,
    openedBy: register.openedBy.name,
    closedBy: register.closedBy?.name ?? null,
    movements: register.movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      amount: Number(movement.amount),
      description: movement.description,
      createdAt: movement.createdAt.toISOString(),
      employee: movement.user.name,
    })),
    sales: register.sales.map((sale) => {
      const salePayments = sale.payments.map((payment) => ({
        paymentMethod: payment.paymentMethod,
        amount: Number(payment.amount),
      }));

      const deliveryPayments =
        sale.delivery?.payments.map((payment) => ({
          paymentMethod: payment.method,
          amount: Number(payment.amount),
        })) ?? [];

      return {
        id: sale.id,
        status: sale.status,
        total: Number(sale.total),
        cashReceived: Number(sale.cashReceived),
        changeAmount: Number(sale.changeAmount),
        payments:
          salePayments.length > 0 ? salePayments : deliveryPayments,
        accountAmount: sale.accountMovements.reduce(
          (sum, movement) => sum + Number(movement.amount),
          0,
        ),
        createdAt: sale.createdAt.toISOString(),
      };
    }),
  }));

  return {
    sales: formattedSales,
    cashRegisters: formattedCashRegisters,
    debtPayments: formattedDebtPayments,
  };
}

export async function loadCashRegisterDetails(cashRegisterId: string) {
  const register = await prisma.cashRegister.findUnique({
    where: { id: cashRegisterId },
    include: {
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
      movements: {
        include: {
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      sales: {
        include: {
          payments: true,
          delivery: {
            select: {
              payments: {
                select: { method: true, amount: true },
              },
            },
          },
          accountMovements: {
            where: { type: "DEBIT" },
            select: { amount: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!register) {
    return null;
  }

  return {
    id: register.id,
    status: register.status,
    openingAmount: Number(register.openingAmount),
    expectedAmount:
      register.expectedAmount !== null
        ? Number(register.expectedAmount)
        : null,
    countedAmount:
      register.countedAmount !== null
        ? Number(register.countedAmount)
        : null,
    difference:
      register.difference !== null ? Number(register.difference) : null,
    openedAt: register.openedAt.toISOString(),
    closedAt: register.closedAt?.toISOString() ?? null,
    openedBy: register.openedBy.name,
    closedBy: register.closedBy?.name ?? null,
    movements: register.movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      amount: Number(movement.amount),
      description: movement.description,
      createdAt: movement.createdAt.toISOString(),
      employee: movement.user.name,
    })),
    sales: register.sales.map((sale) => {
      const salePayments = sale.payments.map((payment) => ({
        paymentMethod: payment.paymentMethod,
        amount: Number(payment.amount),
      }));
      const deliveryPayments =
        sale.delivery?.payments.map((payment) => ({
          paymentMethod: payment.method,
          amount: Number(payment.amount),
        })) ?? [];

      return {
        id: sale.id,
        status: sale.status,
        total: Number(sale.total),
        cashReceived: Number(sale.cashReceived),
        changeAmount: Number(sale.changeAmount),
        payments: salePayments.length > 0 ? salePayments : deliveryPayments,
        accountAmount: sale.accountMovements.reduce(
          (sum, movement) => sum + Number(movement.amount),
          0,
        ),
        createdAt: sale.createdAt.toISOString(),
      };
    }),
  };
}
