
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SignOutButton from "./sign-out-button";

const menu = [
  { label: "Dashboard", href: "/dashboard", icon: "⌂", active: true },
  { label: "Frente de caixa", href: "/dashboard/pos", icon: "▣" },
  { label: "Produtos", href: "/dashboard/products", icon: "▤" },
  { label: "Estoque", href: "/dashboard/stock", icon: "▦" },
  { label: "Funcionários", href: "/dashboard/employees", icon: "♙" },
  { label: "Financeiro", href: "/dashboard/finance", icon: "＄" },
  { label: "Histórico", href: "/dashboard/history", icon: "◷" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

async function DashboardContent() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });

  const startOfDay = new Date(`${today}T00:00:00-03:00`);

  const [activeProducts, salesToday, stockBalances] =
    await Promise.all([
      prisma.product.count({
        where: { active: true },
      }),

      prisma.stockMovement.count({
        where: {
          type: "SALE",
          createdAt: { gte: startOfDay },
        },
      }),

      prisma.stockBalance.findMany({
        where: {
          product: { active: true },
        },
        select: {
          quantity: true,
          product: {
            select: {
              name: true,
              minStock: true,
              purchaseCost: true,
            },
          },
        },
      }),
    ]);

  const lowStockProducts = stockBalances
    .filter(
      (item) =>
        item.quantity.toNumber() <= item.product.minStock.toNumber()
    )
    .sort(
      (a, b) =>
        a.quantity.toNumber() - b.quantity.toNumber()
    );

  const inventoryCost = stockBalances.reduce(
    (total, item) =>
      total +
      item.quantity.toNumber() *
        item.product.purchaseCost.toNumber(),
    0
  );

  const cards = [
    {
      label: "Produtos ativos",
      value: activeProducts.toString(),
      description: "Produtos cadastrados e ativos",
      icon: "▤",
    },
    {
      label: "Vendas hoje",
      value: salesToday.toString(),
      description: "Movimentações do tipo venda",
      icon: "▣",
    },
    {
      label: "Estoque baixo",
      value: lowStockProducts.length.toString(),
      description: "Produtos no mínimo ou abaixo dele",
      icon: "⚠",
    },
    {
      label: "Valor em estoque",
      value: formatCurrency(inventoryCost),
      description: "Estimativa pelo custo de compra",
      icon: "＄",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-6 py-6">
          <h1 className="text-xl font-bold tracking-tight">
            ADEGA <span className="text-emerald-600">GS</span>
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Gestão e operação
          </p>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Menu principal
          </p>

          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                item.active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="w-5 text-center text-lg">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <p className="text-xs text-slate-400">Sistema</p>
          <p className="mt-1 text-sm font-medium">Adega GS</p>
          <p className="text-xs text-slate-500">Versão inicial</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 md:px-8">
          <div>
            <p className="text-sm text-slate-500">Painel de controle</p>
            <h2 className="text-xl font-bold">Dashboard</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold">
                {session.user.name}
              </p>
              <p className="text-xs text-slate-500">
                {session.user.email}
              </p>
            </div>
            <SignOutButton />
          </div>
        </header>

        <main className="space-y-8 p-5 md:p-8">
          <section>
            <h3 className="text-lg font-bold">
              Visão geral
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Acompanhe os principais indicadores da sua adega.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">
                      {card.label}
                    </p>
                    <span className="text-xl text-emerald-600">
                      {card.icon}
                    </span>
                  </div>

                  <p className="mt-4 text-2xl font-bold tracking-tight">
                    {card.value}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold">Acesso rápido</h3>
              <p className="mt-1 text-sm text-slate-500">
                Atalhos para as operações mais utilizadas.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Link
                  href="/dashboard/pos"
                  className="rounded-lg border border-slate-200 p-4 transition hover:border-emerald-500 hover:bg-emerald-50"
                >
                  <span className="text-2xl">▣</span>
                  <p className="mt-3 text-sm font-semibold">
                    Abrir caixa
                  </p>
                </Link>

                <Link
                  href="/dashboard/products"
                  className="rounded-lg border border-slate-200 p-4 transition hover:border-emerald-500 hover:bg-emerald-50"
                >
                  <span className="text-2xl">▤</span>
                  <p className="mt-3 text-sm font-semibold">
                    Produtos
                  </p>
                </Link>

                <Link
                  href="/dashboard/stock"
                  className="rounded-lg border border-slate-200 p-4 transition hover:border-emerald-500 hover:bg-emerald-50"
                >
                  <span className="text-2xl">▦</span>
                  <p className="mt-3 text-sm font-semibold">
                    Consultar estoque
                  </p>
                </Link>

                <Link
                  href="/dashboard/history"
                  className="rounded-lg border border-slate-200 p-4 transition hover:border-emerald-500 hover:bg-emerald-50"
                >
                  <span className="text-2xl">◷</span>
                  <p className="mt-3 text-sm font-semibold">
                    Histórico
                  </p>
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">Atenção ao estoque</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Produtos que atingiram o estoque mínimo.
                  </p>
                </div>
                <Link
                  href="/dashboard/stock"
                  className="text-sm font-semibold text-emerald-700 hover:underline"
                >
                  Ver estoque
                </Link>
              </div>

              {lowStockProducts.length === 0 ? (
                <div className="mt-6 rounded-lg bg-slate-50 p-5 text-center">
                  <p className="text-sm font-medium text-slate-600">
                    Nenhum produto em alerta.
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Os alertas aparecerão conforme o estoque for movimentado.
                  </p>
                </div>
              ) : (
                <div className="mt-5 divide-y divide-slate-100">
                  {lowStockProducts.slice(0, 5).map((item, index) => (
                    <div
                      key={`${item.product.name}-${index}`}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Mínimo: {item.product.minStock.toString()}
                        </p>
                      </div>
                      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                        {item.quantity.toString()} em estoque
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 p-8">
          Carregando painel...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
