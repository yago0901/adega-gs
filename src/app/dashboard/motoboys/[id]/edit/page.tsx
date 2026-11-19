
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { requireModuleAccess } from "@/lib/permissions";
import { getMotoboyById } from "@/modules/motoboys/service";
import { updateMotoboy } from "../../actions";

type EditMotoboyPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default function EditMotoboyPage({
  params,
}: EditMotoboyPageProps) {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-slate-500">
          Carregando dados do motoboy...
        </div>
      }
    >
      <EditMotoboyContent params={params} />
    </Suspense>
  );
}

async function EditMotoboyContent({
  params,
}: EditMotoboyPageProps) {
  await requireModuleAccess("MOTOBOYS");

  const { id } = await params;

  const motoboy = await getMotoboyById(id);

  if (!motoboy || !motoboy.active) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-100 p-5 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard/motoboys"
          className="text-sm text-emerald-700 hover:underline"
        >
          ← Voltar para motoboys
        </Link>

        <h1 className="mt-4 text-2xl font-bold">
          Editar motoboy
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Atualize os dados cadastrais de{" "}
          <strong>{motoboy.name}</strong>.
        </p>

        <form
          action={updateMotoboy.bind(null, motoboy.id)}
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
                  defaultValue={motoboy.name}
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
                  defaultValue={motoboy.phone}
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
              rows={4}
              maxLength={1000}
              defaultValue={motoboy.notes ?? ""}
              className="w-full rounded-lg border border-slate-300 p-3"
              placeholder="Informações adicionais sobre o motoboy..."
            />
          </section>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
            <Link
              href="/dashboard/motoboys"
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
