
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

  const sales = await prisma.sale.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { name: true },
      },
      items: true,
    },
  });

  const formattedSales = sales.map((sale) => ({
    id: sale.id,
    status: sale.status,
    paymentMethod: sale.paymentMethod,
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

  return <HistoryClient sales={formattedSales} />;
}
