import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { requireModuleAccess } from "@/lib/permissions";
import { getActiveCustomerWithAddresses } from "@/modules/customers/service";
import { updateCustomer } from "../../actions";
import { CustomerAddressesFields } from "../../customer-addresses-fields";

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

  const customer = await getActiveCustomerWithAddresses(id);

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

        <h1 className="mt-4 text-2xl font-bold">Editar cliente</h1>

        <p className="mt-1 text-sm text-slate-500">
          Atualize os dados cadastrais e os endereços de{" "}
          <strong>{customer.name}</strong>.
        </p>

        <form
          action={updateCustomer.bind(null, customer.id)}
          className="mt-8 space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <section>
            <h2 className="mb-4 font-bold">Informações pessoais</h2>

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

          <CustomerAddressesFields
            variant="embedded"
            initialAddresses={customer.addresses.map((address) => ({
              zipCode: address.zipCode,
              street: address.street,
              number: address.number,
              complement: address.complement ?? "",
              neighborhood: address.neighborhood,
              city: address.city,
              state: address.state,
              reference: address.reference ?? "",
              deliveryFee: address.deliveryFee.toFixed(2),
              isDefault: address.isDefault,
            }))}
          />

          <section className="border-t border-slate-100 pt-6">
            <h2 className="mb-4 font-bold">Observações</h2>

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
