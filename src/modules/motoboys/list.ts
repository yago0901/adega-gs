import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildPaginatedResult,
  normalizeListQuery,
  type ListQueryInput,
  type PaginatedResult,
} from "@/lib/list-query";

export type MotoboyListItem = {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  active: boolean;
};

export type MotoboyListInput = ListQueryInput & {
  active?: "ALL" | "ACTIVE" | "INACTIVE";
};

export async function listMotoboys(
  input: MotoboyListInput = {},
): Promise<PaginatedResult<MotoboyListItem>> {
  const query = normalizeListQuery({
    ...input,
    sortBy: input.sortBy ?? "name",
    sortDir: input.sortDir ?? "asc",
  });

  const where: Prisma.MotoboyWhereInput = {};

  if (input.active === "ACTIVE") {
    where.active = true;
  } else if (input.active === "INACTIVE") {
    where.active = false;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { phone: { contains: query.search, mode: "insensitive" } },
      { notes: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.MotoboyOrderByWithRelationInput[] =
    query.sortBy === "phone"
      ? [{ phone: query.sortDir }]
      : query.sortBy === "active"
        ? [{ active: query.sortDir }, { name: "asc" }]
        : [{ name: query.sortDir }];

  const [total, motoboys] = await Promise.all([
    prisma.motoboy.count({ where }),
    prisma.motoboy.findMany({
      where,
      orderBy,
      skip: query.skip,
      take: query.take,
      select: {
        id: true,
        name: true,
        phone: true,
        notes: true,
        active: true,
      },
    }),
  ]);

  return buildPaginatedResult(motoboys, total, query.page, query.pageSize);
}
