import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildPaginatedResult,
  normalizeListQuery,
  parseDateRange,
  type ListQueryInput,
  type PaginatedResult,
} from "@/lib/list-query";

export type StockListItem = {
  id: string;
  name: string;
  code: string;
  categoryName: string;
  closedQuantity: number;
  openQuantity: number;
  minStock: number;
  unit: string;
  isLow: boolean;
  canOpenPackaging: boolean;
  canOpenBottle: boolean;
  stockItemId: string | null;
  stockPackagingId: string | null;
};

export type StockMovementListItem = {
  id: string;
  createdAt: string;
  type: string;
  quantity: number;
  reason: string | null;
  itemName: string;
  employee: string;
};

export type StockListInput = ListQueryInput & {
  stockStatus?: "ALL" | "LOW" | "OK";
  movementType?: string;
};

export async function listStockItems(
  input: StockListInput = {},
): Promise<PaginatedResult<StockListItem>> {
  const query = normalizeListQuery({
    ...input,
    sortBy: input.sortBy ?? "name",
    sortDir: input.sortDir ?? "asc",
  });

  const where: Prisma.ProductWhereInput = {
    active: true,
    stockItemId: { not: null },
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
      : query.sortBy === "category"
        ? { category: { name: query.sortDir } }
        : { name: query.sortDir };

  const products = await prisma.product.findMany({
    where,
    include: {
      category: true,
      stockItem: {
        include: { balance: true },
      },
      stockPackaging: {
        include: { balance: true },
      },
      packagingChildProduct: true,
    },
    orderBy,
  });

  let items = products.map((product) => {
    const stockQuantity = Number(
      product.stockItem?.balance?.quantity.toString() ?? 0,
    );
    const packaging = product.stockPackaging;
    const isCommercialPackaging = Boolean(product.packagingChildProduct);

    // Fardo/caixa (unidades): saldo fechado fica no stockItem.
    // Garrafa (ml): fechado fica no stockPackaging; aberto no stockItem.
    const closedQuantity = packaging
      ? Number(packaging.balance?.quantity.toString() ?? 0)
      : isCommercialPackaging
        ? stockQuantity
        : 0;

    const openQuantity = isCommercialPackaging ? 0 : stockQuantity;
    const minStock = Number(product.stockItem?.minStock.toString() ?? 0);
    const available = isCommercialPackaging
      ? closedQuantity
      : openQuantity + closedQuantity;

    return {
      id: product.id,
      name: product.name,
      code: product.code,
      categoryName: product.category.name,
      closedQuantity,
      openQuantity,
      minStock,
      unit: product.stockItem?.unit ?? "UNIT",
      isLow: available <= minStock,
      canOpenPackaging: isCommercialPackaging,
      canOpenBottle:
        Boolean(packaging) &&
        !isCommercialPackaging &&
        product.stockItem?.unit === "ML",
      stockItemId: product.stockItemId,
      stockPackagingId: product.stockPackagingId,
    } satisfies StockListItem;
  });

  if (input.stockStatus === "LOW") {
    items = items.filter((item) => item.isLow);
  } else if (input.stockStatus === "OK") {
    items = items.filter((item) => !item.isLow);
  }

  if (query.sortBy === "stock") {
    items.sort((a, b) => {
      const left = a.closedQuantity > 0 ? a.closedQuantity : a.openQuantity;
      const right = b.closedQuantity > 0 ? b.closedQuantity : b.openQuantity;
      return query.sortDir === "asc" ? left - right : right - left;
    });
  }

  const total = items.length;
  const pageItems = items.slice(query.skip, query.skip + query.take);

  return buildPaginatedResult(pageItems, total, query.page, query.pageSize);
}

export async function listStockMovements(
  input: StockListInput = {},
): Promise<PaginatedResult<StockMovementListItem>> {
  const query = normalizeListQuery({
    ...input,
    sortBy: input.sortBy ?? "createdAt",
    sortDir: input.sortDir ?? "desc",
  });

  const createdAt = parseDateRange(query.startDate, query.endDate);
  const where: Prisma.StockMovementWhereInput = {};

  if (createdAt) {
    where.createdAt = createdAt;
  }

  if (input.movementType && input.movementType !== "ALL") {
    where.type = input.movementType as
      | "INITIAL"
      | "PURCHASE"
      | "SALE"
      | "LOSS"
      | "OPEN_PACKAGING"
      | "ADJUSTMENT"
      | "REVERSAL";
  }

  if (query.search) {
    where.OR = [
      { reason: { contains: query.search, mode: "insensitive" } },
      { stockItem: { name: { contains: query.search, mode: "insensitive" } } },
      {
        stockPackaging: {
          name: { contains: query.search, mode: "insensitive" },
        },
      },
      { user: { name: { contains: query.search, mode: "insensitive" } } },
    ];
  }

  const orderBy: Prisma.StockMovementOrderByWithRelationInput =
    query.sortBy === "quantity"
      ? { quantity: query.sortDir }
      : query.sortBy === "type"
        ? { type: query.sortDir }
        : { createdAt: query.sortDir };

  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: {
        stockItem: { select: { name: true } },
        stockPackaging: { select: { name: true } },
        user: { select: { name: true, username: true } },
      },
      orderBy,
      skip: query.skip,
      take: query.take,
    }),
  ]);

  return buildPaginatedResult(
    movements.map((movement) => ({
      id: movement.id,
      createdAt: movement.createdAt.toISOString(),
      type: movement.type,
      quantity: Number(movement.quantity),
      reason: movement.reason,
      itemName:
        movement.stockPackaging?.name ??
        movement.stockItem?.name ??
        "Item",
      employee: movement.user?.name ?? "Sistema",
    })),
    total,
    query.page,
    query.pageSize,
  );
}
