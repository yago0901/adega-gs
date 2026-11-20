import "server-only";

import { prisma } from "@/lib/prisma";
import { searchPosProducts } from "./product-search";

export async function loadPosPageData(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      role: true,
      accesses: {
        select: {
          module: true,
          canManageCashRegister: true,
        },
      },
    },
  });

  const canManageCashRegister =
    user?.role === "ADMIN" ||
    user?.accesses.some(
      (access) =>
        access.module === "POS" && access.canManageCashRegister,
    ) === true;

  const showBackToDashboard =
    user?.role === "ADMIN" || (user?.accesses.length ?? 0) > 1;

  const [cashRegister, productsPage, customers, deliveries, motoboys] =
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

      searchPosProducts({
        page: 1,
        pageSize: 24,
        sortBy: "name",
        sortDir: "asc",
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

  return {
    canManageCashRegister,
    showBackToDashboard,
    products: productsPage.items,
    productsMeta: {
      total: productsPage.total,
      page: productsPage.page,
      pageSize: productsPage.pageSize,
      pageCount: productsPage.pageCount,
    },
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