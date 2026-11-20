import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

import { requireModuleAccess } from "@/lib/permissions";
import { listStockMovements } from "@/modules/stock/list";
import { MovementsListClient } from "./movements-list-client";

export const metadata = {
  title: "Movimentações | Adega GS",
};

export default function StockMovementsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-slate-500">
          Carregando movimentações...
        </div>
      }
    >
      <MovementsContent />
    </Suspense>
  );
}

async function MovementsContent() {
  await connection();
  await requireModuleAccess("STOCK");

  const initial = await listStockMovements({
    page: 1,
    pageSize: 20,
  });

  return (
    <main className="min-h-screen bg-slate-100 p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/dashboard/stock"
          className="text-sm text-emerald-700 hover:underline"
        >
          ← Voltar para estoque
        </Link>

        <h1 className="mt-3 text-2xl font-bold">
          Histórico de movimentações
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Consulte entradas, saídas, ajustes e demais movimentações com busca e
          filtros.
        </p>

        <div className="mt-8">
          <MovementsListClient initial={initial} />
        </div>
      </div>
    </main>
  );
}