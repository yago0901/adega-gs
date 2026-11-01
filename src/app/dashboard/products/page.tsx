
import Link from "next/link";
import { Suspense } from "react";

import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";
import { deactivateProduct } from "./actions";

export const metadata = {
  title: "Produtos | Adega GS",
};

// Parte estática da página
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

// Parte dinâmica: sessão e banco de dados
async function ProductsContent() {
  await requireModuleAccess("PRODUCTS");

  const products = await prisma.product.findMany({
    where: { active: true },
    include: {
      category: true,
      stockItem: {
        include: {
          balance: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

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

            <h1 className="mt-3 text-2xl font-bold">
              Produtos
            </h1>

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

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {products.length === 0 ? (
            <div className="p-12 text-center">
              <h2 className="font-semibold">
                Nenhum produto cadastrado
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Comece cadastrando o primeiro produto da adega.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Produto</th>
                    <th className="px-5 py-4">Código</th>
                    <th className="px-5 py-4">Categoria</th>
                    <th className="px-5 py-4">Estoque</th>
                    <th className="px-5 py-4">Venda</th>
                    <th className="px-5 py-4">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => {
                    const quantity =
                      product.stockItem?.balance?.quantity.toNumber() ?? 0;

                    const minStock =
                      product.stockItem?.minStock.toNumber() ?? 0;

                    const unit =
                      product.stockItem?.unit ?? "UNIT";

                    const isLow =
                      product.stockItem !== null &&
                      quantity <= minStock;

                    return (
                      <tr
                        key={product.id}
                        className="hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 font-semibold">
                          {product.name}

                          <p className="mt-1 text-xs font-normal text-slate-400">
                            {product.type}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          {product.code}
                        </td>

                        <td className="px-5 py-4">
                          {product.category.name}
                        </td>

                        <td className="px-5 py-4">
                          {product.stockItem ? (
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                isLow
                                  ? "bg-red-50 text-red-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {quantity} {unit}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Não vinculado
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {product.salePrice.toNumber().toLocaleString(
                            "pt-BR",
                            {
                              style: "currency",
                              currency: "BRL",
                            }
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/dashboard/products/${product.id}/edit`}
                              className="font-medium text-emerald-700 hover:underline"
                            >
                              Editar
                            </Link>

                            <form
                              action={deactivateProduct.bind(
                                null,
                                product.id
                              )}
                            >
                              <button
                                type="submit"
                                className="font-medium text-red-600 hover:underline"
                              >
                                Desativar
                              </button>
                            </form>
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
      </div>
    </main>
  );
}
