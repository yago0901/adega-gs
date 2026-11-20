import "server-only";

import { prisma } from "@/lib/prisma";

export async function loadFiadosListPageData() {
  const customers = await prisma.customer.findMany({
    where: {
      active: true,
      accountMovements: {
        some: {
          type: "DEBIT",
          reversedBy: null,
        },
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      accountMovements: {
        where: {
          type: "DEBIT",
          reversedBy: null,
        },
        select: {
          amount: true,
          allocationsAsDebit: {
            select: {
              amount: true,
            },
          },
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  const customersWithDebt = customers
    .map((customer) => {
      const totalDebt = customer.accountMovements.reduce(
        (total, movement) => {
          const paid = movement.allocationsAsDebit.reduce(
            (sum, allocation) => sum + Number(allocation.amount),
            0,
          );

          return total + Number(movement.amount) - paid;
        },
        0,
      );

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        totalDebt: Math.max(0, totalDebt),
      };
    })
    .filter((customer) => customer.totalDebt > 0);

  const totalOpenDebt = customersWithDebt.reduce(
    (total, customer) => total + customer.totalDebt,
    0,
  );

  return {
    customersWithDebt,
    totalOpenDebt,
  };
}

export async function loadFiadoCustomerDetails(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: {
      id: customerId,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      accountMovements: {
        where: {
          reversedBy: null,
        },
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          createdAt: true,
          deliveryCreditForId: true,
          sale: {
            select: {
              id: true,
              total: true,
              createdAt: true,
            },
          },
          allocationsAsDebit: {
            select: {
              amount: true,
            },
          },
          allocationsAsCredit: {
            select: {
              amount: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!customer) {
    return null;
  }

  const debts = customer.accountMovements
    .filter((movement) => movement.type === "DEBIT")
    .map((movement) => {
      const originalAmount = Number(movement.amount);

      const paidAmount = movement.allocationsAsDebit.reduce(
        (sum, allocation) => sum + Number(allocation.amount),
        0,
      );

      const remainingAmount = Math.max(0, originalAmount - paidAmount);

      return {
        id: movement.id,
        originalAmount,
        paidAmount,
        remainingAmount,
        createdAt: movement.createdAt,
        sale: movement.sale,
      };
    });

  const credits = customer.accountMovements
    .filter((movement) => movement.type === "CREDIT")
    .map((movement) => {
      const originalAmount = Number(movement.amount);
      const allocatedAmount = movement.allocationsAsCredit.reduce(
        (sum, allocation) => sum + Number(allocation.amount),
        0,
      );
      const availableAmount = Math.max(0, originalAmount - allocatedAmount);

      return {
        id: movement.id,
        originalAmount,
        allocatedAmount,
        availableAmount,
        description: movement.description,
        createdAt: movement.createdAt,
        kind: movement.deliveryCreditForId
          ? ("CANCELLATION_CREDIT" as const)
          : ("PAYMENT_CREDIT" as const),
        sale: movement.sale,
      };
    });

  const totalOriginalDebt = debts.reduce(
    (sum, debt) => sum + debt.originalAmount,
    0,
  );

  const totalPaid = debts.reduce((sum, debt) => sum + debt.paidAmount, 0);

  const totalRemaining = debts.reduce(
    (sum, debt) => sum + debt.remainingAmount,
    0,
  );

  const totalAvailableCredit = credits.reduce(
    (sum, credit) => sum + credit.availableAmount,
    0,
  );

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
    },
    debts,
    credits,
    totalOriginalDebt,
    totalPaid,
    totalRemaining,
    totalAvailableCredit,
  };
}