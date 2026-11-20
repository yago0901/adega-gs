import "server-only";

import type { PaymentMethod } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "PIX",
  "CREDIT_CARD",
  "DEBIT_CARD",
];

function getSaoPauloDayStart(): Date {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });

  return new Date(`${today}T00:00:00-03:00`);
}

type MovementGroupRow = {
  type: string;
  _sum: { amount: unknown };
};

function sumCashMovementType(
  rows: MovementGroupRow[],
  type: "SUPPLY" | "WITHDRAWAL",
): number {
  const row = rows.find((item) => item.type === type);

  return row?._sum.amount != null ? Number(row._sum.amount) : 0;
}

export type FinanceCashMovementSummary = {
  source: "OPEN_REGISTER" | "DAY_TOTAL";
  supplyTotal: number;
  withdrawalTotal: number;
  openRegisterId?: string;
};

export type FinancePaymentBreakdownRow = {
  method: PaymentMethod;
  salesAmount: number;
  fiadoReceiptAmount: number;
  total: number;
};

export type FinanceCashRegisterRow = {
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

export type FinanceOverview = {
  completedSalesTotal: number;
  completedSalesCount: number;
  fiadoReceiptsTotal: number;
  fiadoReceiptsCount: number;
  cashMovements: FinanceCashMovementSummary;
  paymentBreakdown: FinancePaymentBreakdownRow[];
  recentCashRegisters: FinanceCashRegisterRow[];
};

export async function getFinanceOverview(): Promise<FinanceOverview> {
  const startOfDay = getSaoPauloDayStart();

  const [
    salesAgg,
    salesCount,
    fiadoAgg,
    fiadoCount,
    openRegister,
    recentRegisters,
    salePaymentsToday,
    fiadoPaymentsToday,
    dayCashMovements,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        status: "COMPLETED",
        createdAt: { gte: startOfDay },
      },
      _sum: { total: true },
    }),

    prisma.sale.count({
      where: {
        status: "COMPLETED",
        createdAt: { gte: startOfDay },
      },
    }),

    prisma.customerAccountMovement.aggregate({
      where: {
        type: "CREDIT",
        deliveryCreditForId: null,
        createdAt: { gte: startOfDay },
      },
      _sum: { amount: true },
    }),

    prisma.customerAccountMovement.count({
      where: {
        type: "CREDIT",
        deliveryCreditForId: null,
        createdAt: { gte: startOfDay },
      },
    }),

    prisma.cashRegister.findFirst({
      where: { status: "OPEN" },
      select: { id: true },
    }),

    prisma.cashRegister.findMany({
      take: 10,
      orderBy: { openedAt: "desc" },
      include: {
        openedBy: { select: { name: true } },
        closedBy: { select: { name: true } },
      },
    }),

    prisma.salePayment.groupBy({
      by: ["paymentMethod"],
      where: {
        sale: {
          status: "COMPLETED",
          createdAt: { gte: startOfDay },
        },
      },
      _sum: { amount: true },
    }),

    prisma.customerAccountMovementPayment.groupBy({
      by: ["method"],
      where: {
        movement: {
          type: "CREDIT",
          deliveryCreditForId: null,
          createdAt: { gte: startOfDay },
        },
      },
      _sum: { amount: true },
    }),

    prisma.cashMovement.groupBy({
      by: ["type"],
      where: { createdAt: { gte: startOfDay } },
      _sum: { amount: true },
    }),
  ]);

  let cashMovements: FinanceCashMovementSummary;

  if (openRegister) {
    const registerMovements = await prisma.cashMovement.groupBy({
      by: ["type"],
      where: { cashRegisterId: openRegister.id },
      _sum: { amount: true },
    });

    cashMovements = {
      source: "OPEN_REGISTER",
      openRegisterId: openRegister.id,
      supplyTotal: sumCashMovementType(registerMovements, "SUPPLY"),
      withdrawalTotal: sumCashMovementType(registerMovements, "WITHDRAWAL"),
    };
  } else {
    cashMovements = {
      source: "DAY_TOTAL",
      supplyTotal: sumCashMovementType(dayCashMovements, "SUPPLY"),
      withdrawalTotal: sumCashMovementType(dayCashMovements, "WITHDRAWAL"),
    };
  }

  const paymentBreakdown = PAYMENT_METHODS.map((method) => {
    const salesAmount = Number(
      salePaymentsToday.find((row) => row.paymentMethod === method)?._sum
        .amount ?? 0,
    );

    const fiadoReceiptAmount = Number(
      fiadoPaymentsToday.find((row) => row.method === method)?._sum.amount ?? 0,
    );

    return {
      method,
      salesAmount,
      fiadoReceiptAmount,
      total: salesAmount + fiadoReceiptAmount,
    };
  });

  return {
    completedSalesTotal: Number(salesAgg._sum.total ?? 0),
    completedSalesCount: salesCount,
    fiadoReceiptsTotal: Number(fiadoAgg._sum.amount ?? 0),
    fiadoReceiptsCount: fiadoCount,
    cashMovements,
    paymentBreakdown,
    recentCashRegisters: recentRegisters.map((register) => ({
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
  };
}