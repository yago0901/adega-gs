import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildPaginatedResult,
  normalizeListQuery,
  type ListQueryInput,
  type PaginatedResult,
} from "@/lib/list-query";

export type FiadoListItem = {
  id: string;
  name: string;
  phone: string;
  totalDebt: number;
};

export async function listFiados(
  input: ListQueryInput = {},
): Promise<
  PaginatedResult<FiadoListItem> & {
    totalOpenDebt: number;
    customersWithDebtCount: number;
  }
> {
  const query = normalizeListQuery({
    ...input,
    sortBy: input.sortBy ?? "totalDebt",
    sortDir: input.sortDir ?? "desc",
  });

  const where: Prisma.CustomerWhereInput = {
    active: true,
    accountMovements: {
      some: {
        type: "DEBIT",
        reversedBy: null,
      },
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
          type: "DEBIT",
          reversedBy: null,
        },
        select: {
          amount: true,
          allocationsAsDebit: {
            select: { amount: true },
          },
        },
      },
    },
  });

  let items = customers
    .map((customer) => {
      const totalDebt = customer.accountMovements.reduce((total, movement) => {
        const paid = movement.allocationsAsDebit.reduce(
          (sum, allocation) => sum + Number(allocation.amount),
          0,
        );
        return total + Number(movement.amount) - paid;
      }, 0);

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        totalDebt: Math.max(0, totalDebt),
      };
    })
    .filter((customer) => customer.totalDebt > 0);

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
    return query.sortDir === "asc"
      ? a.totalDebt - b.totalDebt
      : b.totalDebt - a.totalDebt;
  });

  const totalOpenDebt = items.reduce((sum, item) => sum + item.totalDebt, 0);
  const customersWithDebtCount = items.length;
  const pageItems = items.slice(query.skip, query.skip + query.take);

  return {
    ...buildPaginatedResult(
      pageItems,
      customersWithDebtCount,
      query.page,
      query.pageSize,
    ),
    totalOpenDebt,
    customersWithDebtCount,
  };
}
