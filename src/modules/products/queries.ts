import "server-only";

import { prisma } from "@/lib/prisma";

export async function listActiveProductsWithCategoryAndStockBalance() {
  return prisma.product.findMany({
    where: { active: true },
    include: {
      category: true,
      stockItem: {
        include: {
          balance: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function listCategoriesByName() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
  });
}

export async function listActiveStockItemsForProductForm() {
  return prisma.stockItem.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      unit: true,
    },
  });
}

export async function listStandardSupplyProductsWithPackagingMeta() {
  return prisma.product.findMany({
    where: {
      active: true,
      type: { in: ["STANDARD", "SUPPLY"] },
      stockItemId: { not: null },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      stockItem: {
        select: {
          unit: true,
        },
      },
      stockPackagingId: true,
      packagingChildProductId: true,
      packagingParentProducts: {
        select: {
          id: true,
        },
      },
    },
  });
}

export async function listProductsForCategoryManager(categoryIds: string[]) {
  return prisma.product.findMany({
    where: {
      categoryId: {
        in: categoryIds,
      },
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      categoryId: true,
    },
  });
}

export async function getProductByIdForEdit(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      stockItem: {
        select: {
          id: true,
          unit: true,
          minStock: true,
          purchaseCost: true,
        },
      },
      stockPackaging: {
        select: {
          name: true,
          conversionFactor: true,
        },
      },
      packagingChildProduct: {
        select: {
          id: true,
          name: true,
        },
      },
      packagingParentProducts: {
        select: {
          id: true,
          name: true,
          packagingChildQuantity: true,
        },
      },
      composition: {
        include: {
          groups: {
            orderBy: {
              position: "asc",
            },
            include: {
              options: {
                orderBy: {
                  position: "asc",
                },
                include: {
                  stockItem: {
                    select: {
                      id: true,
                      name: true,
                      unit: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      comboItems: {
        include: {
          componentProduct: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });
}

export async function listStandardSupplyProductsForCombo() {
  return prisma.product.findMany({
    where: {
      active: true,
      type: { in: ["STANDARD", "SUPPLY"] },
      stockItemId: { not: null },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });
}

export async function getNewProductPageData() {
  const [categories, stockItems, products] = await Promise.all([
    listCategoriesByName(),
    listActiveStockItemsForProductForm(),
    listStandardSupplyProductsWithPackagingMeta(),
  ]);

  const categoryProducts = await listProductsForCategoryManager(
    categories.map((category) => category.id),
  );

  return {
    categories,
    stockItems,
    products,
    categoryProducts,
  };
}

export async function getEditProductPageData(id: string) {
  const [product, categories, stockItems, products] = await Promise.all([
    getProductByIdForEdit(id),
    listCategoriesByName(),
    listActiveStockItemsForProductForm(),
    listStandardSupplyProductsForCombo(),
  ]);

  return {
    product,
    categories,
    stockItems,
    products,
  };
}