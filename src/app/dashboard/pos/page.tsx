
import { Suspense } from "react";

import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";

import PosClient from "./pos-client";

export const metadata = {
  title: "Frente de Caixa | Adega GS",
};

type PosProductType =
  | "STANDARD"
  | "SUPPLY"
  | "FRACTIONAL"
  | "COMBO";

function getDirectStock(
  stockItem: {
    balance: { quantity: { toString(): string } } | null;
  } | null,
  stockPackaging: {
    balance: { quantity: { toString(): string } } | null;
  } | null,
) {
  if (stockPackaging) {
    return Number(stockPackaging.balance?.quantity.toString() ?? 0);
  }

  return Number(stockItem?.balance?.quantity.toString() ?? 0);
}

function getRecipeAvailability(
  recipeItems: {
    quantity: { toString(): string };
    stockItem: {
      balance: { quantity: { toString(): string } } | null;
    };
  }[],
) {
  if (recipeItems.length === 0) return 0;

  return Math.max(
    0,
    Math.floor(
      Math.min(
        ...recipeItems.map((item) => {
          const required = Number(item.quantity.toString());
          const available = Number(
            item.stockItem.balance?.quantity.toString() ?? 0,
          );

          if (required <= 0) return 0;

          return available / required;
        }),
      ),
    ),
  );
}

export default function PosPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-gray-500">
          Carregando frente de caixa...
        </div>
      }
    >
      <PosContent />
    </Suspense>
  );
}

async function PosContent() {
  await requireModuleAccess("POS");

  const products = await prisma.product.findMany({
    where: {
      active: true,
      type: {
        in: ["STANDARD", "SUPPLY", "FRACTIONAL", "COMBO"],
      },
    },
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
      recipeItems: {
        include: {
          stockItem: {
            include: {
              balance: true,
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
              recipeItems: {
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
    orderBy: {
      name: "asc",
    },
  });

  const formattedProducts = products.map((product) => {
    let stock = 0;

    if (product.type === "FRACTIONAL") {
      stock = getRecipeAvailability(product.recipeItems);
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

                const available =
                  component.type === "FRACTIONAL"
                    ? getRecipeAvailability(component.recipeItems)
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
      stock = getDirectStock(
        product.stockItem,
        product.stockPackaging,
      );
    }

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      type: product.type as PosProductType,
      salePrice: product.salePrice.toString(),
      unit: "UNIT",
      stock: String(stock),
    };
  });

  return <PosClient products={formattedProducts} />;
}
