"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Sale = {
  id: string;
  status: "COMPLETED" | "CANCELLED";
  payments: {
    paymentMethod: string;
    amount: number;
  }[];
  total: number;
  createdAt: string;
  cancelledAt: string | null;
  employee: string;
  items: {
    id: string;
    productName: string;
    productCode: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }[];
};


type CashRegisterHistory = {
  id: string;
  status: "OPEN" | "CLOSED";
  openingAmount: number;
  expectedAmount: number | null;
  countedAmount: number | null;
  difference: number | null;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy: string | null;
  movements: {
    id: string;
    type: "SUPPLY" | "WITHDRAWAL";
    amount: number;
    description: string | null;
    createdAt: string;
    employee: string;
  }[];
  sales: {
    id: string;
    status: "COMPLETED" | "CANCELLED";
    total: number;
    payments: {
      paymentMethod: string;
      amount: number;
    }[];
    createdAt: string;
  }[];
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

type HistoryClientProps = {
  sales: Sale[];
  cashRegisters: CashRegisterHistory[];
};

export function HistoryClient({
  sales,
  cashRegisters,
}: HistoryClientProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [payment, setPayment] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [activeTab, setActiveTab] = useState<"SALES" | "CASH_REGISTERS">("SALES");
  const [selectedCashRegister, setSelectedCashRegister] =
    useState<CashRegisterHistory | null>(null);

  const filteredSales = useMemo(() => {

    return sales.filter((sale) => {
      const date = sale.createdAt.slice(0, 10);

      const matchesSearch =
        sale.id.toLowerCase().includes(search.toLowerCase()) ||
        sale.employee.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        status === "ALL" || sale.status === status;

      const matchesPayment =
        payment === "ALL" ||
        sale.payments.some((item) => item.paymentMethod === payment);

      const matchesStart = !startDate || date >= startDate;
      const matchesEnd = !endDate || date <= endDate;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPayment &&
        matchesStart &&
        matchesEnd
      );
    });
  }, [sales, search, status, payment, startDate, endDate]);

  const cashRegisterPaymentSummary = useMemo(() => {
    const totals: Record<string, number> = {};

    selectedCashRegister?.sales
      .filter((sale) => sale.status === "COMPLETED")
      .forEach((sale) => {
        sale.payments.forEach((payment) => {
          totals[payment.paymentMethod] =
            (totals[payment.paymentMethod] ?? 0) + payment.amount;
        });
      });

    return totals;
  }, [selectedCashRegister]);

  return (
    <main className="space-y-6 p-6">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-emerald-700 hover:underline"
        >
          ← Dashboard
        </Link>

        <h1 className="mt-3 text-2xl font-bold text-gray-900">
          Histórico
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Consulte vendas, sessões de caixa e movimentações.
        </p>

      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("SALES")}
          className={`border-b-2 px-4 py-3 text-sm font-medium transition ${activeTab === "SALES"
            ? "border-emerald-600 text-emerald-700"
            : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
        >
          Vendas ({sales.length})
        </button>

        <button
          onClick={() => setActiveTab("CASH_REGISTERS")}
          className={`border-b-2 px-4 py-3 text-sm font-medium transition ${activeTab === "CASH_REGISTERS"
            ? "border-emerald-600 text-emerald-700"
            : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
        >
          Caixas ({cashRegisters.length})
        </button>
      </div>

      {activeTab === "SALES" && (
        <section className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar venda ou funcionário"
            className="rounded-lg border p-2 text-sm md:col-span-2"
          />

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border p-2 text-sm"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border p-2 text-sm"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border p-2 text-sm"
          >
            <option value="ALL">Todas as situações</option>
            <option value="COMPLETED">Concluídas</option>
            <option value="CANCELLED">Canceladas</option>
          </select>

          <select
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            className="rounded-lg border p-2 text-sm md:col-span-2"
          >
            <option value="ALL">Todas as formas de pagamento</option>
            <option value="CASH">Dinheiro</option>
            <option value="PIX">Pix</option>
            <option value="CREDIT_CARD">Crédito</option>
            <option value="DEBIT_CARD">Débito</option>
          </select>
        </section>
      )}

      {activeTab === "CASH_REGISTERS" && (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b p-4">
            <p className="font-semibold">
              {cashRegisters.length} sessão(ões) de caixa encontrada(s)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="p-4">Abertura</th>
                  <th className="p-4">Fechamento</th>
                  <th className="p-4">Responsável</th>
                  <th className="p-4">Valor inicial</th>
                  <th className="p-4">Diferença</th>
                  <th className="p-4">Situação</th>
                  <th className="p-4">Ações</th>
                </tr>
              </thead>

              <tbody>
                {cashRegisters.map((register) => (
                  <tr key={register.id} className="border-t">
                    <td className="p-4">
                      {new Date(register.openedAt).toLocaleString("pt-BR")}
                    </td>

                    <td className="p-4">
                      {register.closedAt
                        ? new Date(register.closedAt).toLocaleString("pt-BR")
                        : "Em andamento"}
                    </td>

                    <td className="p-4">{register.openedBy}</td>

                    <td className="p-4">
                      {currency.format(register.openingAmount)}
                    </td>

                    <td className="p-4 font-semibold">
                      {register.difference !== null
                        ? currency.format(register.difference)
                        : "—"}
                    </td>

                    <td className="p-4">
                      <span
                        className={
                          register.status === "OPEN"
                            ? "rounded-full bg-emerald-50 px-2 py-1 text-emerald-700"
                            : "rounded-full bg-gray-100 px-2 py-1 text-gray-700"
                        }
                      >
                        {register.status === "OPEN" ? "Aberto" : "Fechado"}
                      </span>
                    </td>

                    <td className="p-4">
                      <button
                        onClick={() => setSelectedCashRegister(register)}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}

                {cashRegisters.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      Nenhuma sessão de caixa encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {activeTab === "SALES" && (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b p-4">
            <p className="font-semibold">
              {filteredSales.length} venda(s) encontrada(s)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="p-4">Data</th>
                  <th className="p-4">Funcionário</th>
                  <th className="p-4">Pagamento</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Situação</th>
                  <th className="p-4">Ações</th>
                </tr>
              </thead>

              <tbody>
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="border-t">
                    <td className="p-4">
                      {new Date(sale.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-4">{sale.employee}</td>
                    <td className="p-4">
                      {sale.payments.length > 0
                        ? sale.payments
                          .map(
                            (item) =>
                              paymentLabels[item.paymentMethod] ?? item.paymentMethod,
                          )
                          .join(", ")
                        : "Não informado"}
                    </td>
                    <td className="p-4 font-semibold">
                      {currency.format(sale.total)}
                    </td>
                    <td className="p-4">
                      <span
                        className={
                          sale.status === "COMPLETED"
                            ? "rounded-full bg-emerald-50 px-2 py-1 text-emerald-700"
                            : "rounded-full bg-red-50 px-2 py-1 text-red-700"
                        }
                      >
                        {sale.status === "COMPLETED"
                          ? "Concluída"
                          : "Cancelada"}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => setSelectedSale(sale)}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      Nenhuma venda encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">Detalhes da venda</h2>
                <p className="mt-1 break-all text-xs text-gray-500">
                  {selectedSale.id}
                </p>
              </div>

              <button
                onClick={() => setSelectedSale(null)}
                className="text-2xl text-gray-500"
                aria-label="Fechar detalhes"
              >
                ×
              </button>
            </div>

            <div className="mt-5 space-y-2 text-sm">
              <p>
                <strong>Data:</strong>{" "}
                {new Date(selectedSale.createdAt).toLocaleString("pt-BR")}
              </p>
              <p>
                <strong>Funcionário:</strong> {selectedSale.employee}
              </p>
              <div>
                <p>
                  <strong>Pagamento:</strong>
                </p>

                {selectedSale.payments.length > 0 ? (
                  <div className="ml-2">
                    {selectedSale.payments.map((item, index) => (
                      <p key={`${item.paymentMethod}-${index}`}>
                        {paymentLabels[item.paymentMethod] ?? item.paymentMethod}:{" "}
                        {currency.format(item.amount)}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="ml-2">Não informado</p>
                )}
              </div>
              <p>
                <strong>Situação:</strong>{" "}
                {selectedSale.status === "COMPLETED"
                  ? "Concluída"
                  : "Cancelada"}
              </p>
            </div>

            <h3 className="mt-6 font-semibold">Produtos</h3>

            <div className="mt-3 divide-y">
              {selectedSale.items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-gray-500">
                      {item.quantity} × {currency.format(item.unitPrice)}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {currency.format(item.total)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t pt-4 text-right">
              <p className="text-sm text-gray-500">Total da venda</p>
              <p className="text-2xl font-bold">
                {currency.format(selectedSale.total)}
              </p>
            </div>

            <button
              onClick={() => setSelectedSale(null)}
              className="mt-5 w-full rounded-lg border px-4 py-3 font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      )}


      {selectedCashRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">Detalhes do caixa</h2>
                <p className="mt-1 break-all text-xs text-gray-500">
                  {selectedCashRegister.id}
                </p>
              </div>

              <button
                onClick={() => setSelectedCashRegister(null)}
                className="text-2xl text-gray-500"
                aria-label="Fechar detalhes"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Abertura</p>
                <p className="mt-1 font-semibold">
                  {new Date(selectedCashRegister.openedAt).toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Responsável: {selectedCashRegister.openedBy}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Fechamento</p>
                <p className="mt-1 font-semibold">
                  {selectedCashRegister.closedAt
                    ? new Date(selectedCashRegister.closedAt).toLocaleString("pt-BR")
                    : "Caixa ainda aberto"}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Responsável: {selectedCashRegister.closedBy ?? "—"}
                </p>
              </div>
            </div>

            <h3 className="mt-6 font-semibold">Resumo financeiro</h3>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Valor inicial</p>
                <p className="text-xl font-bold">
                  {currency.format(selectedCashRegister.openingAmount)}
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Valor esperado</p>
                <p className="text-xl font-bold">
                  {selectedCashRegister.expectedAmount !== null
                    ? currency.format(selectedCashRegister.expectedAmount)
                    : "Não informado"}
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Valor contado</p>
                <p className="text-xl font-bold">
                  {selectedCashRegister.countedAmount !== null
                    ? currency.format(selectedCashRegister.countedAmount)
                    : "Não informado"}
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Diferença</p>
                <p
                  className={`text-xl font-bold ${selectedCashRegister.difference === null
                    ? "text-gray-700"
                    : selectedCashRegister.difference < 0
                      ? "text-red-600"
                      : selectedCashRegister.difference > 0
                        ? "text-emerald-600"
                        : "text-gray-700"
                    }`}
                >
                  {selectedCashRegister.difference !== null
                    ? currency.format(selectedCashRegister.difference)
                    : "Não informado"}
                </p>
              </div>
            </div>

            <h3 className="mt-6 font-semibold">
              Resumo por forma de pagamento
            </h3>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {Object.entries(paymentLabels).map(([method, label]) => (
                <div
                  key={method}
                  className="rounded-lg border p-4"
                >
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="mt-1 text-xl font-bold">
                    {currency.format(cashRegisterPaymentSummary[method] ?? 0)}
                  </p>
                </div>
              ))}
            </div>

            <h3 className="mt-6 font-semibold">Movimentações de caixa</h3>

            <div className="mt-3 divide-y rounded-lg border">
              {selectedCashRegister.movements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex flex-wrap justify-between gap-3 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {movement.type === "SUPPLY" ? "Suprimento" : "Sangria"}
                    </p>
                    <p className="text-gray-500">
                      {movement.description || "Sem descrição"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {movement.employee} •{" "}
                      {new Date(movement.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>

                  <p
                    className={`font-semibold ${movement.type === "SUPPLY" ? "text-emerald-600" : "text-red-600"
                      }`}
                  >
                    {movement.type === "SUPPLY" ? "+" : "-"}
                    {currency.format(movement.amount)}
                  </p>
                </div>
              ))}

              {selectedCashRegister.movements.length === 0 && (
                <p className="p-4 text-center text-sm text-gray-500">
                  Nenhuma movimentação registrada.
                </p>
              )}
            </div>

            <h3 className="mt-6 font-semibold">Vendas da sessão</h3>

            <div className="mt-3 divide-y rounded-lg border">
              {selectedCashRegister.sales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex flex-wrap justify-between gap-3 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      Venda #{sale.id.slice(-8)}
                    </p>
                    <p className="text-gray-500">
                      {new Date(sale.createdAt).toLocaleString("pt-BR")}
                    </p>
                    <p className="text-xs text-gray-500">
                      {sale.payments.length > 0
                        ? sale.payments
                          .map(
                            (item) =>
                              `${paymentLabels[item.paymentMethod] ?? item.paymentMethod}: ${currency.format(item.amount)}`
                          )
                          .join(" • ")
                        : "Pagamento não informado"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold">
                      {currency.format(sale.total)}
                    </p>
                    <p
                      className={
                        sale.status === "COMPLETED"
                          ? "text-xs text-emerald-600"
                          : "text-xs text-red-600"
                      }
                    >
                      {sale.status === "COMPLETED" ? "Concluída" : "Cancelada"}
                    </p>
                  </div>
                </div>
              ))}

              {selectedCashRegister.sales.length === 0 && (
                <p className="p-4 text-center text-sm text-gray-500">
                  Nenhuma venda vinculada a esta sessão.
                </p>
              )}
            </div>

            <button
              onClick={() => setSelectedCashRegister(null)}
              className="mt-6 w-full rounded-lg border px-4 py-3 font-medium hover:bg-gray-50"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
