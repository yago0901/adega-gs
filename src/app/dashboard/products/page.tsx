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
        <ProductsListClient initial={initial} />
      </div>
    </main>
  );
}