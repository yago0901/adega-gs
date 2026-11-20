"use client";

import { useEffect, useState } from "react";
import { getCustomerOpenDebts } from "@/app/dashboard/pos/customer-account-actions";

export type CancellationResolution = "REFUND" | "CUSTOMER_CREDIT";

type CancelDeliveryModalProps = {
  saleCode: string;
  prepaidAmount: number;
  customerId: string | null;
  customerName: string | null;
  isPending: boolean;
  onConfirm: (input: {
    resolution: CancellationResolution;
    reason: string;
    applyCreditToDebts: boolean;
  }) => Promise<void>;
  onClose: () => void;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function CancelDeliveryModal({
  saleCode,
  prepaidAmount,
  customerId,
  customerName,
  isPending,
  onConfirm,
  onClose,
}: CancelDeliveryModalProps) {
  const [resolution, setResolution] =
    useState<CancellationResolution>("REFUND");
  const [reason, setReason] = useState("");
  const [applyCreditToDebts, setApplyCreditToDebts] = useState(false);
  const [openDebtTotal, setOpenDebtTotal] = useState<number | null>(null);
  const [loadingDebts, setLoadingDebts] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDebts() {
      if (
        resolution !== "CUSTOMER_CREDIT" ||
        !customerId ||
        prepaidAmount <= 0
      ) {
        setOpenDebtTotal(null);
        setApplyCreditToDebts(false);
        return;
      }

      setLoadingDebts(true);
      setError("");

      try {
        const result = await getCustomerOpenDebts(customerId);

        if (cancelled) return;

        if (!result.success) {
          setOpenDebtTotal(null);
          setError(result.error);
          return;
        }

        const total = Number(result.totalDebt);
        setOpenDebtTotal(total);
        setApplyCreditToDebts(false);
      } catch {
        if (!cancelled) {
          setOpenDebtTotal(null);
          setError("Não foi possível consultar as dívidas do cliente.");
        }
      } finally {
        if (!cancelled) {
          setLoadingDebts(false);
        }
      }
    }

    void loadDebts();

    return () => {
      cancelled = true;
    };
  }, [resolution, customerId, prepaidAmount]);

  async function handleSubmit() {
    if (!reason.trim() || reason.trim().length < 3) {
      setError("Informe o motivo do cancelamento.");
      return;
    }

    if (resolution === "CUSTOMER_CREDIT" && !customerName) {
      setError("Não é possível gerar crédito sem cliente vinculado.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onConfirm({
        resolution,
        reason: reason.trim(),
        applyCreditToDebts:
          resolution === "CUSTOMER_CREDIT" &&
          (openDebtTotal ?? 0) > 0 &&
          applyCreditToDebts,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível cancelar a entrega.",
      );
      setSubmitting(false);
    }
  }

  const showDebtChoice =
    resolution === "CUSTOMER_CREDIT" &&
    prepaidAmount > 0 &&
    Boolean(customerId) &&
    openDebtTotal !== null &&
    openDebtTotal > 0;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-delivery-title"
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-6 py-4">
          <h2
            id="cancel-delivery-title"
            className="text-lg font-bold text-gray-900"
          >
            Cancelar entrega #{saleCode}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            O estoque será devolvido. Escolha como tratar o valor já pago.
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-xl bg-gray-50 p-4 text-sm">
            <p className="text-gray-500">Valor antecipado</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {currency.format(prepaidAmount)}
            </p>
            {customerName && (
              <p className="mt-2 text-gray-600">Cliente: {customerName}</p>
            )}
            {prepaidAmount <= 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Não há valor antecipado. O cancelamento apenas devolve o
                estoque.
              </p>
            )}
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-gray-800">
              Resolução financeira
            </legend>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4 hover:bg-gray-50">
              <input
                type="radio"
                name="resolution"
                checked={resolution === "REFUND"}
                onChange={() => setResolution("REFUND")}
                className="mt-1 h-4 w-4 border-gray-300 text-blue-600"
              />
              <span>
                <span className="block font-medium text-gray-900">
                  Estorno
                </span>
                <span className="mt-1 block text-sm text-gray-500">
                  O funcionário/cliente fará o estorno manualmente na
                  maquininha ou devolverá o valor pago.
                </span>
              </span>
            </label>

            <label
              className={`flex items-start gap-3 rounded-xl border border-gray-200 p-4 ${
                prepaidAmount > 0 && customerName
                  ? "cursor-pointer hover:bg-gray-50"
                  : "cursor-not-allowed opacity-60"
              }`}
            >
              <input
                type="radio"
                name="resolution"
                checked={resolution === "CUSTOMER_CREDIT"}
                onChange={() => setResolution("CUSTOMER_CREDIT")}
                disabled={prepaidAmount <= 0 || !customerName}
                className="mt-1 h-4 w-4 border-gray-300 text-blue-600"
              />
              <span>
                <span className="block font-medium text-gray-900">
                  Crédito do cliente
                </span>
                <span className="mt-1 block text-sm text-gray-500">
                  O valor antecipado volta como crédito na conta do cliente
                  para usar em compras futuras.
                  {prepaidAmount <= 0
                    ? " Disponível apenas quando houver pagamento antecipado."
                    : ""}
                </span>
              </span>
            </label>
          </fieldset>

          {resolution === "CUSTOMER_CREDIT" &&
            prepaidAmount > 0 &&
            customerId &&
            loadingDebts && (
              <p className="text-sm text-gray-500">
                Verificando dívidas em aberto...
              </p>
            )}

          {showDebtChoice && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Este cliente possui dívidas em aberto
              </p>
              <p className="text-sm text-amber-800">
                Saldo devedor:{" "}
                <span className="font-semibold">
                  {currency.format(openDebtTotal ?? 0)}
                </span>
                . Deseja abater o crédito de{" "}
                <span className="font-semibold">
                  {currency.format(prepaidAmount)}
                </span>{" "}
                nessas dívidas?
              </p>

              <fieldset className="space-y-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-white p-3">
                  <input
                    type="radio"
                    name="apply-credit"
                    checked={!applyCreditToDebts}
                    onChange={() => setApplyCreditToDebts(false)}
                    className="mt-1 h-4 w-4 border-gray-300 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">
                    Não — manter crédito e débito separados na conta do
                    cliente
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-white p-3">
                  <input
                    type="radio"
                    name="apply-credit"
                    checked={applyCreditToDebts}
                    onChange={() => setApplyCreditToDebts(true)}
                    className="mt-1 h-4 w-4 border-gray-300 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">
                    Sim — abater o crédito nas dívidas mais antigas
                  </span>
                </label>
              </fieldset>
            </div>
          )}

          <label className="block text-sm font-medium text-gray-700">
            Motivo do cancelamento *
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ex.: Cliente desistiu, endereço errado..."
              className="mt-2 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || isPending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Voltar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || isPending || loadingDebts}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting || isPending ? "Cancelando..." : "Confirmar cancelamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
