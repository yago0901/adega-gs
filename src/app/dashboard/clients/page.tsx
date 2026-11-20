import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

import { requireModuleAccess } from "@/lib/permissions";
import { listCustomers } from "@/modules/customers/list";
import { ClientsListClient } from "./clients-list-client";

export const metadata = {
  title: "Clientes | Adega GS",
};

export default function ClientsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-slate-500">
          Carregando clientes...
        </div>
      }
    >
      <ClientsContent />
    </Suspense>
  );
}

async function ClientsContent() {
  await connection();
  await requireModuleAccess("CUSTOMERS");

  const initial = await listCustomers({ page: 1, pageSize: 20 });

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

            <h1 className="mt-3 text-2xl font-bold">Clientes</h1>

            <p className="mt-1 text-sm text-slate-500">
              Cadastro e consulta dos clientes da adega.
            </p>
          </div>

          <Link
            href="/dashboard/clients/new"
            className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            + Novo cliente
          </Link>
        </div>

        <div className="mt-8">
          <ClientsListClient initial={initial} />
        </div>
      </div>
    </main>
  );
}