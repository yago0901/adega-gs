import Link from "next/link";
import { Suspense } from "react";

import { requireModuleAccess } from "@/lib/permissions";
import { listFiados } from "@/modules/fiados/list";
import { FiadosListClient } from "./fiados-list-client";

export const metadata = {
  title: "Fiados | Adega GS",
};

export default function FiadosPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-slate-500">
          Carregando fiados...
        </div>
      }
    >
      <FiadosContent />
    </Suspense>
  );
}

async function FiadosContent() {
  await requireModuleAccess("FIADOS");

  const initial = await listFiados({ page: 1, pageSize: 20 });

  return (
    <main className="min-h-screen bg-slate-100 p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-emerald-700 hover:underline"
          >
            ← Dashboard
          </Link>

          <h1 className="mt-3 text-2xl font-bold">Fiados</h1>

          <p className="mt-1 text-sm text-slate-500">
            Consulte as dívidas em aberto dos clientes e acompanhe os
            recebimentos.
          </p>
        </div>

        <div className="mt-8">
          <FiadosListClient initial={initial} />
        </div>
      </div>
    </main>
  );
}