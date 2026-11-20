import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildPaginatedResult,
  normalizeListQuery,
  type ListQueryInput,
  type PaginatedResult,
} from "@/lib/list-query";

export type ProductListItem = {
  id: string;
  name: string;
  code: string;
  imageUrl: string | null;
  type: string;
  salePrice: number;
  categoryName: string;
  stockQuantity: number;
  minStock: number;
  unit: string;
  hasStockItem: boolean;
  isLow: boolean;
};

export async function listProducts(
  input: ListQueryInput = {},
): Promise<PaginatedResult<ProductListItem>> {
  const query = normalizeListQuery({
    ...input,
    sortBy: input.sortBy ?? "name",
    sortDir: input.sortDir ?? "asc",
  });

  const where: Prisma.ProductWhereInput = {
    active: true,
  };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { code: { contains: query.search, mode: "insensitive" } },
      { category: { name: { contains: query.search, mode: "insensitive" } } },
    ];
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    query.sortBy === "code"
      ? { code: query.sortDir }
      : query.sortBy === "salePrice"
        ? { salePrice: query.sortDir }
        : query.sortBy === "category"
          ? { category: { name: query.sortDir } }
          : { name: query.sortDir };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: {
        category: true,
        stockItem: {
          include: { balance: true },
        },
      },
      orderBy,
      skip: query.skip,
      take: query.take,
    }),
  ]);

  return buildPaginatedResult(
    products.map((product) => {
      const stockQuantity =
        product.stockItem?.balance?.quantity.toNumber() ?? 0;
      const minStock = product.stockItem?.minStock.toNumber() ?? 0;
      const hasStockItem = product.stockItem !== null;

      return {
        id: product.id,
        name: product.name,
        code: product.code,
        imageUrl: product.imageUrl,
        type: product.type,
        salePrice: Number(product.salePrice),
        categoryName: product.category.name,
        stockQuantity,
        minStock,
        unit: product.stockItem?.unit ?? "UNIT",
        hasStockItem,
        isLow: hasStockItem && stockQuantity <= minStock,
      };
    }),
    total,
    query.page,
    query.pageSize,
  );
}
