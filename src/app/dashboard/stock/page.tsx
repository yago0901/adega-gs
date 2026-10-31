
import Link from "next/link";
import { Suspense } from "react";

import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";

import {
  registerStockEntry,
  registerStockLoss,
  registerStockAdjustment,
} from "./actions";

export const metadata = {
  title: "Estoque | Adega GS",
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function StockPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-slate-500">
          Carregando estoque...
        </div>
      }
    >
      <StockContent />
    </Suspense>
  );
}

async function StockContent() {
  await requireModuleAccess("STOCK");

  const products = await prisma.product.findMany({
    where: { active: true },
    include: {
      category: true,
      balance: true,
    },
    orderBy: { name: "asc" },
  });

  const stockItems = products.map((product) => ({
    ...product,
    quantity: product.balance?.quantity.toNumber() ?? 0,
    minimum: product.minStock.toNumber(),
    cost: product.purchaseCost.toNumber(),
  }));

  const totalProducts = stockItems.length;

  const lowStock = stockItems.filter(
    (product) => product.quantity <= product.minimum
  );

  const totalValue = stockItems.reduce(
    (total, product) => total + product.quantity * product.cost,
    0
  );

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

            <h1 className="mt-3 text-2xl font-bold">Estoque</h1>

            <p className="mt-1 text-sm text-slate-500">
              Controle de quantidades e movimentações da adega.
            </p>
          </div>

          <Link
            href="/dashboard/stock/movements"
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50"
          >
            Histórico de movimentações
          </Link>
        </div>

        {/* RESUMO */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Produtos ativos</p>
            <p className="mt-2 text-2xl font-bold">{totalProducts}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">
              Produtos com estoque baixo
            </p>
            <p className="mt-2 text-2xl font-bold text-red-600">
              {lowStock.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">
              Valor estimado do estoque
            </p>
            <p className="mt-2 text-2xl font-bold">
              {formatCurrency(totalValue)}
            </p>
          </div>
        </div>

        {/* LISTAGEM */}
        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-bold">Produtos em estoque</h2>
            <p className="mt-1 text-sm text-slate-500">
              Consulte os saldos e registre movimentações.
            </p>
          </div>

          {stockItems.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nenhum produto ativo cadastrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Produto</th>
                    <th className="px-5 py-4">Categoria</th>
                    <th className="px-5 py-4">Saldo atual</th>
                    <th className="px-5 py-4">Mínimo</th>
                    <th className="px-5 py-4">Situação</th>
                    <th className="px-5 py-4">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {stockItems.map((product) => {
                    const isLow =
                      product.quantity <= product.minimum;

                    return (
                      <tr key={product.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4 font-semibold">
                          {product.name}
                          <p className="mt-1 text-xs font-normal text-slate-400">
                            {product.code}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          {product.category.name}
                        </td>

                        <td className="px-5 py-4 font-semibold">
                          {product.quantity} {product.unit}
                        </td>

                        <td className="px-5 py-4">
                          {product.minimum} {product.unit}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              isLow
                                ? "bg-red-50 text-red-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {isLow ? "Estoque baixo" : "Normal"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-3">
                            <Link
                              href={`/dashboard/stock?entry=${product.id}#movimentar`}
                              className="font-medium text-emerald-700 hover:underline"
                            >
                              Entrada
                            </Link>

                            <Link
                              href={`/dashboard/stock?loss=${product.id}#movimentar`}
                              className="font-medium text-red-600 hover:underline"
                            >
                              Perda
                            </Link>

                            <Link
                              href={`/dashboard/stock?adjust=${product.id}#movimentar`}
                              className="font-medium text-slate-600 hover:underline"
                            >
                              Ajustar
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* FORMULÁRIOS */}
        <section
          id="movimentar"
          className="mt-8 grid scroll-mt-6 gap-5 lg:grid-cols-3"
        >
          <form
            action={registerStockEntry}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
          >
            <div>
              <h2 className="font-bold text-emerald-700">
                Entrada de mercadoria
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Adiciona quantidade ao estoque.
              </p>
            </div>

            <label className="block text-sm font-medium">
              Produto
              <select
                name="productId"
                required
                defaultValue=""
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
              >
                <option value="" disabled>
                  Selecione
                </option>
                {stockItems.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Quantidade
              <input
                name="quantity"
                type="number"
                min="0.001"
                step="0.001"
                required
                className="mt-2 w-full rounded-lg border border-slate-300 p-3"
              />
            </label>

            <label className="block text-sm font-medium">
              Justificativa
              <input
                name="reason"
                required
                minLength={3}
                placeholder="Ex.: Compra de fornecedor"
                className="mt-2 w-full rounded-lg border border-slate-300 p-3"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Registrar entrada
            </button>
          </form>

          <form
            action={registerStockLoss}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
          >
            <div>
              <h2 className="font-bold text-red-600">
                Registrar perda
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Retira quantidade do estoque.
              </p>
            </div>

            <label className="block text-sm font-medium">
              Produto
              <select
                name="productId"
                required
                defaultValue=""
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
              >
                <option value="" disabled>
                  Selecione
                </option>
                {stockItems.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Quantidade
              <input
                name="quantity"
                type="number"
                min="0.001"
                step="0.001"
                required
                className="mt-2 w-full rounded-lg border border-slate-300 p-3"
              />
            </label>

            <label className="block text-sm font-medium">
              Justificativa
              <input
                name="reason"
                required
                minLength={3}
                placeholder="Ex.: Produto vencido"
                className="mt-2 w-full rounded-lg border border-slate-300 p-3"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
            >
              Registrar perda
            </button>
          </form>

          <form
            action={registerStockAdjustment}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
          >
            <div>
              <h2 className="font-bold text-slate-700">
                Ajustar inventário
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Informa a quantidade física encontrada na contagem.
              </p>
            </div>

            <label className="block text-sm font-medium">
              Produto
              <select
                name="productId"
                required
                defaultValue=""
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
              >
                <option value="" disabled>
                  Selecione
                </option>
                {stockItems.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Quantidade física encontrada
              <input
                name="quantity"
                type="number"
                min="0.001"
                step="0.001"
                required
                className="mt-2 w-full rounded-lg border border-slate-300 p-3"
              />
            </label>

            <label className="block text-sm font-medium">
              Justificativa
              <input
                name="reason"
                required
                minLength={3}
                placeholder="Ex.: Conferência física"
                className="mt-2 w-full rounded-lg border border-slate-300 p-3"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Ajustar estoque
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
