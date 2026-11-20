import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildPaginatedResult,
  normalizeListQuery,
  type ListQueryInput,
  type PaginatedResult,
} from "@/lib/list-query";

export type PosProductListItem = {
  id: string;
  code: string;
  name: string;
  imageUrl: string | null;
  type: "STANDARD" | "SUPPLY" | "FRACTIONAL" | "COMBO";
  salePrice: string;
  unit: string;
  stock: string;
  canOpenFromPackaging: boolean;
  composition: {
    groups: {
      id: string;
      name: string;
      required: boolean;
      options: {
        id: string;
        stockItemId: string;
        name: string;
        unit: string;
        quantity: string;
        available: string;
      }[];
    }[];
  } | null;
};

const productInclude = {
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
  composition: {
    include: {
      groups: {
        orderBy: {
          position: "asc" as const,
        },
        include: {
          options: {
            orderBy: {
              position: "asc" as const,
            },
            include: {
              stockItem: {
                include: {
                  balance: true,
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
        include: {
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
          composition: {
            include: {
              groups: {
                orderBy: {
                  position: "asc" as const,
                },
                include: {
                  options: {
                    orderBy: {
                      position: "asc" as const,
                    },
                    include: {
                      stockItem: {
                        include: {
                          balance: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  packagingParentProducts: {
    select: {
      id: true,
    },
  },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

function getDirectStock(
  stockItem: ProductWithRelations["stockItem"],
  stockPackaging: ProductWithRelations["stockPackaging"],
) {
  if (stockPackaging) {
    return Number(stockPackaging.balance?.quantity.toString() ?? 0);
  }

  return Number(stockItem?.balance?.quantity.toString() ?? 0);
}

function getOptionAvailability(
  option: NonNullable<
    ProductWithRelations["composition"]
  >["groups"][number]["options"][number],
) {
  const required = Number(option.quantity.toString());
  const available = Number(
    option.stockItem.balance?.quantity.toString() ?? 0,
  );

  if (required <= 0) return 0;

  return Math.max(0, Math.floor(available / required));
}

function getCompositionAvailability(
  groups: NonNullable<ProductWithRelations["composition"]>["groups"],
) {
  const requiredGroups = groups.filter((group) => group.minSelections > 0);

  if (requiredGroups.length === 0) return 0;

  const groupAvailabilities = requiredGroups.map((group) => {
    if (group.options.length === 0) return 0;
    return Math.max(...group.options.map(getOptionAvailability));
  });

  return Math.min(...groupAvailabilities);
}

function formatPosProduct(product: ProductWithRelations): PosProductListItem {
  let stock = 0;

  if (product.type === "FRACTIONAL") {
    stock = getCompositionAvailability(product.composition?.groups ?? []);
  } else if (product.type === "COMBO") {
    if (product.comboItems.length > 0) {
      stock = Math.max(
        0,
        Math.floor(
          Math.min(
            ...product.comboItems.map((item) => {
              const component = item.componentProduct;
              const required = Number(item.quantity.toString());

              if (required <= 0) return 0;
              if (component.type === "COMBO") return 0;

              const available =
                component.type === "FRACTIONAL"
                  ? getCompositionAvailability(
                      component.composition?.groups ?? [],
                    )
                  : getDirectStock(
                      component.stockItem,
                      component.stockPackaging,
                    );

              return available / required;
            }),
          ),
        ),
      );
    }
  } else {
    stock = getDirectStock(product.stockItem, product.stockPackaging);
  }

  return {
    id: product.id,
    code: product.code,
    name: product.name,
    imageUrl: product.imageUrl,
    type: product.type as PosProductListItem["type"],
    salePrice: product.salePrice.toString(),
    unit: "UNIT",
    stock: String(stock),
    canOpenFromPackaging:
      Boolean(product.stockPackaging) ||
      product.packagingParentProducts.length > 0,
    composition: product.composition
      ? {
          groups: product.composition.groups.map((group) => ({
            id: group.id,
            name: group.name,
            required: group.minSelections > 0,
            options: group.options.map((option) => ({
              id: option.id,
              stockItemId: option.stockItemId,
              name: option.stockItem.name,
              unit: option.stockItem.unit,
              quantity: option.quantity.toString(),
              available: String(getOptionAvailability(option)),
            })),
          })),
        }
      : null,
  };
}

export async function searchPosProducts(
  input: ListQueryInput = {},
): Promise<PaginatedResult<PosProductListItem>> {
  const query = normalizeListQuery({
    ...input,
    sortBy: input.sortBy ?? "name",
    sortDir: input.sortDir ?? "asc",
  });

  const where: Prisma.ProductWhereInput = {
    active: true,
    type: {
      in: ["STANDARD", "SUPPLY", "FRACTIONAL", "COMBO"],
    },
  };

  if (query.search) {
    where.OR = [
      {
        name: {
          contains: query.search,
          mode: "insensitive",
        },
      },
      {
        code: {
          contains: query.search,
          mode: "insensitive",
        },
      },
    ];
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    query.sortBy === "code"
      ? { code: query.sortDir }
      : query.sortBy === "salePrice"
        ? { salePrice: query.sortDir }
        : { name: query.sortDir };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy,
      skip: query.skip,
      take: query.take,
    }),
  ]);

  return buildPaginatedResult(
    products.map(formatPosProduct),
    total,
    query.page,
    query.pageSize,
  );
}
