
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { requireModuleAccess } from "@/lib/permissions";
import { loadFiadoCustomerDetails } from "@/modules/fiados/queries";

import { FiadoActions } from "../fiado-actions";

export const metadata = {
  title: "Detalhes do Fiado | Adega GS",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function FiadoDetailsPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-slate-500">
          Carregando detalhes do fiado...
        </div>
      }
    >
      <FiadoDetailsContent params={params} />
    </Suspense>
  );
}

async function FiadoDetailsContent({ params }: PageProps) {
  await requireModuleAccess("FIADOS");

  const { id } = await params;

  const details = await loadFiadoCustomerDetails(id);

  if (!details) {
    notFound();
  }

  const {
    customer,
    debts,
    totalOriginalDebt,
    totalPaid,
    totalRemaining,
  } = details;
  return (
    <main className="min-h-screen bg-slate-100 p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/dashboard/fiados"
          className="text-sm text-emerald-700 hover:underline"
        >
          ← Voltar para Fiados
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-slate-900">
            {customer.name}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {customer.phone || "Telefone não informado"}
          </p>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Dívida original
            </p>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {formatCurrency(totalOriginalDebt)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total pago
            </p>
            <p className="mt-3 text-2xl font-bold text-emerald-600">
              {formatCurrency(totalPaid)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Saldo devedor
            </p>
            <p className="mt-3 text-2xl font-bold text-red-600">
              {formatCurrency(totalRemaining)}
            </p>
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900">
              Histórico de dívidas
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Vendas que geraram débitos para este cliente.
            </p>
          </div>

          {debts.length === 0 ? (
            <div className="p-10 text-center">
              <h3 className="font-semibold text-slate-800">
                Nenhuma dívida encontrada
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Este cliente não possui débitos registrados.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {debts.map((debt) => (
                <div
                  key={debt.id}
                  className="p-5"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {debt.sale
                          ? `Venda #${debt.sale.id.slice(0, 8)}`
                          : "Dívida sem venda vinculada"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Registrado em {formatDate(debt.createdAt)}
                      </p>

                      {debt.sale && (
                        <p className="mt-1 text-xs text-slate-500">
                          Total da venda:{" "}
                          {formatCurrency(Number(debt.sale.total))}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-6">
                      <div>
                        <p className="text-xs text-slate-500">
                          Valor fiado
                        </p>
                        <p className="mt-1 font-semibold">
                          {formatCurrency(debt.originalAmount)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Já pago
                        </p>
                        <p className="mt-1 font-semibold text-emerald-600">
                          {formatCurrency(debt.paidAmount)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Restante
                        </p>
                        <p className="mt-1 font-semibold text-red-600">
                          {formatCurrency(debt.remainingAmount)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: `${
                          debt.originalAmount > 0
                            ? Math.min(
                                100,
                                (debt.paidAmount / debt.originalAmount) * 100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
