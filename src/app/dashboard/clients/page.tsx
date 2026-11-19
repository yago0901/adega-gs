import Link from "next/link";
import { Suspense } from "react";

import { requireModuleAccess } from "@/lib/permissions";
import { listActiveCustomersWithAddresses } from "@/modules/customers/service";
import { deactivateCustomer } from "./actions";

export const metadata = {
  title: "Clientes | Adega GS",
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

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

  const customers = await listActiveCustomersWithAddresses();

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

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {customers.length === 0 ? (
            <div className="p-12 text-center">
              <h2 className="font-semibold">Nenhum cliente cadastrado</h2>

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
                    <th className="px-5 py-4">Endereço padrão</th>
                    <th className="px-5 py-4">Taxa</th>
                    <th className="px-5 py-4">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {customers.map((customer) => {
                    const defaultAddress =
                      customer.addresses.find((address) => address.isDefault) ??
                      customer.addresses[0] ??
                      null;

                    return (
                      <tr key={customer.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4 font-semibold">
                          {customer.name}
                          {customer.addresses.length > 1 && (
                            <p className="mt-1 text-xs font-normal text-slate-400">
                              {customer.addresses.length} endereços
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">{customer.phone}</td>

                        <td className="px-5 py-4">
                          {defaultAddress ? (
                            <>
                              {defaultAddress.city} - {defaultAddress.state}
                              <p className="mt-1 text-xs text-slate-400">
                                {defaultAddress.street}, {defaultAddress.number}
                                {" · "}
                                {defaultAddress.neighborhood}
                              </p>
                            </>
                          ) : (
                            <span className="text-slate-400">Sem endereço</span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {defaultAddress
                            ? currency.format(Number(defaultAddress.deliveryFee))
                            : "—"}
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
                                customer.id,
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
