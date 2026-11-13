
"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireCashRegisterManagement } from "@/lib/permissions";
import { openStockBottleInTransaction } from "../stock/open-stock-bottle";
import { openCommercialPackagingInTransaction } from "../stock/open-commercial-packaging";

type SaleRequestItem = {
  productId: string;
  quantity: number;
  selections?: {
    groupId: string;
    optionId: string;
  }[];
};

type SalePaymentRequest = {
  paymentMethod: "CASH" | "PIX" | "CREDIT_CARD" | "DEBIT_CARD";
  amount: string;
};

type BottleOpening = {
  kind: "BOTTLE";
  productId: string;
  stockItemId: string;
  stockItemName: string;
  stockPackagingId: string;
  packagingName: string;
  quantity: number;
  volume: string;
};

type CommercialPackagingOpening = {
  kind: "COMMERCIAL";
  productId: string;
  productName: string;
  parentProductName: string;
  quantity: number;
  generatedQuantity: string;
  childProductName: string;
};

type Opening = BottleOpening | CommercialPackagingOpening;

type SaleResult =
  | { success: true; saleId: string; total: string }
  | { success: true; confirmationRequired: true; openings: Opening[] }
  | { success: false; error: string };

type Consumption = {
  productId?: string;
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

type OpenCashRegisterResult =
  | { success: true; cashRegisterId: string }
  | { success: false; error: string };

export async function openCashRegister(
  openingAmount: string,
): Promise<OpenCashRegisterResult> {
  try {
    const session = await requireCashRegisterManagement();

    const normalizedAmount = openingAmount.trim().replace(",", ".");

    if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
      return {
        success: false,
        error: "Informe um valor inicial válido.",
      };
    }

    const amount = new Prisma.Decimal(normalizedAmount);

    if (amount.gt("9999999999.99")) {
      return {
        success: false,
        error: "O valor inicial informado é muito alto.",
      };
    }

    const cashRegister = await prisma.$transaction(
      async (tx) => {
        const existingCashRegister = await tx.cashRegister.findFirst({
          where: {
            status: "OPEN",
          },
        });

        if (existingCashRegister) {
          throw new Error("Já existe um caixa aberto.");
        }

        return tx.cashRegister.create({
          data: {
            openingAmount: amount,
            openedById: session.user.id,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidatePath("/dashboard/pos");

    return {
      success: true,
      cashRegisterId: cashRegister.id,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "Já existe um caixa aberto.",
      };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return {
        success: false,
        error: "Não foi possível abrir o caixa. Tente novamente.",
      };
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível abrir o caixa.",
    };
  }
}

type CloseCashRegisterResult =
  | {
    success: true;
    expectedAmount: string;
    countedAmount: string;
    difference: string;
    paymentTotals: {
      cash: string;
      pix: string;
      creditCard: string;
      debitCard: string;
      total: string;
    };
  }
  | {
    success: false;
    error: string;
  };

export async function closeCashRegister(
  countedAmount: string,
): Promise<CloseCashRegisterResult> {
  try {
    const session = await requireCashRegisterManagement();

    const normalizedAmount = countedAmount.trim().replace(",", ".");

    if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
      return {
        success: false,
        error: "Informe um valor contado válido.",
      };
    }

    const counted = new Prisma.Decimal(normalizedAmount);

    if (counted.gt("9999999999.99")) {
      return {
        success: false,
        error: "O valor contado é muito alto.",
      };
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const [lockedCashRegister] = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id"
          FROM "CashRegister"
          WHERE "status" = 'OPEN'
          LIMIT 1
          FOR UPDATE
        `;

        if (!lockedCashRegister) {
          throw new Error("Nenhum caixa aberto foi encontrado.");
        }

        const cashRegister = await tx.cashRegister.findUnique({
          where: {
            id: lockedCashRegister.id,
          },
        });

        if (!cashRegister || cashRegister.status !== "OPEN") {
          throw new Error("Nenhum caixa aberto foi encontrado.");
        }

        const paymentTotals = await tx.salePayment.groupBy({
          by: ["paymentMethod"],
          where: {
            sale: {
              cashRegisterId: cashRegister.id,
              status: "COMPLETED",
            },
          },
          _sum: {
            amount: true,
          },
        });

        const cashTotal =
          paymentTotals.find((payment) => payment.paymentMethod === "CASH")
            ?._sum.amount ?? new Prisma.Decimal(0);

        const pixTotal =
          paymentTotals.find((payment) => payment.paymentMethod === "PIX")
            ?._sum.amount ?? new Prisma.Decimal(0);

        const creditCardTotal =
          paymentTotals.find((payment) => payment.paymentMethod === "CREDIT_CARD")
            ?._sum.amount ?? new Prisma.Decimal(0);

        const debitCardTotal =
          paymentTotals.find((payment) => payment.paymentMethod === "DEBIT_CARD")
            ?._sum.amount ?? new Prisma.Decimal(0);

        const totalSales = cashTotal
          .plus(pixTotal)
          .plus(creditCardTotal)
          .plus(debitCardTotal);

        const supplies = await tx.cashMovement.aggregate({
          where: {
            cashRegisterId: cashRegister.id,
            type: "SUPPLY",
          },
          _sum: {
            amount: true,
          },
        });

        const withdrawals = await tx.cashMovement.aggregate({
          where: {
            cashRegisterId: cashRegister.id,
            type: "WITHDRAWAL",
          },
          _sum: {
            amount: true,
          },
        });

        const expected = cashRegister.openingAmount
          .plus(cashTotal)
          .plus(supplies._sum.amount ?? 0)
          .minus(withdrawals._sum.amount ?? 0);

        const difference = counted.minus(expected);

        const updated = await tx.cashRegister.updateMany({
          where: {
            id: cashRegister.id,
            status: "OPEN",
          },
          data: {
            status: "CLOSED",
            expectedAmount: expected,
            countedAmount: counted,
            difference,
            closedAt: new Date(),
            closedById: session.user.id,
          },
        });

        if (updated.count !== 1) {
          throw new Error("Não foi possível fechar o caixa.");
        }

        return {
          expectedAmount: expected.toString(),
          countedAmount: counted.toString(),
          difference: difference.toString(),
          paymentTotals: {
            cash: cashTotal.toString(),
            pix: pixTotal.toString(),
            creditCard: creditCardTotal.toString(),
            debitCard: debitCardTotal.toString(),
            total: totalSales.toString(),
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/history");

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return {
        success: false,
        error: "O caixa foi alterado durante o fechamento. Tente novamente.",
      };
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível fechar o caixa.",
    };
  }
}

export async function finalizeSale(
  items: SaleRequestItem[],
  payments: SalePaymentRequest[],
  confirmOpenings = false,
  confirmedOpenings: Opening[] = [],
): Promise<SaleResult> {
  try {
    const session = await requireModuleAccess("POS");

    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, error: "Adicione produtos à venda." };
    }

    if (items.length > 100) {
      return { success: false, error: "Limite de 100 itens por venda." };
    }

    if (!Array.isArray(payments) || payments.length === 0) {
      return {
        success: false,
        error: "Informe pelo menos uma forma de pagamento.",
      };
    }

    if (payments.length > 4) {
      return {
        success: false,
        error: "Limite de 4 formas de pagamento por venda.",
      };
    }

    const validPaymentMethods = [
      "CASH",
      "PIX",
      "CREDIT_CARD",
      "DEBIT_CARD",
    ] as const;

    for (const payment of payments) {
      if (
        !payment ||
        !validPaymentMethods.includes(
          payment.paymentMethod as (typeof validPaymentMethods)[number],
        ) ||
        typeof payment.amount !== "string" ||
        !/^\d+(\.\d{1,2})?$/.test(payment.amount.trim())
      ) {
        return {
          success: false,
          error: "Um dos pagamentos possui dados inválidos.",
        };
      }

      const amount = new Prisma.Decimal(payment.amount);

      if (amount.lte(0) || amount.gt("9999999999.99")) {
        return {
          success: false,
          error: "O valor de um dos pagamentos é inválido.",
        };
      }
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
      const [lockedCashRegister] = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "CashRegister"
        WHERE "status" = 'OPEN'
        LIMIT 1
        FOR UPDATE
      `;

      if (!lockedCashRegister) {
        throw new Error(
          "É necessário que o caixa da adega esteja aberto para registrar uma venda.",
        );
      }

      const cashRegister = lockedCashRegister;

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
          packagingParentProducts: {
            where: {
              active: true,
            },
            include: {
              stockItem: {
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

      const paymentsTotal = payments.reduce(
        (sum, payment) => sum.plus(payment.amount.trim()),
        new Prisma.Decimal(0),
      );

      if (!paymentsTotal.equals(total)) {
        throw new Error(
          "A soma dos pagamentos precisa ser igual ao total da venda.",
        );
      }

      const consumptions: Consumption[] = [];

      function addConsumption(
        stockItemId: string,
        stockPackagingId: string | null,
        quantity: Prisma.Decimal,
        unit: "UNIT" | "ML" | "GRAM",
        name: string,
        productId?: string,
      ) {
        if (quantity.lte(0)) {
          throw new Error("Quantidade de consumo inválida.");
        }

        consumptions.push({
          productId,
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

              if (!option.quantity.isInteger() || option.quantity.lte(0)) {
                throw new Error(
                  `A quantidade da opção ${option.stockItem.name} na composição do produto ${product.name} deve ser um número inteiro positivo.`,
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
            product.id,
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
            product.id,
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

        if (!component.active) {
          throw new Error(
            `O componente ${component.name} está inativo e não pode ser vendido.`,
          );
        }

        if (component.stockItem && !component.stockItem.active) {
          throw new Error(
            `O estoque vinculado ao componente ${component.name} está inativo.`,
          );
        }

        if (component.type === "FRACTIONAL") {
          throw new Error(
            `O componente ${component.name} é uma dose e não pode ser utilizado diretamente em combos.`,
          );
        }

        if (component.stockPackagingId && component.stockItem) {
          addConsumption(
            component.stockItem.id,
            component.stockPackagingId,
            quantity,
            "UNIT",
            component.name,
            component.id,
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
            component.id,
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
        const baseKey = `${consumption.stockItemId}:${consumption.stockPackagingId ?? "OPEN"}`;

        const key =
          !consumption.stockPackagingId &&
            consumption.unit === "UNIT" &&
            consumption.productId
            ? `${baseKey}:${consumption.productId}`
            : baseKey;

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
      const openings: Opening[] = [];

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
          kind: "BOTTLE",
          productId: packagingProduct.id,
          stockItemId: stockItem.id,
          stockItemName: stockItem.name,
          stockPackagingId: packaging.id,
          packagingName: packaging.name,
          quantity: quantityToOpen.toNumber(),
          volume: volume.toString(),
        });
      }

      for (const consumption of finalConsumptions) {
        if (
          consumption.stockPackagingId ||
          consumption.unit !== "UNIT" ||
          !consumption.productId
        ) {
          continue;
        }

        const childProduct = productMap.get(consumption.productId);

        if (!childProduct) {
          throw new Error(
            `Produto não encontrado para o consumo de ${consumption.name}.`,
          );
        }

        if (
          childProduct.type !== "STANDARD" &&
          childProduct.type !== "SUPPLY"
        ) {
          continue;
        }

        if (
          !childProduct.active ||
          !childProduct.stockItem ||
          !childProduct.stockItem.active ||
          childProduct.stockItem.unit !== "UNIT" ||
          childProduct.stockPackagingId !== null ||
          !childProduct.stockItem.balance
        ) {
          throw new Error(
            `O estoque de ${childProduct.name} não está configurado corretamente para abertura comercial.`,
          );
        }

        const available = new Prisma.Decimal(
          childProduct.stockItem.balance.quantity,
        );

        const shortage = consumption.quantity.minus(available);

        if (shortage.lte(0)) {
          continue;
        }

        const parents = childProduct.packagingParentProducts;

        if (parents.length !== 1) {
          throw new Error(
            `Não foi possível identificar uma embalagem pai única para ${childProduct.name}.`,
          );
        }

        const parent = parents[0];
        const conversionFactor = parent.packagingChildQuantity;

        if (
          !parent.active ||
          (parent.type !== "STANDARD" && parent.type !== "SUPPLY") ||
          !parent.stockItem ||
          !parent.stockItem.active ||
          parent.stockItem.unit !== "UNIT" ||
          parent.stockPackagingId !== null ||
          parent.packagingChildProductId !== childProduct.id ||
          !parent.stockItem.balance ||
          !conversionFactor ||
          conversionFactor.lte(0) ||
          !conversionFactor.isInteger()
        ) {
          throw new Error(
            `A configuração da embalagem pai de ${childProduct.name} é inválida.`,
          );
        }

        const quantityToOpen = shortage.div(conversionFactor).ceil();

        if (parent.stockItem.balance.quantity.lt(quantityToOpen)) {
          throw new Error(
            `Estoque insuficiente de ${parent.name} para gerar ${childProduct.name}.`,
          );
        }

        const generatedQuantity = quantityToOpen.mul(conversionFactor);

        openings.push({
          kind: "COMMERCIAL",
          productId: parent.id,
          productName: childProduct.name,
          parentProductName: parent.name,
          quantity: quantityToOpen.toNumber(),
          generatedQuantity: generatedQuantity.toString(),
          childProductName: childProduct.name,
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
          throw new Error(
            "Não há abertura de estoque pendente para confirmar.",
          );
        }

        if (!Array.isArray(confirmedOpenings)) {
          throw new Error("Dados de confirmação inválidos.");
        }

        function getOpeningKey(opening: Opening): string {
          if (opening.kind === "BOTTLE") {
            return JSON.stringify([
              opening.kind,
              opening.productId,
              opening.stockItemId,
              opening.stockItemName,
              opening.stockPackagingId,
              opening.packagingName,
              opening.quantity,
              opening.volume,
            ]);
          }

          return JSON.stringify([
            opening.kind,
            opening.productId,
            opening.productName,
            opening.parentProductName,
            opening.quantity,
            opening.generatedQuantity,
            opening.childProductName,
          ]);
        }

        const currentOpeningKeys = openings
          .map(getOpeningKey)
          .sort();

        const confirmedOpeningKeys = confirmedOpenings
          .map(getOpeningKey)
          .sort();

        const openingsMatch =
          currentOpeningKeys.length === confirmedOpeningKeys.length &&
          currentOpeningKeys.every(
            (key, index) => key === confirmedOpeningKeys[index],
          );

        if (!openingsMatch) {
          throw new Error(
            "O estoque mudou desde a prévia das aberturas. Revise as quantidades e tente novamente.",
          );
        }

        for (const opening of openings) {
          if (opening.kind === "BOTTLE") {
            await openStockBottleInTransaction(
              tx,
              opening.productId,
              new Prisma.Decimal(opening.quantity),
              session.user.id,
            );
          } else {
            await openCommercialPackagingInTransaction(
              tx,
              opening.productId,
              new Prisma.Decimal(opening.quantity),
              session.user.id,
            );
          }
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
          cashRegisterId: cashRegister.id,

          payments: {
            create: payments.map((payment) => ({
              paymentMethod: payment.paymentMethod,
              amount: new Prisma.Decimal(payment.amount.trim()),
            })),
          },

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

export async function cancelSale(saleId: string) {
  try {
    const session = await requireModuleAccess("POS");

    if (!saleId) {
      return {
        success: false,
        error: "Venda inválida.",
      };
    }

    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: {
          id: saleId,
        },
      });

      if (!sale) {
        throw new Error("Venda não encontrada.");
      }

      if (!sale.cashRegisterId) {
        throw new Error(
          "Esta venda não está vinculada a uma sessão de caixa e não pode ser cancelada.",
        );
      }

      const [lockedCashRegister] = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "CashRegister"
        WHERE "id" = ${sale.cashRegisterId}
        FOR UPDATE
      `;

      if (!lockedCashRegister) {
        throw new Error("A sessão de caixa desta venda não foi encontrada.");
      }

      const cashRegister = await tx.cashRegister.findUnique({
        where: {
          id: sale.cashRegisterId,
        },
        select: {
          status: true,
        },
      });

      if (cashRegister?.status !== "OPEN") {
        throw new Error(
          "Não é possível cancelar esta venda porque o caixa já foi fechado.",
        );
      }

      if (sale.status === "CANCELLED") {
        throw new Error("Esta venda já foi cancelada.");
      }

      const movements = await tx.stockMovement.findMany({
        where: {
          saleId: sale.id,
          type: "SALE",
        },
      });

      if (movements.length === 0) {
        throw new Error(
          "Não foram encontradas movimentações de estoque para esta venda. O cancelamento automático foi interrompido.",
        );
      }

      const cancellation = await tx.sale.updateMany({
        where: {
          id: sale.id,
          status: "COMPLETED",
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      });

      if (cancellation.count !== 1) {
        throw new Error(
          "Esta venda já foi alterada. Atualize a página e tente novamente.",
        );
      }

      for (const movement of movements) {
        if (movement.quantity.greaterThanOrEqualTo(0)) {
          throw new Error(
            "Foi encontrada uma movimentação de venda com quantidade inválida.",
          );
        }

        const quantityToRestore = movement.quantity.negated();

        if (movement.stockPackagingId) {
          const result = await tx.stockPackagingBalance.updateMany({
            where: {
              stockPackagingId: movement.stockPackagingId,
            },
            data: {
              quantity: {
                increment: quantityToRestore,
              },
            },
          });

          if (result.count !== 1) {
            throw new Error(
              `Não foi possível restaurar o estoque da embalagem ${movement.stockPackagingId}.`,
            );
          }
        } else {
          const result = await tx.stockBalance.updateMany({
            where: {
              stockItemId: movement.stockItemId,
            },
            data: {
              quantity: {
                increment: quantityToRestore,
              },
            },
          });

          if (result.count !== 1) {
            throw new Error(
              `Não foi possível restaurar o estoque do item ${movement.stockItemId}.`,
            );
          }
        }

        await tx.stockMovement.create({
          data: {
            type: "REVERSAL",
            quantity: quantityToRestore,
            unit: movement.unit,
            userId: session.user.id,
            reason: "Cancelamento de venda",
            reference: sale.id,
            stockItemId: movement.stockItemId,
            stockPackagingId: movement.stockPackagingId,
            saleId: sale.id,
          },
        });
      }
    });

    revalidatePath("/dashboard/history");
    revalidatePath("/dashboard/stock");
    revalidatePath("/dashboard/stock/movements");
    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard");

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível cancelar a venda.",
    };
  }
}
