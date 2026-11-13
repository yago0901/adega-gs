
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

  const [sales, cashRegisters] = await Promise.all([
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { name: true },
        },
        items: true,
        payments: true,
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
          },
          orderBy: { createdAt: "desc" },
        },
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
    total: Number(sale.total),
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
      payments: sale.payments.map((payment) => ({
        paymentMethod: payment.paymentMethod,
        amount: Number(payment.amount),
      })),
      createdAt: sale.createdAt.toISOString(),
    })),
  }));

  return (
    <HistoryClient
      sales={formattedSales}
      cashRegisters={formattedCashRegisters}
    />
  );
}

