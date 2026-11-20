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
        <ClientsListClient initial={initial} />
      </div>
    </main>
  );
}