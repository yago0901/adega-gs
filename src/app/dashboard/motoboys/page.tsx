import Link from "next/link";
import { Suspense } from "react";

import { requireModuleAccess } from "@/lib/permissions";
import { listMotoboys } from "@/modules/motoboys/list";
import { MotoboysListClient } from "./motoboys-list-client";

export const metadata = {
  title: "Motoboys | Adega GS",
};

export default function MotoboysPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-slate-500">
          Carregando motoboys...
        </div>
      }
    >
      <MotoboysContent />
    </Suspense>
  );
}

async function MotoboysContent() {
  await requireModuleAccess("MOTOBOYS");

  const [initial, activeSummary] = await Promise.all([
    listMotoboys({ page: 1, pageSize: 20 }),
    listMotoboys({ page: 1, pageSize: 1, active: "ACTIVE" }),
  ]);

  return (
    <main className="min-h-screen bg-slate-100 p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="text-sm text-emerald-700 hover:underline"
            >
              ← Dashboard
            </Link>

            <h1 className="mt-3 text-2xl font-bold">Motoboys</h1>

            <p className="mt-1 text-sm text-slate-500">
              Cadastro e gerenciamento dos motoboys da adega.
            </p>
          </div>

          <Link
            href="/dashboard/motoboys/new"
            className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            + Novo motoboy
          </Link>
        </div>

        <div className="mt-6">
          <MotoboysListClient
            initial={initial}
            initialActiveTotal={activeSummary.total}
          />
        </div>
      </div>
    </main>
  );
}