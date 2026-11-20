import "server-only";

import { prisma } from "@/lib/prisma";

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

function getOptionAvailability(option: {
  quantity: { toString(): string };
  stockItem: {
    balance: { quantity: { toString(): string } } | null;
  };
}) {
  const required = Number(option.quantity.toString());
  const available = Number(
    option.stockItem.balance?.quantity.toString() ?? 0,
  );

  if (required <= 0) return 0;

  return Math.max(0, Math.floor(available / required));
}

function getCompositionAvailability(
  groups: {
    minSelections: number;
    options: {
      quantity: { toString(): string };
      stockItem: {
        balance: { quantity: { toString(): string } } | null;
      };
    }[];
  }[],
) {
  const requiredGroups = groups.filter(
    (group) => group.minSelections > 0,
  );

  if (requiredGroups.length === 0) return 0;

  const groupAvailabilities = requiredGroups.map((group) => {
    if (group.options.length === 0) return 0;

    return Math.max(
      ...group.options.map(getOptionAvailability),
    );
  });

  return Math.min(...groupAvailabilities);
}

export async function loadPosPageData(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      role: true,
      accesses: {
        where: {
          module: "POS",
        },
        select: {
          canManageCashRegister: true,
        },
      },
    },
  });

  const canManageCashRegister =
    user?.role === "ADMIN" ||
    user?.accesses.some(
      (access) => access.canManageCashRegister,
    ) === true;

  const [cashRegister, products, customers, deliveries, motoboys] =
    await Promise.all([
      prisma.cashRegister.findFirst({
        where: {
          status: "OPEN",
        },
        select: {
          id: true,
          openingAmount: true,
          openedAt: true,
        },
      }),

      prisma.product.findMany({
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
                          position: "asc",
                        },
                        include: {
                          options: {
                            orderBy: {
                              position: "asc",
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
        },
        orderBy: {
          name: "asc",
        },
      }),

      prisma.customer.findMany({
        where: {
          active: true,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          addresses: {
            select: {
              id: true,
              zipCode: true,
              street: true,
              number: true,
              complement: true,
              neighborhood: true,
              city: true,
              state: true,
              reference: true,
              deliveryFee: true,
              isDefault: true,
            },
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          },
        },
        orderBy: {
          name: "asc",
        },
      }),

      prisma.delivery.findMany({
        where: {
          status: {
            in: ["PENDING", "OUT_FOR_DELIVERY"],
          },
        },
        select: {
          id: true,
          status: true,
          fee: true,
          predictedCashReceived: true,
          predictedChangeAmount: true,
          payments: {
            select: {
              id: true,
              type: true,
              method: true,
              amount: true,
            },
          },
          createdAt: true,
          dispatchedAt: true,
          motoboy: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          sale: {
            select: {
              id: true,
              total: true,
              deliveryFee: true,
              customerId: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                },
              },
              deliveryZipCode: true,
              deliveryStreet: true,
              deliveryNumber: true,
              deliveryComplement: true,
              deliveryNeighborhood: true,
              deliveryCity: true,
              deliveryState: true,
              deliveryReference: true,
              items: {
                select: {
                  id: true,
                  productName: true,
                  productCode: true,
                  unit: true,
                  quantity: true,
                  unitPrice: true,
                  total: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.motoboy.findMany({
        where: {
          active: true,
        },
        select: {
          id: true,
          name: true,
          phone: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
    ]);

  const formattedCustomers = customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    addresses: customer.addresses.map((address) => ({
      id: address.id,
      zipCode: address.zipCode,
      street: address.street,
      number: address.number,
      complement: address.complement,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      reference: address.reference,
      deliveryFee: address.deliveryFee.toFixed(2),
      isDefault: address.isDefault,
    })),
  }));

  const formattedDeliveries = deliveries.map((delivery) => ({
    id: delivery.id,
    status: delivery.status as "PENDING" | "OUT_FOR_DELIVERY",
    fee: delivery.fee.toFixed(2),
    predictedCashReceived: delivery.predictedCashReceived.toString(),
    predictedChangeAmount: delivery.predictedChangeAmount.toString(),
    payments: delivery.payments.map((payment) => ({
      id: payment.id,
      type: payment.type,
      method: payment.method,
      amount: payment.amount.toString(),
    })),
    createdAt: delivery.createdAt.toISOString(),
    dispatchedAt: delivery.dispatchedAt?.toISOString() ?? null,
    motoboy: delivery.motoboy,
    sale: {
      id: delivery.sale.id,
      total: delivery.sale.total.toString(),
      deliveryFee: delivery.sale.deliveryFee.toFixed(2),
      customerId: delivery.sale.customerId,
      customer: delivery.sale.customer,
      deliveryZipCode: delivery.sale.deliveryZipCode,
      deliveryStreet: delivery.sale.deliveryStreet,
      deliveryNumber: delivery.sale.deliveryNumber,
      deliveryComplement: delivery.sale.deliveryComplement,
      deliveryNeighborhood: delivery.sale.deliveryNeighborhood,
      deliveryCity: delivery.sale.deliveryCity,
      deliveryState: delivery.sale.deliveryState,
      deliveryReference: delivery.sale.deliveryReference,
      items: delivery.sale.items.map((item) => ({
        ...item,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        total: item.total.toString(),
      })),
    },
  }));

  const formattedProducts = products.map((product) => {
    let stock = 0;

    if (product.type === "FRACTIONAL") {
      stock = getCompositionAvailability(
        product.composition?.groups ?? [],
      );
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
  });

  return {
    canManageCashRegister,
    products: formattedProducts,
    customers: formattedCustomers,
    deliveries: formattedDeliveries,
    motoboys,
    cashRegister: cashRegister
      ? {
          id: cashRegister.id,
          openingAmount: cashRegister.openingAmount.toString(),
          openedAt: cashRegister.openedAt.toISOString(),
        }
      : null,
  };
}