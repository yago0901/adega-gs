import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildPaginatedResult,
  normalizeListQuery,
  type ListQueryInput,
  type PaginatedResult,
} from "@/lib/list-query";

export type EmployeeListItem = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  active: boolean;
  createdAt: string;
  accesses: {
    module: string;
    canManageCashRegister: boolean;
  }[];
};

export type EmployeeListInput = ListQueryInput & {
  active?: "ALL" | "ACTIVE" | "INACTIVE";
};

export async function listEmployees(
  input: EmployeeListInput = {},
): Promise<PaginatedResult<EmployeeListItem>> {
  const query = normalizeListQuery({
    ...input,
    sortBy: input.sortBy ?? "name",
    sortDir: input.sortDir ?? "asc",
  });

  const where: Prisma.UserWhereInput = {
    role: "EMPLOYEE",
  };

  if (input.active === "ACTIVE") {
    where.active = true;
  } else if (input.active === "INACTIVE") {
    where.active = false;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { username: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.UserOrderByWithRelationInput =
    query.sortBy === "email"
      ? { email: query.sortDir }
      : query.sortBy === "createdAt"
        ? { createdAt: query.sortDir }
        : query.sortBy === "active"
          ? { active: query.sortDir }
          : { name: query.sortDir };

  const [total, employees] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        active: true,
        createdAt: true,
        accesses: {
          select: {
            module: true,
            canManageCashRegister: true,
          },
        },
      },
      orderBy,
      skip: query.skip,
      take: query.take,
    }),
  ]);

  return buildPaginatedResult(
    employees.map((employee) => ({
      ...employee,
      createdAt: employee.createdAt.toISOString(),
    })),
    total,
    query.page,
    query.pageSize,
  );
}
