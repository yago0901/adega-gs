
"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";
import { openStockBottleInTransaction } from "../stock/open-stock-bottle";

type SaleRequestItem = {
  productId: string;
  quantity: number;
  selections?: {
    groupId: string;
    optionId: string;
  }[];
};

type BottleOpening = {
  productId: string;
  stockItemId: string;
  stockItemName: string;
  stockPackagingId: string;
  packagingName: string;
  quantity: number;
  volume: string;
};

type SaleResult =
  | { success: true; saleId: string; total: string }
  | { success: true; confirmationRequired: true; openings: BottleOpening[] }
  | { success: false; error: string };

type Consumption = {
  stockItemId: string;
  stockPackagingId: string | null;
  quantity: Prisma.Decimal;
  unit: "UNIT" | "ML" | "GRAM";
  name: string;
};

type SelectedCompositionOption = {
  groupId: string;
  optionId: string;
};

export async function finalizeSale(
  items: SaleRequestItem[],
  confirmOpenings = false,
): Promise<SaleResult> {
  try {
    const session = await requireModuleAccess("POS");

    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, error: "Adicione produtos à venda." };
    }

    if (items.length > 100) {
      return { success: false, error: "Limite de 100 itens por venda." };
    }

    for (const item of items) {
      if (
        typeof item.productId !== "string" ||
        !item.productId ||
        typeof item.quantity !== "number" ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return {
          success: false,
          error: "Um dos itens possui quantidade inválida.",
        };
      }

      if (
        item.selections !== undefined &&
        (!Array.isArray(item.selections) ||
          item.selections.some(
            (selection) =>
              !selection ||
              typeof selection.groupId !== "string" ||
              !selection.groupId ||
              typeof selection.optionId !== "string" ||
              !selection.optionId,
          ))
      ) {
        return {
          success: false,
          error: "As escolhas de composição são inválidas.",
        };
      }
    }

    const sale = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: {
          active: true,
        },
        include: {
          stockItem: {
            include: {
              balance: true,
              packagings: {
                include: {
                  balance: true,
                },
              },
            },
          },
          composition: {
            include: {
              groups: {
                include: {
                  options: {
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
                      packagings: {
                        include: {
                          balance: true,
                        },
                      },
                    },
                  },
                  stockPackaging: true,
                  composition: {
                    include: {
                      groups: {
                        include: {
                          options: {
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
        },
      });

      const productMap = new Map(
        products.map((product) => [product.id, product]),
      );

      const saleItems = items.map((request) => {
        const product = productMap.get(request.productId);

        if (!product) {
          throw new Error(
            "Um ou mais produtos não estão disponíveis para venda.",
          );
        }

        const quantity = new Prisma.Decimal(String(request.quantity));
        const unitPrice = new Prisma.Decimal(product.salePrice);
        const itemTotal = unitPrice.mul(quantity);
        const selections = request.selections ?? [];

        if (product.type === "FRACTIONAL" && request.quantity !== 1) {
          throw new Error(
            `Cada unidade de ${product.name} precisa ter suas próprias escolhas.`,
          );
        }

        if (product.type !== "FRACTIONAL" && selections.length > 0) {
          throw new Error(
            `O produto ${product.name} não aceita escolhas de composição.`,
          );
        }

        const compositionSelections =
          product.type === "FRACTIONAL"
            ? selections.map((selection) => {
              const group = product.composition?.groups.find(
                (item) => item.id === selection.groupId,
              );

              const option = group?.options.find(
                (item) => item.id === selection.optionId,
              );

              if (!group || !option) {
                throw new Error(
                  `Escolha inválida na composição de ${product.name}.`,
                );
              }

              return {
                groupName: group.name,
                optionName: option.stockItem.name,
                stockItemId: option.stockItemId,
                stockItemName: option.stockItem.name,
                quantity: option.quantity,
                unit: option.stockItem.unit,
              };
            })
            : [];

        return {
          product,
          quantity,
          unitPrice,
          itemTotal,
          selections,
          compositionSelections,
        };
      });

      const total = saleItems.reduce(
        (sum, item) => sum.plus(item.itemTotal),
        new Prisma.Decimal(0),
      );

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
        selections: SelectedCompositionOption[] = [],
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
              throw new Error("Combos aninhados ainda não são suportados.");
            }

            if (component.type === "FRACTIONAL" && component.composition) {
              throw new Error(
                `O componente ${component.name} precisa de escolhas individuais. Essa configuração ainda não é suportada em combos.`,
              );
            }

            consumeComponent(component, componentQuantity);
          }

          return;
        }

        if (product.type === "FRACTIONAL") {
          if (!product.composition) {
            throw new Error(
              `O produto ${product.name} não possui composição cadastrada.`,
            );
          }

          const selectedOptions = product.composition.groups.flatMap((group) => {
            const groupSelections = selections.filter(
              (selection) => selection.groupId === group.id,
            );

            if (groupSelections.length < group.minSelections) {
              throw new Error(
                `Selecione uma opção para o grupo ${group.name} do produto ${product.name}.`,
              );
            }

            if (groupSelections.length > group.maxSelections) {
              throw new Error(
                `O grupo ${group.name} possui opções demais selecionadas.`,
              );
            }

            return groupSelections.map((selection) => {
              const option = group.options.find(
                (item) => item.id === selection.optionId,
              );

              if (!option) {
                throw new Error(
                  `Opção inválida no grupo ${group.name}.`,
                );
              }

              return {
                group,
                option,
              };
            });
          });

          if (selections.length !== selectedOptions.length) {
            throw new Error("Uma ou mais escolhas não pertencem à composição.");
          }

          for (const { option } of selectedOptions) {
            addConsumption(
              option.stockItemId,
              null,
              quantity.mul(option.quantity),
              option.stockItem.unit,
              option.stockItem.name,
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
        if (component.type === "FRACTIONAL" && component.composition) {
          throw new Error(
            `O componente ${component.name} precisa de escolhas individuais. Essa configuração ainda não é suportada em combos.`,
          );
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
        consumeProduct(
          item.product,
          item.quantity,
          item.selections,
        );
      }

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
      const openings: BottleOpening[] = [];

      for (const consumption of finalConsumptions) {
        if (consumption.stockPackagingId || consumption.unit !== "ML") {
          continue;
        }

        const stockItem = products.find(
          (product) => product.stockItemId === consumption.stockItemId,
        )?.stockItem;

        if (!stockItem?.balance) {
          throw new Error(
            `Saldo de estoque não encontrado para ${consumption.name}.`,
          );
        }

        const available = new Prisma.Decimal(stockItem.balance.quantity);

        const shortage = consumption.quantity.minus(available);

        if (shortage.lte(0)) {
          continue;
        }

        const packagingProducts = products.filter(
          (product) =>
            product.stockItemId === consumption.stockItemId &&
            product.stockPackagingId &&
            (product.type === "STANDARD" || product.type === "SUPPLY") &&
            !product.packagingChildProductId,
        );

        const packagingIds = Array.from(
          new Set(
            packagingProducts.map((product) => product.stockPackagingId!),
          ),
        );

        if (packagingIds.length !== 1) {
          throw new Error(
            `Não foi possível identificar uma embalagem única para ${consumption.name}.`,
          );
        }

        const packaging = stockItem.packagings.find(
          (item) => item.id === packagingIds[0],
        );

        if (!packaging) {
          throw new Error(
            `Embalagem não encontrada para ${consumption.name}.`,
          );
        }

        const conversionFactor = new Prisma.Decimal(
          packaging.conversionFactor,
        );

        if (
          conversionFactor.lte(0) ||
          !conversionFactor.isInteger()
        ) {
          throw new Error(
            `Conversão inválida na embalagem de ${consumption.name}.`,
          );
        }

        const quantityToOpen = shortage.div(conversionFactor).ceil();

        if (!packaging.balance) {
          throw new Error(
            `Saldo de embalagens não encontrado para ${consumption.name}.`,
          );
        }

        if (packaging.balance.quantity.lt(quantityToOpen)) {
          throw new Error(
            `Estoque insuficiente de garrafas fechadas de ${consumption.name}.`,
          );
        }

        const volume = conversionFactor.mul(quantityToOpen);

        const packagingProduct = packagingProducts.find(
          (product) => product.stockPackagingId === packaging.id,
        );

        if (!packagingProduct) {
          throw new Error(
            `Produto de embalagem não encontrado para ${consumption.name}.`,
          );
        }

        openings.push({
          productId: packagingProduct.id,
          stockItemId: stockItem.id,
          stockItemName: stockItem.name,
          stockPackagingId: packaging.id,
          packagingName: packaging.name,
          quantity: quantityToOpen.toNumber(),
          volume: volume.toString(),
        });
      }

      if (openings.length > 0 && !confirmOpenings) {
        return {
          confirmationRequired: true as const,
          openings,
        };
      }

      if (confirmOpenings) {
        if (openings.length === 0) {
          throw new Error("Não há abertura de garrafas pendente para confirmar.");
        }

        for (const opening of openings) {
          await openStockBottleInTransaction(
            tx,
            opening.productId,
            new Prisma.Decimal(opening.quantity),
            session.user.id,
          );
        }
      }

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

              compositionSelections:
                item.compositionSelections.length > 0
                  ? {
                    create: item.compositionSelections,
                  }
                  : undefined,
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

    if ("confirmationRequired" in sale) {
      return {
        success: true,
        confirmationRequired: true,
        openings: sale.openings,
      };
    }

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
