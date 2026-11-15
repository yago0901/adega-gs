
import Link from "next/link";
import { Suspense } from "react";

import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";
import { deactivateCustomer } from "./actions";

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
  await requireModuleAccess("CUSTOMERS");

  const customers = await prisma.customer.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

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

            <h1 className="mt-3 text-2xl font-bold">
              Clientes
            </h1>

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

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {customers.length === 0 ? (
            <div className="p-12 text-center">
              <h2 className="font-semibold">
                Nenhum cliente cadastrado
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Comece cadastrando o primeiro cliente da adega.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Cliente</th>
                    <th className="px-5 py-4">Telefone</th>
                    <th className="px-5 py-4">Cidade</th>
                    <th className="px-5 py-4">Endereço</th>
                    <th className="px-5 py-4">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 font-semibold">
                        {customer.name}
                      </td>

                      <td className="px-5 py-4">
                        {customer.phone}
                      </td>

                      <td className="px-5 py-4">
                        {customer.city} - {customer.state}
                      </td>

                      <td className="px-5 py-4">
                        {customer.street}, {customer.number}
                        <p className="mt-1 text-xs text-slate-400">
                          {customer.neighborhood}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/dashboard/clients/${customer.id}/edit`}
                            className="font-medium text-emerald-700 hover:underline"
                          >
                            Editar
                          </Link>

                          <form
                            action={deactivateCustomer.bind(
                              null,
                              customer.id
                            )}
                          >
                            <button
                              type="submit"
                              className="font-medium text-red-600 hover:underline"
                            >
                              Desativar
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
