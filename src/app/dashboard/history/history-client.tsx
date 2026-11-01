
"use client";

import { useMemo, useState, useTransition } from "react";
import { cancelSale } from "./actions";

type Sale = {
  id: string;
  status: "COMPLETED" | "CANCELLED";
  paymentMethod: string | null;
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

export function HistoryClient({ sales }: { sales: Sale[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [payment, setPayment] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const date = sale.createdAt.slice(0, 10);

      const matchesSearch =
        sale.id.toLowerCase().includes(search.toLowerCase()) ||
        sale.employee.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        status === "ALL" || sale.status === status;

      const matchesPayment =
        payment === "ALL" || sale.paymentMethod === payment;

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

  function handleCancel(sale: Sale) {
    const confirmed = window.confirm(
      "Deseja realmente cancelar esta venda? Os produtos serão devolvidos ao estoque."
    );

    if (!confirmed) return;

    setMessage("");

    startTransition(async () => {
      const result = await cancelSale(sale.id);

      if (!result.success) {
        setMessage(result.error || "Erro ao cancelar venda.");
        return;
      }

      setSelectedSale(null);
      setMessage("Venda cancelada e estoque atualizado.");
      window.location.reload();
    });
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Histórico de vendas
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Consulte vendas, detalhes e cancelamentos.
        </p>
      </div>

      {message && (
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
          {message}
        </p>
      )}

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
                    {sale.paymentMethod
                      ? paymentLabels[sale.paymentMethod]
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
                  <td className="space-x-3 p-4">
                    <button
                      onClick={() => setSelectedSale(sale)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      Detalhes
                    </button>

                    {sale.status === "COMPLETED" && (
                      <button
                        onClick={() => handleCancel(sale)}
                        disabled={isPending}
                        className="font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    )}
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
              <p>
                <strong>Pagamento:</strong>{" "}
                {selectedSale.paymentMethod
                  ? paymentLabels[selectedSale.paymentMethod]
                  : "Não informado"}
              </p>
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
    </main>
  );
}
