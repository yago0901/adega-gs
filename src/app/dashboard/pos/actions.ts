
"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";

type SaleRequestItem = {
  productId: string;
  quantity: number;
};

type SaleResult =
  | { success: true; saleId: string; total: string }
  | { success: false; error: string };

type Consumption = {
  stockItemId: string;
  stockPackagingId: string | null;
  quantity: Prisma.Decimal;
  unit: "UNIT" | "ML" | "GRAM";
  name: string;
};

export async function finalizeSale(
  items: SaleRequestItem[],
): Promise<SaleResult> {
  try {
    const session = await requireModuleAccess("POS");

    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, error: "Adicione produtos à venda." };
    }

    if (items.length > 100) {
      return { success: false, error: "Limite de 100 itens por venda." };
    }

    const quantities = new Map<string, Prisma.Decimal>();

    for (const item of items) {
      if (
        typeof item.productId !== "string" ||
        !item.productId ||
        typeof item.quantity !== "number" ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !/^\d+(\.\d{1,3})?$/.test(String(item.quantity))
      ) {
        return {
          success: false,
          error: "Um dos itens possui quantidade inválida.",
        };
      }

      const quantity = new Prisma.Decimal(String(item.quantity));

      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? new Prisma.Decimal(0)).plus(
          quantity,
        ),
      );
    }

    const sale = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: {
          active: true,
        },
        include: {
          stockItem: true,
          stockPackaging: true,
          recipeItems: {
            include: {
              stockItem: true,
            },
          },
          comboItems: {
            include: {
              componentProduct: {
                include: {
                  stockItem: true,
                  stockPackaging: true,
                  recipeItems: {
                    include: {
                      stockItem: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const productMap = new Map(
        products.map((product) => [product.id, product]),
      );

      const requestedProducts = Array.from(quantities.keys()).map((id) => {
        const product = productMap.get(id);

        if (!product) {
          throw new Error(
            "Um ou mais produtos não estão disponíveis para venda.",
          );
        }

        return product;
      });

      const saleItems = requestedProducts.map((product) => {
        const quantity = quantities.get(product.id)!;
        const unitPrice = new Prisma.Decimal(product.salePrice);
        const itemTotal = unitPrice.mul(quantity);

        return {
          product,
          quantity,
          unitPrice,
          itemTotal,
        };
      });

      let total = new Prisma.Decimal(0);

      for (const item of saleItems) {
        total = total.plus(item.itemTotal);
      }

      const consumptions: Consumption[] = [];

      function addConsumption(
        stockItemId: string,
        stockPackagingId: string | null,
        quantity: Prisma.Decimal,
        unit: "UNIT" | "ML" | "GRAM",
        name: string,
      ) {
        if (quantity.lte(0)) {
          throw new Error("Quantidade de consumo inválida.");
        }

        consumptions.push({
          stockItemId,
          stockPackagingId,
          quantity,
          unit,
          name,
        });
      }

      function consumeProduct(
        product: (typeof products)[number],
        quantity: Prisma.Decimal,
      ) {
        if (product.type === "COMBO") {
          if (product.comboItems.length === 0) {
            throw new Error(
              `O combo ${product.name} não possui componentes cadastrados.`,
            );
          }

          for (const comboItem of product.comboItems) {
            const component = comboItem.componentProduct;
            const componentQuantity = quantity.mul(comboItem.quantity);

            if (component.type === "COMBO") {
              throw new Error(
                `O combo ${product.name} contém outro combo. Combos aninhados ainda não são suportados.`,
              );
            }

            consumeComponent(component, componentQuantity);
          }

          return;
        }

        if (product.recipeItems.length > 0) {
          for (const recipeItem of product.recipeItems) {
            addConsumption(
              recipeItem.stockItemId,
              null,
              quantity.mul(recipeItem.quantity),
              recipeItem.stockItem.unit,
              recipeItem.stockItem.name,
            );
          }

          return;
        }

        if (product.stockPackagingId && product.stockItem) {
          addConsumption(
            product.stockItem.id,
            product.stockPackagingId,
            quantity,
            "UNIT",
            product.name,
          );

          return;
        }

        if (product.stockItem) {
          addConsumption(
            product.stockItem.id,
            null,
            quantity,
            product.stockItem.unit,
            product.stockItem.name,
          );

          return;
        }

        throw new Error(
          `O produto ${product.name} não possui vínculo com o estoque.`,
        );
      }

      function consumeComponent(
        component: (typeof products)[number]["comboItems"][number]["componentProduct"],
        quantity: Prisma.Decimal,
      ) {
        if (component.recipeItems.length > 0) {
          for (const recipeItem of component.recipeItems) {
            addConsumption(
              recipeItem.stockItemId,
              null,
              quantity.mul(recipeItem.quantity),
              recipeItem.stockItem.unit,
              recipeItem.stockItem.name,
            );
          }

          return;
        }

        if (component.stockPackagingId && component.stockItem) {
          addConsumption(
            component.stockItem.id,
            component.stockPackagingId,
            quantity,
            "UNIT",
            component.name,
          );

          return;
        }

        if (component.stockItem) {
          addConsumption(
            component.stockItem.id,
            null,
            quantity,
            component.stockItem.unit,
            component.stockItem.name,
          );

          return;
        }

        throw new Error(
          `O componente ${component.name} não possui vínculo com o estoque.`,
        );
      }

      for (const item of saleItems) {
        consumeProduct(item.product, item.quantity);
      }

      // Agrupa consumos repetidos do mesmo item de estoque.
      const groupedConsumptions = new Map<string, Consumption>();

      for (const consumption of consumptions) {
        const key = `${consumption.stockItemId}:${consumption.stockPackagingId ?? "OPEN"}`;
        const existing = groupedConsumptions.get(key);

        if (existing) {
          existing.quantity = existing.quantity.plus(
            consumption.quantity,
          );
        } else {
          groupedConsumptions.set(key, { ...consumption });
        }
      }

      const finalConsumptions = Array.from(groupedConsumptions.values());

      // Verifica e desconta os saldos dentro da transação.
      for (const consumption of finalConsumptions) {
        if (consumption.stockPackagingId) {
          const updated = await tx.stockPackagingBalance.updateMany({
            where: {
              stockPackagingId: consumption.stockPackagingId,
              quantity: {
                gte: consumption.quantity,
              },
            },
            data: {
              quantity: {
                decrement: consumption.quantity,
              },
            },
          });

          if (updated.count !== 1) {
            throw new Error(
              `Estoque insuficiente de ${consumption.name}.`,
            );
          }
        } else {
          const updated = await tx.stockBalance.updateMany({
            where: {
              stockItemId: consumption.stockItemId,
              quantity: {
                gte: consumption.quantity,
              },
            },
            data: {
              quantity: {
                decrement: consumption.quantity,
              },
            },
          });

          if (updated.count !== 1) {
            throw new Error(
              `Estoque insuficiente de ${consumption.name}.`,
            );
          }
        }
      }

      const createdSale = await tx.sale.create({
        data: {
          total,
          userId: session.user.id,
          items: {
            create: saleItems.map((item) => ({
              productId: item.product.id,
              productName: item.product.name,
              productCode: item.product.code,
              unit: "UNIT",
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.itemTotal,
            })),
          },
        },
      });

      await tx.stockMovement.createMany({
        data: finalConsumptions.map((consumption) => ({
          type: "SALE",
          quantity: consumption.quantity.negated(),
          unit: consumption.unit,
          reason: `Venda ${createdSale.id}`,
          reference: createdSale.id,
          saleId: createdSale.id,
          stockItemId: consumption.stockItemId,
          stockPackagingId: consumption.stockPackagingId,
          userId: session.user.id,
        })),
      });

      return createdSale;
    });

    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/stock");
    revalidatePath("/dashboard/stock/movements");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/history");

    return {
      success: true,
      saleId: sale.id,
      total: sale.total.toString(),
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível finalizar a venda.",
    };
  }
}
