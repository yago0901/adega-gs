import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

import { requireModuleAccess } from "@/lib/permissions";
import { listProducts } from "@/modules/products/list";
import { ProductsListClient } from "./products-list-client";

export const metadata = {
  title: "Produtos | Adega GS",
};

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-slate-500">
          Carregando produtos...
        </div>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}

async function ProductsContent() {
  await connection();
  await requireModuleAccess("PRODUCTS");

  const initial = await listProducts({ page: 1, pageSize: 20 });

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

            <h1 className="mt-3 text-2xl font-bold">Produtos</h1>

            <p className="mt-1 text-sm text-slate-500">
              Cadastro e consulta do catálogo da adega.
            </p>
          </div>

          <Link
            href="/dashboard/products/new"
            className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            + Novo produto
          </Link>
        </div>

        <div className="mt-8">
          <ProductsListClient initial={initial} />
        </div>
      </div>
    </main>
  );
}