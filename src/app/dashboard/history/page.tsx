import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { requireModuleAccess } from "@/lib/permissions";
import {
  listHistoryCashRegisters,
  listHistoryCredits,
  listHistorySales,
} from "@/modules/history/list";
import { HistoryClient } from "./history-client";

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="p-8">Carregando histórico...</div>}>
      <HistoryContent />
    </Suspense>
  );
}

async function HistoryContent() {
  await connection();
  await requireModuleAccess("HISTORY");

  const [sales, credits, cashRegisters] = await Promise.all([
    listHistorySales({ page: 1, pageSize: 20 }),
    listHistoryCredits({ page: 1, pageSize: 20 }),
    listHistoryCashRegisters({ page: 1, pageSize: 20 }),
  ]);

  return (
    <main className="min-h-screen bg-muted/40 p-5 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-emerald-700 hover:underline"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-bold">Histórico</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vendas, créditos e sessões de caixa com filtros e paginação.
          </p>
        </div>

        <HistoryClient
          initialSales={sales}
          initialCredits={credits}
          initialCashRegisters={cashRegisters}
        />
      </div>
    </main>
  );
}
