import "server-only";

import { prisma } from "@/lib/prisma";

export async function listActiveProductsWithStockDetails() {
  return prisma.product.findMany({
    where: {
      active: true,
      stockItemId: {
        not: null,
      },
    },
    include: {
      category: true,
      stockItem: {
        include: {
          balance: true,
        },
      },
      stockPackaging: {
        include: {
          balance: true,
        },
      },
      packagingChildProduct: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function listRecentStockMovements(take = 200) {
  return prisma.stockMovement.findMany({
    include: {
      stockItem: {
        select: {
          name: true,
        },
      },
      stockPackaging: {
        select: {
          name: true,
        },
      },
      user: {
        select: {
          name: true,
          username: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take,
  });
}