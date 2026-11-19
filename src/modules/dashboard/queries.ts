import "server-only";

import { prisma } from "@/lib/prisma";

export type DashboardCurrentUser = {
  role: string;
  active: boolean;
  accesses: { module: string }[];
};

export async function getDashboardCurrentUser(
  userId: string,
): Promise<DashboardCurrentUser | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      active: true,
      accesses: {
        select: {
          module: true,
        },
      },
    },
  });
}

export type LowStockProduct = {
  name: string;
  unit: string;
  minStock: number;
  quantity: number;
  purchaseCost: number;
};

export type DashboardAdminMetrics = {
  activeProducts: number;
  salesToday: number;
  lowStockProducts: LowStockProduct[];
  inventoryCost: number;
};

export async function getDashboardAdminMetrics(): Promise<DashboardAdminMetrics> {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });

  const startOfDay = new Date(`${today}T00:00:00-03:00`);

  const [productsCount, salesCount, stockItems] = await Promise.all([
    prisma.product.count({
      where: { active: true },
    }),

    prisma.stockMovement.count({
      where: {
        type: "SALE",
        createdAt: { gte: startOfDay },
      },
    }),

    prisma.stockItem.findMany({
      where: { active: true },
      select: {
        name: true,
        unit: true,
        minStock: true,
        purchaseCost: true,
        balance: {
          select: {
            quantity: true,
          },
        },
        packagings: {
          select: {
            conversionFactor: true,
            balance: {
              select: {
                quantity: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const stockSummary = stockItems.map((item) => {
    const looseQuantity = item.balance?.quantity.toNumber() ?? 0;

    const packagedQuantity = item.packagings.reduce((total, packaging) => {
      const quantity = packaging.balance?.quantity.toNumber() ?? 0;

      return total + quantity * packaging.conversionFactor.toNumber();
    }, 0);

    const totalQuantity = looseQuantity + packagedQuantity;

    return {
      name: item.name,
      unit: item.unit,
      minStock: item.minStock.toNumber(),
      quantity: totalQuantity,
      purchaseCost: item.purchaseCost.toNumber(),
    };
  });

  const lowStockProducts = stockSummary
    .filter((item) => item.quantity <= item.minStock)
    .sort((a, b) => a.quantity - b.quantity);

  const inventoryCost = stockSummary.reduce(
    (total, item) => total + item.quantity * item.purchaseCost,
    0,
  );

  return {
    activeProducts: productsCount,
    salesToday: salesCount,
    lowStockProducts,
    inventoryCost,
  };
}