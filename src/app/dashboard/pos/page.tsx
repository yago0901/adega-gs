
import { Suspense } from "react";

import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";

import PosClient from "./pos-client";

export const metadata = {
  title: "Frente de Caixa | Adega GS",
};

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
        in: ["STANDARD", "SUPPLY"],
      },
      stockItemId: {
        not: null,
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
      salePrice: true,
      stockItem: {
        select: {
          unit: true,
          balance: {
            select: {
              quantity: true,
            },
          },
        },
      },
      stockPackaging: {
        select: {
          balance: {
            select: {
              quantity: true,
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
    const stock = product.stockPackaging
      ? product.stockPackaging.balance?.quantity.toString() ?? "0"
      : product.stockItem?.balance?.quantity.toString() ?? "0";

    const unit = product.stockPackaging
      ? "UNIT"
      : product.stockItem?.unit ?? "UNIT";

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      salePrice: product.salePrice.toString(),
      unit,
      stock,
    };
  });

  return <PosClient products={formattedProducts} />;
}
