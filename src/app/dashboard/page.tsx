
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/lib/auth";
import {
  getDashboardAdminMetrics,
  getDashboardCurrentUser,
} from "@/modules/dashboard/queries";
import SignOutButton from "./sign-out-button";
import { Sidebar } from "@/components/layout/sidebar";

import { connection } from "next/server";

const menu = [
  { label: "Dashboard", href: "/dashboard", icon: "⌂", active: true },
  { label: "Frente de caixa", href: "/dashboard/pos", icon: "▣" },
  { label: "Produtos", href: "/dashboard/products", icon: "▤" },
  { label: "Clientes", href: "/dashboard/clients", icon: "♧" },
  { label: "Estoque", href: "/dashboard/stock", icon: "▦" },
  { label: "Funcionários", href: "/dashboard/employees", icon: "♙" },
  { label: "Fiados", href: "/dashboard/fiados", icon: "▧" },
  { label: "Financeiro", href: "/dashboard/finance", icon: "＄" },
  { label: "Motoboys", href: "/dashboard/motoboys", icon: "🏍️" },
  { label: "Histórico", href: "/dashboard/history", icon: "◷" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

async function DashboardContent() {
  await connection();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  const currentUser = await getDashboardCurrentUser(session.user.id);

  if (!currentUser || !currentUser.active) {
    redirect("/");
  }

  if (
    currentUser.role !== "ADMIN" &&
    currentUser.accesses.length === 0
  ) {
    redirect("/");
  }

  const moduleByHref: Record<string, string> = {
    "/dashboard/pos": "POS",
    "/dashboard/products": "PRODUCTS",
    "/dashboard/clients": "CUSTOMERS",
    "/dashboard/stock": "STOCK",
    "/dashboard/employees": "EMPLOYEES",
    "/dashboard/fiados": "FIADOS",
    "/dashboard/finance": "FINANCE",
    "/dashboard/motoboys": "MOTOBOYS",
    "/dashboard/history": "HISTORY",
  };

  const visibleMenu = menu.filter((item) => {
    if (currentUser.role === "ADMIN") return true;

    if (item.href === "/dashboard") {
      return currentUser.accesses.length > 1;
    }

    const requiredModule = moduleByHref[item.href];

    return currentUser.accesses.some(
      (access) => access.module === requiredModule
    );
  });


  let activeProducts = 0;
  let salesToday = 0;
  let customersWithDebt = 0;

  let lowStockProducts: {
    name: string;
    unit: string;
    minStock: number;
    quantity: number;
    purchaseCost: number;
  }[] = [];

  let inventoryCost = 0;

  if (currentUser.role === "ADMIN") {
    const metrics = await getDashboardAdminMetrics();

    activeProducts = metrics.activeProducts;
    salesToday = metrics.salesToday;
    customersWithDebt = metrics.customersWithDebt;
    lowStockProducts = metrics.lowStockProducts;
    inventoryCost = metrics.inventoryCost;
  }

  const isAdmin = currentUser.role === "ADMIN";

  const cards = [
    {
      label: "Produtos ativos",
      value: activeProducts.toString(),
      description: "Catálogo disponível para venda",
      icon: "▤",
      href: "/dashboard/products",
    },
    {
      label: "Vendas hoje",
      value: salesToday.toString(),
      description: "Vendas concluídas no dia",
      icon: "▣",
      href: "/dashboard/history",
    },
    {
      label: "Estoque baixo",
      value: lowStockProducts.length.toString(),
      description: "Itens no mínimo ou abaixo",
      icon: "⚠",
      href: "/dashboard/stock",
    },
    {
      label: "Clientes em fiado",
      value: customersWithDebt.toString(),
      description: "Com saldo devedor em aberto",
      icon: "▧",
      href: "/dashboard/fiados",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Sidebar menu={visibleMenu} />

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
          {isAdmin && (
            <section>
              <h3 className="text-lg font-bold">Visão geral</h3>
              <p className="mt-1 text-sm text-slate-500">
                Acompanhe os principais indicadores da sua adega.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map((card) => (
                  <Link
                    key={card.label}
                    href={card.href}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-400 hover:shadow-md"
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
                  </Link>
                ))}
              </div>

              <p className="mt-4 text-sm text-slate-500">
                Valor estimado em estoque:{" "}
                <span className="font-semibold text-slate-800">
                  {formatCurrency(inventoryCost)}
                </span>
              </p>
            </section>
          )}

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold">Acesso rápido</h3>
              <p className="mt-1 text-sm text-slate-500">
                Atalhos para as operações mais utilizadas.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {visibleMenu
                  .filter((item) => item.href !== "/dashboard")
                  .map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-lg border border-slate-200 p-4 transition hover:border-emerald-500 hover:bg-emerald-50"
                    >
                      <span className="text-2xl">{item.icon}</span>
                      <p className="mt-3 text-sm font-semibold">{item.label}</p>
                    </Link>
                  ))}
              </div>
            </div>

            {isAdmin && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold">Atenção ao estoque</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Itens que atingiram o estoque mínimo.
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
                    {lowStockProducts.slice(0, 5).map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold">
                            {item.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            Mínimo: {item.minStock} {item.unit}
                          </p>
                        </div>

                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                          {item.quantity} em estoque
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
