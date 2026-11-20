import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildPaginatedResult,
  normalizeListQuery,
  parseDateRange,
  type ListQueryInput,
  type PaginatedResult,
} from "@/lib/list-query";

export type HistorySaleItem = {
  id: string;
  status: "PENDING_DELIVERY" | "COMPLETED" | "CANCELLED";
  isDelivery: boolean;
  payments: { paymentMethod: string; amount: number }[];
  deliveryPayments: {
    paymentMethod: string;
    amount: number;
    deliveryType?: "PREPAID" | "TO_COLLECT";
  }[];
  accountAmount: number;
  total: number;
  deliveryFee: number;
  cashReceived: number;
  changeAmount: number;
  createdAt: string;
  cancelledAt: string | null;
  employee: string;
  customer: { name: string; phone: string } | null;
  items: {
    id: string;
    productName: string;
    productCode: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }[];
};

export type HistoryCreditItem = {
  id: string;
  kind: "DEBT_RECEIPT" | "CANCELLATION_CREDIT";
  description: string | null;
  amount: number;
  createdAt: string;
  employee: string;
  customer: { name: string; phone: string };
  payments: { paymentMethod: string; amount: number }[];
  cashReceived: number;
  changeAmount: number;
};

export type HistoryCashRegisterItem = {
  id: string;
  status: "OPEN" | "CLOSED";
  openingAmount: number;
  expectedAmount: number | null;
  countedAmount: number | null;
  difference: number | null;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy: string | null;
};

export type HistoryListInput = ListQueryInput & {
  status?: string;
  payment?: string;
  tab?: "SALES" | "CREDITS" | "CASH_REGISTERS";
};

function formatSale(
  sale: Prisma.SaleGetPayload<{
    include: {
      user: { select: { name: true } };
      customer: { select: { name: true; phone: true } };
      items: true;
      payments: true;
      delivery: {
        select: {
          payments: {
            select: { type: true; method: true; amount: true };
          };
        };
      };
      accountMovements: { where: { type: "DEBIT" }; select: { amount: true } };
    };
  }>,
): HistorySaleItem {
  return {
    id: sale.id,
    status: sale.status,
    isDelivery: Boolean(sale.delivery),
    payments: sale.payments.map((payment) => ({
      paymentMethod: payment.paymentMethod,
      amount: Number(payment.amount),
    })),
    deliveryPayments:
      sale.delivery?.payments.map((payment) => ({
        paymentMethod: payment.method,
        amount: Number(payment.amount),
        deliveryType: payment.type as "PREPAID" | "TO_COLLECT",
      })) ?? [],
    accountAmount: sale.accountMovements.reduce(
      (sum, movement) => sum + Number(movement.amount),
      0,
    ),
    total: Number(sale.total),
    deliveryFee: Number(sale.deliveryFee),
    cashReceived: Number(sale.cashReceived),
    changeAmount: Number(sale.changeAmount),
    createdAt: sale.createdAt.toISOString(),
    cancelledAt: sale.cancelledAt?.toISOString() ?? null,
    employee: sale.user.name,
    items: sale.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      productCode: item.productCode,
      quantity: Number(item.quantity),
      unit: item.unit,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
    customer: sale.customer
      ? {
          name: sale.customer.name,
          phone: sale.customer.phone,
        }
      : null,
  };
}

export async function listHistorySales(
  input: HistoryListInput = {},
): Promise<PaginatedResult<HistorySaleItem>> {
  const query = normalizeListQuery({
    ...input,
    sortBy: input.sortBy ?? "createdAt",
    sortDir: input.sortDir ?? "desc",
  });

  const createdAt = parseDateRange(query.startDate, query.endDate);
  const where: Prisma.SaleWhereInput = {};

  if (createdAt) {
    where.createdAt = createdAt;
  }

  if (input.status === "DELIVERY") {
    where.delivery = { isNot: null };
  } else if (
    input.status === "COMPLETED" ||
    input.status === "CANCELLED" ||
    input.status === "PENDING_DELIVERY"
  ) {
    where.status = input.status;
  }

  if (query.search) {
    const searchTerm = query.search.trim().replace(/^#/, "");
    where.OR = [
      { id: { contains: searchTerm, mode: "insensitive" } },
      { user: { name: { contains: searchTerm, mode: "insensitive" } } },
      {
        customer: {
          name: { contains: searchTerm, mode: "insensitive" },
        },
      },
    ];
  }

  if (input.payment === "FIADO") {
    where.accountMovements = { some: { type: "DEBIT" } };
  } else if (input.payment && input.payment !== "ALL") {
    const method = input.payment as
      | "CASH"
      | "PIX"
      | "CREDIT_CARD"
      | "DEBIT_CARD";

    where.AND = [
      ...(Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : []),
      {
        OR: [
          { payments: { some: { paymentMethod: method } } },
          { delivery: { payments: { some: { method } } } },
        ],
      },
    ];
  }

  const orderBy: Prisma.SaleOrderByWithRelationInput =
    query.sortBy === "total"
      ? { total: query.sortDir }
      : query.sortBy === "status"
        ? { status: query.sortDir }
        : query.sortBy === "employee"
          ? { user: { name: query.sortDir } }
          : { createdAt: query.sortDir };

  const [total, sales] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      include: {
        user: { select: { name: true } },
        customer: { select: { name: true, phone: true } },
        items: true,
        payments: true,
        delivery: {
          select: {
            payments: {
              select: { type: true, method: true, amount: true },
            },
          },
        },
        accountMovements: {
          where: { type: "DEBIT" },
          select: { amount: true },
        },
      },
      orderBy,
      skip: query.skip,
      take: query.take,
    }),
  ]);

  return buildPaginatedResult(
    sales.map(formatSale),
    total,
    query.page,
    query.pageSize,
  );
}

export async function listHistoryCredits(
  input: HistoryListInput = {},
): Promise<PaginatedResult<HistoryCreditItem>> {
  const query = normalizeListQuery({
    ...input,
    sortBy: input.sortBy ?? "createdAt",
    sortDir: input.sortDir ?? "desc",
  });

  const createdAt = parseDateRange(query.startDate, query.endDate);
  const where: Prisma.CustomerAccountMovementWhereInput = {
    type: "CREDIT",
  };

  if (createdAt) {
    where.createdAt = createdAt;
  }

  if (input.status === "CANCELLATION_CREDIT") {
    where.deliveryCreditForId = { not: null };
  } else if (input.status === "DEBT_RECEIPT") {
    where.deliveryCreditForId = null;
  }

  if (query.search) {
    where.OR = [
      { id: { contains: query.search, mode: "insensitive" } },
      { user: { name: { contains: query.search, mode: "insensitive" } } },
      {
        customer: {
          name: { contains: query.search, mode: "insensitive" },
        },
      },
    ];
  }

  if (
    input.payment &&
    input.payment !== "ALL" &&
    input.payment !== "FIADO"
  ) {
    where.payments = {
      some: {
        method: input.payment as
          | "CASH"
          | "PIX"
          | "CREDIT_CARD"
          | "DEBIT_CARD",
      },
    };
  }

  const orderBy: Prisma.CustomerAccountMovementOrderByWithRelationInput =
    query.sortBy === "amount"
      ? { amount: query.sortDir }
      : query.sortBy === "employee"
        ? { user: { name: query.sortDir } }
        : { createdAt: query.sortDir };

  const [total, movements] = await Promise.all([
    prisma.customerAccountMovement.count({ where }),
    prisma.customerAccountMovement.findMany({
      where,
      include: {
        user: { select: { name: true } },
        customer: { select: { name: true, phone: true } },
        payments: true,
      },
      orderBy,
      skip: query.skip,
      take: query.take,
    }),
  ]);

  return buildPaginatedResult(
    movements.map((movement) => ({
      id: movement.id,
      kind: movement.deliveryCreditForId
        ? ("CANCELLATION_CREDIT" as const)
        : ("DEBT_RECEIPT" as const),
      description: movement.description,
      amount: Number(movement.amount),
      createdAt: movement.createdAt.toISOString(),
      employee: movement.user.name,
      customer: {
        name: movement.customer.name,
        phone: movement.customer.phone,
      },
      payments: movement.payments.map((payment) => ({
        paymentMethod: payment.method,
        amount: Number(payment.amount),
      })),
      cashReceived: Number(movement.cashReceived),
      changeAmount: Number(movement.changeAmount),
    })),
    total,
    query.page,
    query.pageSize,
  );
}

export async function listHistoryCashRegisters(
  input: HistoryListInput = {},
): Promise<PaginatedResult<HistoryCashRegisterItem>> {
  const query = normalizeListQuery({
    ...input,
    sortBy: input.sortBy ?? "openedAt",
    sortDir: input.sortDir ?? "desc",
  });

  const openedAt = parseDateRange(query.startDate, query.endDate);
  const where: Prisma.CashRegisterWhereInput = {};

  if (openedAt) {
    where.openedAt = openedAt;
  }

  if (query.search) {
    where.OR = [
      { id: { contains: query.search, mode: "insensitive" } },
      {
        openedBy: {
          name: { contains: query.search, mode: "insensitive" },
        },
      },
    ];
  }

  const orderBy: Prisma.CashRegisterOrderByWithRelationInput =
    query.sortBy === "openingAmount"
      ? { openingAmount: query.sortDir }
      : query.sortBy === "status"
        ? { status: query.sortDir }
        : { openedAt: query.sortDir };

  const [total, registers] = await Promise.all([
    prisma.cashRegister.count({ where }),
    prisma.cashRegister.findMany({
      where,
      include: {
        openedBy: { select: { name: true } },
        closedBy: { select: { name: true } },
      },
      orderBy,
      skip: query.skip,
      take: query.take,
    }),
  ]);

  return buildPaginatedResult(
    registers.map((register) => ({
      id: register.id,
      status: register.status,
      openingAmount: Number(register.openingAmount),
      expectedAmount:
        register.expectedAmount !== null
          ? Number(register.expectedAmount)
          : null,
      countedAmount:
        register.countedAmount !== null
          ? Number(register.countedAmount)
          : null,
      difference:
        register.difference !== null ? Number(register.difference) : null,
      openedAt: register.openedAt.toISOString(),
      closedAt: register.closedAt?.toISOString() ?? null,
      openedBy: register.openedBy.name,
      closedBy: register.closedBy?.name ?? null,
    })),
    total,
    query.page,
    query.pageSize,
  );
}
