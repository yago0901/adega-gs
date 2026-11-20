import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildPaginatedResult,
  normalizeListQuery,
  type ListQueryInput,
  type PaginatedResult,
} from "@/lib/list-query";

export type CustomerListItem = {
  id: string;
  name: string;
  phone: string;
  addressesCount: number;
  defaultAddress: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    deliveryFee: number;
  } | null;
};

export async function listCustomers(
  input: ListQueryInput = {},
): Promise<PaginatedResult<CustomerListItem>> {
  const query = normalizeListQuery({
    ...input,
    sortBy: input.sortBy ?? "name",
    sortDir: input.sortDir ?? "asc",
  });

  const where: Prisma.CustomerWhereInput = {
    active: true,
  };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { phone: { contains: query.search, mode: "insensitive" } },
      {
        addresses: {
          some: {
            OR: [
              { city: { contains: query.search, mode: "insensitive" } },
              { street: { contains: query.search, mode: "insensitive" } },
              { neighborhood: { contains: query.search, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  const orderBy: Prisma.CustomerOrderByWithRelationInput =
    query.sortBy === "phone"
      ? { phone: query.sortDir }
      : { name: query.sortDir };

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include: {
        addresses: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        },
      },
      orderBy,
      skip: query.skip,
      take: query.take,
    }),
  ]);

  return buildPaginatedResult(
    customers.map((customer) => {
      const defaultAddress =
        customer.addresses.find((address) => address.isDefault) ??
        customer.addresses[0] ??
        null;

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        addressesCount: customer.addresses.length,
        defaultAddress: defaultAddress
          ? {
              street: defaultAddress.street,
              number: defaultAddress.number,
              neighborhood: defaultAddress.neighborhood,
              city: defaultAddress.city,
              state: defaultAddress.state,
              deliveryFee: Number(defaultAddress.deliveryFee),
            }
          : null,
      };
    }),
    total,
    query.page,
    query.pageSize,
  );
}
