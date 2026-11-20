import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildPaginatedResult,
  normalizeListQuery,
  type ListQueryInput,
  type PaginatedResult,
} from "@/lib/list-query";

export type FiadoBalanceFilter = "DEBT" | "CREDIT" | "ALL";

export type FiadoListInput = ListQueryInput & {
  balanceFilter?: FiadoBalanceFilter;
};

export type FiadoListItem = {
  id: string;
  name: string;
  phone: string;
  totalDebt: number;
  availableCredit: number;
};

function computeTotalDebt(
  movements: Array<{
    amount: Prisma.Decimal;
    allocationsAsDebit: Array<{ amount: Prisma.Decimal }>;
  }>,
) {
  return movements.reduce((total, movement) => {
    const paid = movement.allocationsAsDebit.reduce(
      (sum, allocation) => sum + Number(allocation.amount),
      0,
    );
    return total + Number(movement.amount) - paid;
  }, 0);
}

function computeAvailableCredit(
  movements: Array<{
    amount: Prisma.Decimal;
    allocationsAsCredit: Array<{ amount: Prisma.Decimal }>;
  }>,
) {
  return movements.reduce((total, movement) => {
    const allocated = movement.allocationsAsCredit.reduce(
      (sum, allocation) => sum + Number(allocation.amount),
      0,
    );
    return total + Math.max(0, Number(movement.amount) - allocated);
  }, 0);
}

export async function listFiados(
  input: FiadoListInput = {},
): Promise<
  PaginatedResult<FiadoListItem> & {
    totalOpenDebt: number;
    customersWithDebtCount: number;
  }
> {
  const balanceFilter: FiadoBalanceFilter = input.balanceFilter ?? "DEBT";

  const query = normalizeListQuery({
    ...input,
    sortBy: input.sortBy ?? "totalDebt",
    sortDir: input.sortDir ?? "desc",
  });

  const movementSome: Prisma.CustomerAccountMovementWhereInput = {
    reversedBy: null,
    ...(balanceFilter === "DEBT"
      ? { type: "DEBIT" }
      : balanceFilter === "CREDIT"
        ? { type: "CREDIT" }
        : {}),
  };

  const where: Prisma.CustomerWhereInput = {
    active: true,
    accountMovements: {
      some: movementSome,
    },
  };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { phone: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    select: {
      id: true,
      name: true,
      phone: true,
      accountMovements: {
        where: {
          reversedBy: null,
          type: { in: ["DEBIT", "CREDIT"] },
        },
        select: {
          type: true,
          amount: true,
          allocationsAsDebit: {
            select: { amount: true },
          },
          allocationsAsCredit: {
            select: { amount: true },
          },
        },
      },
    },
  });

  let items = customers
    .map((customer) => {
      const debitMovements = customer.accountMovements.filter(
        (movement) => movement.type === "DEBIT",
      );
      const creditMovements = customer.accountMovements.filter(
        (movement) => movement.type === "CREDIT",
      );

      const totalDebt = Math.max(0, computeTotalDebt(debitMovements));
      const availableCredit = computeAvailableCredit(creditMovements);

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        totalDebt,
        availableCredit,
      };
    })
    .filter((customer) => {
      if (balanceFilter === "CREDIT") {
        return customer.availableCredit > 0;
      }
      if (balanceFilter === "ALL") {
        return customer.totalDebt > 0 || customer.availableCredit > 0;
      }
      return customer.totalDebt > 0;
    });

  items.sort((a, b) => {
    if (query.sortBy === "name") {
      return query.sortDir === "asc"
        ? a.name.localeCompare(b.name, "pt-BR")
        : b.name.localeCompare(a.name, "pt-BR");
    }
    if (query.sortBy === "phone") {
      return query.sortDir === "asc"
        ? a.phone.localeCompare(b.phone, "pt-BR")
        : b.phone.localeCompare(a.phone, "pt-BR");
    }
    if (query.sortBy === "availableCredit") {
      return query.sortDir === "asc"
        ? a.availableCredit - b.availableCredit
        : b.availableCredit - a.availableCredit;
    }
    return query.sortDir === "asc"
      ? a.totalDebt - b.totalDebt
      : b.totalDebt - a.totalDebt;
  });

  const debtItems = items.filter((item) => item.totalDebt > 0);
  const totalOpenDebt = debtItems.reduce((sum, item) => sum + item.totalDebt, 0);
  const customersWithDebtCount = debtItems.length;
  const pageItems = items.slice(query.skip, query.skip + query.take);

  return {
    ...buildPaginatedResult(pageItems, items.length, query.page, query.pageSize),
    totalOpenDebt,
    customersWithDebtCount,
  };
}