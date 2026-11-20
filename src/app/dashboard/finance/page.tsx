import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireModuleAccess } from "@/lib/permissions";
import { getFinanceOverview } from "@/modules/finance/queries";

export const metadata = {
  title: "Financeiro | Adega GS",
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const paymentLabels: Record<string, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  CREDIT_CARD: "Crédito",
  DEBIT_CARD: "Débito",
};

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function FinancePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-slate-500">
          Carregando financeiro...
        </div>
      }
    >
      <FinanceContent />
    </Suspense>
  );
}

async function FinanceContent() {
  await connection();
  await requireModuleAccess("FINANCE");

  const data = await getFinanceOverview();

  const cashMovementHint =
    data.cashMovements.source === "OPEN_REGISTER"
      ? "Caixa aberto (sessão atual)"
      : "Totais do dia";

  return (
    <main className="min-h-screen bg-slate-100 p-5 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-emerald-700 hover:underline"
          >
            ← Dashboard
          </Link>

          <h1 className="mt-3 text-2xl font-bold">Financeiro</h1>

          <p className="mt-1 text-sm text-slate-500">
            Resumo do dia e visão rápida do caixa.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Vendas concluídas hoje</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {currency.format(data.completedSalesTotal)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {data.completedSalesCount}{" "}
              {data.completedSalesCount === 1 ? "venda" : "vendas"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Recebimentos de fiado hoje</p>
            <p className="mt-2 text-2xl font-bold">
              {currency.format(data.fiadoReceiptsTotal)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {data.fiadoReceiptsCount}{" "}
              {data.fiadoReceiptsCount === 1
                ? "recebimento"
                : "recebimentos"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Suprimentos</p>
            <p className="mt-2 text-2xl font-bold">
              {currency.format(data.cashMovements.supplyTotal)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{cashMovementHint}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Sangrias</p>
            <p className="mt-2 text-2xl font-bold">
              {currency.format(data.cashMovements.withdrawalTotal)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{cashMovementHint}</p>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Recebimentos de hoje por forma</h2>
            <p className="mt-1 text-sm text-slate-500">
              Vendas concluídas e recebimentos de fiado no dia.
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Forma</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Fiado</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.paymentBreakdown.map((row) => (
                <TableRow key={row.method}>
                  <TableCell className="font-medium">
                    {paymentLabels[row.method] ?? row.method}
                  </TableCell>
                  <TableCell className="text-right">
                    {currency.format(row.salesAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {currency.format(row.fiadoReceiptAmount)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {currency.format(row.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Sessões recentes de caixa</h2>
            <p className="mt-1 text-sm text-slate-500">
              Últimas aberturas e fechamentos registrados.
            </p>
          </div>

          {data.recentCashRegisters.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Nenhuma sessão de caixa registrada ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Troco inicial</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                  <TableHead className="text-right">Contado</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentCashRegisters.map((register) => (
                  <TableRow key={register.id}>
                    <TableCell className="text-sm">
                      {formatDateTime(register.openedAt)}
                      {register.closedAt ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          Fechado {formatDateTime(register.closedAt)}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          register.status === "OPEN" ? "default" : "secondary"
                        }
                      >
                        {register.status === "OPEN" ? "Aberto" : "Fechado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {register.openedBy}
                      {register.closedBy ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          Fechou: {register.closedBy}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {currency.format(register.openingAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {register.expectedAmount != null
                        ? currency.format(register.expectedAmount)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {register.countedAmount != null
                        ? currency.format(register.countedAmount)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {register.difference != null
                        ? currency.format(register.difference)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </main>
  );
}