
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import { getCustomerOpenDebts, receiveCustomerDebtPayment } from "./customer-account-actions";

type Customer = {
  id: string;
  name: string;
  phone: string;
};

type PaymentMethod =
  | "CASH"
  | "PIX"
  | "CREDIT_CARD"
  | "DEBIT_CARD";

type PaymentRequest = {
  paymentMethod: PaymentMethod;
  amount: string;
};

type OpenDebtsResult = Extract<
  Awaited<ReturnType<typeof getCustomerOpenDebts>>,
  { success: true }
>;

type DebtPaymentSuccess = Extract<
  Awaited<ReturnType<typeof receiveCustomerDebtPayment>>,
  { success: true }
>;

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function parseMoneyToCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [integer, decimal = ""] = normalized.split(".");

  return (
    Number(integer) * 100 +
    Number(decimal.padEnd(2, "0"))
  );
}

export default function ReceiveDebtModal({
  customers,
  onClose,
  onSuccess,
  initialCustomerId,
}: {
  customers: Customer[];
  onClose: () => void;
  onSuccess: (result: DebtPaymentSuccess) => void;
  initialCustomerId?: string;
}) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [showCustomerOptions, setShowCustomerOptions] = useState(false);

  const [debtsData, setDebtsData] = useState<OpenDebtsResult | null>(null);
  const [amountToApply, setAmountToApply] = useState("");

  const [payments, setPayments] = useState<PaymentRequest[]>([
    {
      paymentMethod: "CASH",
      amount: "",
    },
  ]);

  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const availableCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();

    if (!term) return [];

    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(term) ||
        customer.phone.includes(term),
    );
  }, [customers, customerSearch]);

  const amountToApplyCents = parseMoneyToCents(amountToApply);

  const paymentAmounts = payments.map((payment) =>
    parseMoneyToCents(payment.amount),
  );

  const totalTenderedCents = paymentAmounts.reduce<number>(
    (sum, amount) => sum + (amount ?? 0),
    0,
  );

  const cashReceivedCents = payments.reduce((sum, payment) => {
    if (payment.paymentMethod !== "CASH") return sum;

    return sum + (parseMoneyToCents(payment.amount) ?? 0);
  }, 0);

  const changeAmountCents =
    amountToApplyCents !== null
      ? Math.max(0, totalTenderedCents - amountToApplyCents)
      : 0;

  const hasInvalidChange =
    changeAmountCents > cashReceivedCents;

  const hasDuplicatePaymentMethods =
    new Set(
      payments
        .filter((payment) => {
          const amount = parseMoneyToCents(payment.amount);
          return amount !== null && amount > 0;
        })
        .map((payment) => payment.paymentMethod),
    ).size !==
    payments.filter((payment) => {
      const amount = parseMoneyToCents(payment.amount);
      return amount !== null && amount > 0;
    }).length;

  const totalDebtCents = debtsData
    ? Math.round(Number(debtsData.totalDebt) * 100)
    : 0;

  const isPaymentValid =
    amountToApplyCents !== null &&
    amountToApplyCents > 0 &&
    amountToApplyCents <= totalDebtCents &&
    paymentAmounts.every(
      (amount) => amount !== null && amount >= 0,
    ) &&
    totalTenderedCents >= amountToApplyCents &&
    !hasInvalidChange &&
    !hasDuplicatePaymentMethods &&
    payments.some(
      (payment) =>
        (parseMoneyToCents(payment.amount) ?? 0) > 0,
    );

  const handleSelectCustomer = useCallback((customer: Customer) => {
    setCustomerSearch(`${customer.name} — ${customer.phone}`);
    setSelectedCustomerId(customer.id);
    setShowCustomerOptions(false);

    setDebtsData(null);
    setAmountToApply("");
    setPayments([
      {
        paymentMethod: "CASH",
        amount: "",
      },
    ]);
    setError("");

    startTransition(async () => {
      const result = await getCustomerOpenDebts(customer.id);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setDebtsData(result);

      if (Number(result.totalDebt) > 0) {
        const initialAmount = Number(result.totalDebt).toFixed(2);

        setAmountToApply(initialAmount);
        setPayments([
          {
            paymentMethod: "CASH",
            amount: initialAmount,
          },
        ]);
      } else {
        setError("Este cliente não possui dívidas em aberto.");
      }
    });
  }, []);

  useEffect(() => {
    if (!initialCustomerId) return;

    const customer = customers.find(
      (item) => item.id === initialCustomerId,
    );

    if (customer) {
      handleSelectCustomer(customer);
    }
  }, [initialCustomerId, customers, handleSelectCustomer]);

  function handlePaymentChange(
    index: number,
    field: "paymentMethod" | "amount",
    value: string,
  ) {
    setPayments((current) =>
      current.map((payment, i) =>
        i === index
          ? {
            ...payment,
            [field]:
              field === "amount"
                ? value.replace(/[^\d.,]/g, "")
                : value,
          }
          : payment,
      ),
    );
  }

  function handleAddPayment() {
    if (payments.length >= 4) return;

    const usedMethods = new Set(
      payments.map((payment) => payment.paymentMethod),
    );

    const nextMethod = (
      ["CASH", "PIX", "CREDIT_CARD", "DEBIT_CARD"] as PaymentMethod[]
    ).find((method) => !usedMethods.has(method));

    if (!nextMethod) return;

    setPayments((current) => [
      ...current,
      {
        paymentMethod: nextMethod,
        amount: "",
      },
    ]);
  }

  function handleRemovePayment(index: number) {
    setPayments((current) =>
      current.filter((_, i) => i !== index),
    );
  }

  function handleReceivePayment() {
    if (
      !selectedCustomerId ||
      !amountToApply.trim() ||
      !isPaymentValid ||
      isPending
    ) {
      return;
    }

    setError("");

    const normalizedPayments = payments
      .filter((payment) => {
        const cents = parseMoneyToCents(payment.amount);
        return cents !== null && cents > 0;
      })
      .map((payment) => ({
        ...payment,
        amount: payment.amount.trim().replace(",", "."),
      }));

    startTransition(async () => {
      try {
        const result = await receiveCustomerDebtPayment(
          selectedCustomerId,
          amountToApply.trim().replace(",", "."),
          normalizedPayments,
        );

        if (!result.success) {
          setError(result.error);
          return;
        }

        onSuccess(result);
      } catch {
        setError("Não foi possível registrar o recebimento. Tente novamente.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receive-debt-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
          <div>
            <h2
              id="receive-debt-title"
              className="text-xl font-bold text-gray-900"
            >
              Pagar fiado
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Consulte as dívidas do cliente e registre um recebimento.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-50"
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        <div className="relative z-20 shrink-0 border-b border-gray-100 px-6 py-4">
          <label
            htmlFor="debtCustomerSearch"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Cliente
          </label>

          <input
            id="debtCustomerSearch"
            type="text"
            value={customerSearch}
            placeholder="Buscar por nome ou telefone..."
            disabled={isPending}
            onChange={(event) => {
              setCustomerSearch(event.target.value);
              setSelectedCustomerId("");
              setDebtsData(null);
              setAmountToApply("");
              setShowCustomerOptions(true);
              setError("");
            }}
            onFocus={() => setShowCustomerOptions(true)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />

          {showCustomerOptions &&
            customerSearch.trim() &&
            !selectedCustomerId && (
              <div className="absolute left-6 right-6 z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {availableCustomers.length > 0 ? (
                  availableCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      disabled={isPending}
                      onClick={() => handleSelectCustomer(customer)}
                      className="block w-full border-b border-gray-100 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span className="block font-medium text-gray-900">
                        {customer.name}
                      </span>

                      <span className="mt-0.5 block text-xs text-gray-500">
                        {customer.phone || "Telefone não informado"}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="p-3 text-sm text-gray-500">
                    Nenhum cliente encontrado.
                  </p>
                )}
              </div>
            )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {isPending && !debtsData && (
          <p className="mt-4 text-sm text-gray-500">
            Consultando dívidas...
          </p>
        )}

        {debtsData && (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex justify-between gap-3">
                <span className="text-sm text-gray-600">
                  Saldo devedor de {debtsData.customerName}
                </span>

                <strong className="text-lg text-red-600">
                  {currency.format(Number(debtsData.totalDebt))}
                </strong>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-800">
                Dívidas em aberto
              </h3>

              <div className="max-h-40 space-y-2 overflow-y-auto">
                {debtsData.debts.map((debt) => (
                  <div
                    key={debt.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {debt.description || "Venda fiada"}
                      </p>

                      <p className="text-xs text-gray-500">
                        {new Date(debt.createdAt).toLocaleString("pt-BR")}
                      </p>

                      <p className="text-xs text-gray-500">
                        Original: {currency.format(Number(debt.originalAmount))}
                        {" • "}
                        Pago: {currency.format(Number(debt.paidAmount))}
                      </p>
                    </div>

                    <strong className="shrink-0 text-sm text-red-600">
                      {currency.format(Number(debt.remainingAmount))}
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <label
                htmlFor="amountToApply"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Valor que será abatido da dívida (R$)
              </label>

              <input
                id="amountToApply"
                type="text"
                inputMode="decimal"
                value={amountToApply}
                onChange={(event) =>
                  setAmountToApply(
                    event.target.value.replace(/[^\d.,]/g, ""),
                  )
                }
                disabled={isPending}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-lg font-semibold text-gray-900 outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">
                  Formas de pagamento
                </h3>

                <button
                  type="button"
                  onClick={handleAddPayment}
                  disabled={payments.length >= 4 || isPending}
                  className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50"
                >
                  + Adicionar
                </button>
              </div>

              {payments.map((payment, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select
                    value={payment.paymentMethod}
                    disabled={isPending}
                    onChange={(event) =>
                      handlePaymentChange(
                        index,
                        "paymentMethod",
                        event.target.value,
                      )
                    }
                    className="min-w-0 flex-1 rounded-md border border-gray-300 p-2 text-sm"
                  >
                    <option value="CASH">Dinheiro</option>
                    <option value="PIX">PIX</option>
                    <option value="CREDIT_CARD">Cartão de crédito</option>
                    <option value="DEBIT_CARD">Cartão de débito</option>
                  </select>

                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Valor"
                    value={payment.amount}
                    onChange={(event) =>
                      handlePaymentChange(
                        index,
                        "amount",
                        event.target.value,
                      )
                    }
                    disabled={isPending}
                    className="w-28 rounded-md border border-gray-300 p-2 text-sm"
                  />

                  {payments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePayment(index)}
                      disabled={isPending}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remover
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-lg bg-gray-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Total recebido:
                </span>
                <strong>
                  {currency.format(totalTenderedCents / 100)}
                </strong>
              </div>

              {changeAmountCents > 0 && !hasInvalidChange && (
                <div className="flex justify-between rounded-lg bg-green-50 p-3 font-bold text-green-700">
                  <span>Troco:</span>
                  <span>
                    {currency.format(changeAmountCents / 100)}
                  </span>
                </div>
              )}

              {hasInvalidChange && (
                <p className="rounded-lg bg-red-50 p-3 text-red-700">
                  O troco de {currency.format(changeAmountCents / 100)} precisa
                  ser coberto integralmente pelo dinheiro. PIX e cartões não
                  podem gerar troco.
                </p>
              )}

              {amountToApplyCents !== null &&
                amountToApplyCents > totalDebtCents && (
                  <p className="text-red-600">
                    O valor informado supera a dívida em aberto.
                  </p>
                )}

              {totalTenderedCents <
                (amountToApplyCents ?? 0) && (
                  <p className="text-amber-700">
                    O valor recebido é inferior ao valor que será abatido.
                  </p>
                )}

              {hasDuplicatePaymentMethods && (
                <p className="text-red-600">
                  Não repita a mesma forma de pagamento.
                </p>
              )}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleReceivePayment}
            disabled={
              isPending ||
              !debtsData ||
              !isPaymentValid
            }
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Processando..." : "Confirmar recebimento"}
          </button>
        </div>
      </div>
    </div>
  );
}
