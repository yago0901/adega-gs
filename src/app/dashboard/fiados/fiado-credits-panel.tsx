"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { allocateCustomerCredits } from "./actions";

type CreditItem = {
  id: string;
  originalAmount: number;
  allocatedAmount: number;
  availableAmount: number;
  description: string | null;
  createdAt: string | Date;
  kind: "CANCELLATION_CREDIT" | "PAYMENT_CREDIT";
};

type FiadoCreditsPanelProps = {
  customerId: string;
  credits: CreditItem[];
  totalAvailableCredit: number;
  totalRemainingDebt: number;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function FiadoCreditsPanel({
  customerId,
  credits,
  totalAvailableCredit,
  totalRemainingDebt,
}: FiadoCreditsPanelProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | "ALL" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleAllocate(creditMovementId?: string) {
    setPendingId(creditMovementId ?? "ALL");
    setMessage("");
    setError("");

    try {
      const result = await allocateCustomerCredits(
        customerId,
        creditMovementId,
      );

      if (!result.success) {
        setError(result.error);
        return;
      }

      const allocated = Number(result.allocatedAmount);

      if (allocated <= 0) {
        setMessage("Não havia dívidas em aberto para abater.");
      } else {
        setMessage(
          `Abatido ${currency.format(allocated)} nas dívidas.` +
            (Number(result.remainingCredit) > 0
              ? ` Crédito restante: ${currency.format(Number(result.remainingCredit))}.`
              : ""),
        );
      }

      router.refresh();
    } catch {
      setError("Não foi possível abater o crédito.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-5">
        <div>
          <h2 className="font-semibold text-slate-900">Créditos na conta</h2>
          <p className="mt-1 text-sm text-slate-500">
            Créditos disponíveis ficam separados das dívidas até alguém abater
            manualmente.
          </p>
        </div>

        {totalAvailableCredit > 0 && totalRemainingDebt > 0 && (
          <button
            type="button"
            onClick={() => void handleAllocate()}
            disabled={pendingId !== null}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pendingId === "ALL"
              ? "Abatendo..."
              : "Abater todo crédito disponível"}
          </button>
        )}
      </div>

      {(message || error) && (
        <div className="border-b border-slate-100 px-5 py-3">
          {message && (
            <p className="text-sm text-emerald-700">{message}</p>
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      )}

      {credits.length === 0 ? (
        <div className="p-10 text-center">
          <h3 className="font-semibold text-slate-800">
            Nenhum crédito encontrado
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Este cliente ainda não possui créditos na conta.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {credits.map((credit) => (
            <div key={credit.id} className="p-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="font-semibold text-slate-900">
                    {credit.kind === "CANCELLATION_CREDIT"
                      ? "Crédito por cancelamento"
                      : "Crédito / recebimento"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Registrado em {formatDate(credit.createdAt)}
                  </p>
                  {credit.description && (
                    <p className="mt-1 text-xs text-slate-500">
                      {credit.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-end gap-6">
                  <div>
                    <p className="text-xs text-slate-500">Original</p>
                    <p className="mt-1 font-semibold">
                      {currency.format(credit.originalAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Já abatido</p>
                    <p className="mt-1 font-semibold text-emerald-600">
                      {currency.format(credit.allocatedAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Disponível</p>
                    <p className="mt-1 font-semibold text-amber-700">
                      {currency.format(credit.availableAmount)}
                    </p>
                  </div>

                  {credit.availableAmount > 0 && totalRemainingDebt > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleAllocate(credit.id)}
                      disabled={pendingId !== null}
                      className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      {pendingId === credit.id ? "Abatendo..." : "Abater"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
