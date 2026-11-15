
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";
import { HistoryClient } from "./history-client";

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="p-8">Carregando histórico...</div>}>
      <HistoryContent />
    </Suspense>
  );
}


async function HistoryContent() {
  await requireModuleAccess("HISTORY");

  const [sales, cashRegisters, debtPayments] = await Promise.all([
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { name: true },
        },
        customer: {
          select: {
            name: true,
            phone: true,
          },
        },
        items: true,
        payments: true,
        accountMovements: {
          where: { type: "DEBIT" },
          select: { amount: true },
        },
      },
    }),

    prisma.cashRegister.findMany({
      orderBy: { openedAt: "desc" },
      include: {
        openedBy: {
          select: { name: true },
        },
        closedBy: {
          select: { name: true },
        },
        movements: {
          include: {
            user: {
              select: { name: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        sales: {
          include: {
            payments: true,
            accountMovements: {
              where: { type: "DEBIT" },
              select: { amount: true },
            },
          },
        },
      },
    }),

    prisma.customerAccountMovement.findMany({
      where: {
        type: "CREDIT",
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
        customer: {
          select: {
            name: true,
            phone: true,
          },
        },
        payments: true,
      },
    }),
  ]);

  const formattedSales = sales.map((sale) => ({
    id: sale.id,
    status: sale.status,
    payments: sale.payments.map((payment) => ({
      paymentMethod: payment.paymentMethod,
      amount: Number(payment.amount),
    })),
    accountAmount: sale.accountMovements.reduce(
      (sum, movement) => sum + Number(movement.amount),
      0,
    ),
    total: Number(sale.total),
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
  }));

  const formattedDebtPayments = debtPayments.map((movement) => ({
    id: movement.id,
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
  }));

  const formattedCashRegisters = cashRegisters.map((register) => ({
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
      register.difference !== null
        ? Number(register.difference)
        : null,
    openedAt: register.openedAt.toISOString(),
    closedAt: register.closedAt?.toISOString() ?? null,
    openedBy: register.openedBy.name,
    closedBy: register.closedBy?.name ?? null,
    movements: register.movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      amount: Number(movement.amount),
      description: movement.description,
      createdAt: movement.createdAt.toISOString(),
      employee: movement.user.name,
    })),
    sales: register.sales.map((sale) => ({
      id: sale.id,
      status: sale.status,
      total: Number(sale.total),
      cashReceived: Number(sale.cashReceived),
      changeAmount: Number(sale.changeAmount),
      payments: sale.payments.map((payment) => ({
        paymentMethod: payment.paymentMethod,
        amount: Number(payment.amount),
      })),
      accountAmount: sale.accountMovements.reduce(
        (sum, movement) => sum + Number(movement.amount),
        0,
      ),
      createdAt: sale.createdAt.toISOString(),
    })),
  }));

  return (
    <HistoryClient
      sales={formattedSales}
      cashRegisters={formattedCashRegisters}
      debtPayments={formattedDebtPayments}
    />
  );
}

