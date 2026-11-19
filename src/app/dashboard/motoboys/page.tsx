
import Link from "next/link";
import { Suspense } from "react";

import { requireModuleAccess } from "@/lib/permissions";
import { listAllMotoboys } from "@/modules/motoboys/service";
import {
  deactivateMotoboy,
  reactivateMotoboy,
} from "./actions";

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

  const motoboys = await listAllMotoboys();

  const activeCount = motoboys.filter(
    (motoboy) => motoboy.active,
  ).length;

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
              Motoboys
            </h1>

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

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Motoboys cadastrados
            </p>
            <p className="mt-2 text-2xl font-bold">
              {motoboys.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Motoboys ativos
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {activeCount}
            </p>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {motoboys.length === 0 ? (
            <div className="p-12 text-center">
              <h2 className="font-semibold">
                Nenhum motoboy cadastrado
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Comece cadastrando o primeiro motoboy da adega.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Motoboy</th>
                    <th className="px-5 py-4">Telefone</th>
                    <th className="px-5 py-4">Observações</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {motoboys.map((motoboy) => (
                    <tr
                      key={motoboy.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 font-semibold">
                        {motoboy.name}
                      </td>

                      <td className="px-5 py-4">
                        {motoboy.phone}
                      </td>

                      <td className="max-w-xs px-5 py-4 text-slate-500">
                        {motoboy.notes || "—"}
                      </td>

                      <td className="px-5 py-4">
                        {motoboy.active ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Ativo
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                            Inativo
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/dashboard/motoboys/${motoboy.id}/edit`}
                            className="font-medium text-emerald-700 hover:underline"
                          >
                            Editar
                          </Link>

                          {motoboy.active ? (
                            <form
                              action={deactivateMotoboy.bind(
                                null,
                                motoboy.id,
                              )}
                            >
                              <button
                                type="submit"
                                className="font-medium text-red-600 hover:underline"
                              >
                                Desativar
                              </button>
                            </form>
                          ) : (
                            <form
                              action={reactivateMotoboy.bind(
                                null,
                                motoboy.id,
                              )}
                            >
                              <button
                                type="submit"
                                className="font-medium text-emerald-700 hover:underline"
                              >
                                Reativar
                              </button>
                            </form>
                          )}
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
