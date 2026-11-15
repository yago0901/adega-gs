
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";
import { updateCustomer } from "../../actions";

type EditCustomerPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default function EditCustomerPage({
  params,
}: EditCustomerPageProps) {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-slate-500">
          Carregando dados do cliente...
        </div>
      }
    >
      <EditCustomerContent params={params} />
    </Suspense>
  );
}

async function EditCustomerContent({
  params,
}: EditCustomerPageProps) {
  await requireModuleAccess("CUSTOMERS");

  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
  });

  if (!customer || !customer.active) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-100 p-5 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard/clients"
          className="text-sm text-emerald-700 hover:underline"
        >
          ← Voltar para clientes
        </Link>

        <h1 className="mt-4 text-2xl font-bold">
          Editar cliente
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Atualize os dados cadastrais e o endereço principal de{" "}
          <strong>{customer.name}</strong>.
        </p>

        <form
          action={updateCustomer.bind(null, customer.id)}
          className="mt-8 space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <section>
            <h2 className="mb-4 font-bold">
              Informações pessoais
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium sm:col-span-2">
                Nome completo *
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  defaultValue={customer.name}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <label className="text-sm font-medium sm:col-span-2">
                Telefone com DDD *
                <input
                  name="phone"
                  type="tel"
                  required
                  minLength={10}
                  maxLength={20}
                  defaultValue={customer.phone}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>
            </div>
          </section>

          <section className="border-t border-slate-100 pt-6">
            <h2 className="mb-4 font-bold">
              Endereço principal
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                CEP *
                <input
                  name="zipCode"
                  required
                  maxLength={9}
                  defaultValue={customer.zipCode}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <label className="text-sm font-medium">
                Estado (UF) *
                <input
                  name="state"
                  required
                  minLength={2}
                  maxLength={2}
                  defaultValue={customer.state}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3 uppercase"
                />
              </label>

              <label className="text-sm font-medium sm:col-span-2">
                Rua / Avenida *
                <input
                  name="street"
                  required
                  maxLength={150}
                  defaultValue={customer.street}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <label className="text-sm font-medium">
                Número *
                <input
                  name="number"
                  required
                  maxLength={20}
                  defaultValue={customer.number}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <label className="text-sm font-medium">
                Complemento
                <input
                  name="complement"
                  maxLength={100}
                  defaultValue={customer.complement ?? ""}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <label className="text-sm font-medium">
                Bairro *
                <input
                  name="neighborhood"
                  required
                  maxLength={100}
                  defaultValue={customer.neighborhood}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <label className="text-sm font-medium">
                Cidade *
                <input
                  name="city"
                  required
                  maxLength={100}
                  defaultValue={customer.city}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <label className="text-sm font-medium sm:col-span-2">
                Ponto de referência
                <input
                  name="reference"
                  maxLength={200}
                  defaultValue={customer.reference ?? ""}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>
            </div>
          </section>

          <section className="border-t border-slate-100 pt-6">
            <h2 className="mb-4 font-bold">
              Observações
            </h2>

            <textarea
              name="notes"
              rows={3}
              maxLength={1000}
              defaultValue={customer.notes ?? ""}
              className="w-full rounded-lg border border-slate-300 p-3"
              placeholder="Informações adicionais sobre o cliente..."
            />
          </section>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
            <Link
              href="/dashboard/clients"
              className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Salvar alterações
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
