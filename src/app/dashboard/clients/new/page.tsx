
import Link from "next/link";
import { Suspense } from "react";

import { requireModuleAccess } from "@/lib/permissions";
import { createCustomer } from "../actions";

export default function NewCustomerPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-slate-500">
          Carregando cadastro de clientes...
        </div>
      }
    >
      <NewCustomerContent />
    </Suspense>
  );
}

async function NewCustomerContent() {
  await requireModuleAccess("CUSTOMERS");

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
          Novo cliente
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Cadastre os dados pessoais e o endereço principal do cliente.
        </p>

        <form
          action={createCustomer}
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
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                  placeholder="Nome do cliente"
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
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                  placeholder="(11) 99999-9999"
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
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                  placeholder="00000-000"
                />
              </label>

              <label className="text-sm font-medium">
                Estado (UF) *
                <input
                  name="state"
                  required
                  minLength={2}
                  maxLength={2}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3 uppercase"
                  placeholder="SP"
                />
              </label>

              <label className="text-sm font-medium sm:col-span-2">
                Rua / Avenida *
                <input
                  name="street"
                  required
                  maxLength={150}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                  placeholder="Nome da rua"
                />
              </label>

              <label className="text-sm font-medium">
                Número *
                <input
                  name="number"
                  required
                  maxLength={20}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                  placeholder="123"
                />
              </label>

              <label className="text-sm font-medium">
                Complemento
                <input
                  name="complement"
                  maxLength={100}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                  placeholder="Apartamento, bloco..."
                />
              </label>

              <label className="text-sm font-medium">
                Bairro *
                <input
                  name="neighborhood"
                  required
                  maxLength={100}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <label className="text-sm font-medium">
                Cidade *
                <input
                  name="city"
                  required
                  maxLength={100}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <label className="text-sm font-medium sm:col-span-2">
                Ponto de referência
                <input
                  name="reference"
                  maxLength={200}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                  placeholder="Próximo a..."
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
              Salvar cliente
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
