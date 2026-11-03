
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";
import { updateProduct } from "../../actions";
import { EditProductFields } from "./edit-product-fields";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-slate-500">
          Carregando edição do produto...
        </div>
      }
    >
      <EditProductContent params={params} />
    </Suspense>
  );
}

async function EditProductContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("PRODUCTS");

  const { id } = await params;

  const [product, categories, stockItems, products] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        stockItem: {
          select: {
            id: true,
            unit: true,
            minStock: true,
            purchaseCost: true,
          },
        },
        stockPackaging: {
          select: {
            name: true,
            conversionFactor: true,
          },
        },
        packagingChildProduct: {
          select: {
            id: true,
            name: true,
          },
        },
        recipeItems: true,
        comboItems: {
          include: {
            componentProduct: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),

    prisma.category.findMany({
      orderBy: { name: "asc" },
    }),

    prisma.stockItem.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        unit: true,
      },
    }),

    prisma.product.findMany({
      where: {
        active: true,
        type: { in: ["STANDARD", "SUPPLY"] },
        stockItemId: { not: null },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  if (!product || !product.active) {
    notFound();
  }

  if (product.type === "COMPOSITE") {
    notFound();
  }

  const action = updateProduct.bind(null, id);

  const conversionFactor =
    product.stockPackaging?.conversionFactor.toNumber() ?? 1;

  const minStock = product.stockItem
    ? product.stockItem.minStock.toNumber() / conversionFactor
    : 0;

  const purchaseCost = product.stockItem
    ? product.stockItem.purchaseCost.toNumber() * conversionFactor
    : 0;

  const packagingMode = product.packagingChildProduct
    ? "CHILD"
    : product.stockPackaging
      ? "SELF"
      : "NONE";

  const typeLabels: Record<string, string> = {
    STANDARD: "Produto comum",
    SUPPLY: "Descartável / insumo",
    FRACTIONAL: "Dose",
    COMBO: "Combo",
  };

  const packagingDescription =
    packagingMode === "SELF"
      ? `${product.stockPackaging!.name} — ${conversionFactor} ${product.stockItem?.unit}`
      : packagingMode === "CHILD"
        ? `Gera ${product.packagingChildQuantity?.toString()} unidades de ${product.packagingChildProduct!.name}`
        : "Estoque direto, sem embalagem configurada";

  return (
    <main className="min-h-screen bg-slate-100 p-5 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard/products"
          className="text-sm text-emerald-700 hover:underline"
        >
          ← Voltar para produtos
        </Link>

        <h1 className="mt-4 text-2xl font-bold">Editar produto</h1>

        <p className="mt-1 text-sm text-slate-500">
          Atualize os dados comerciais e a composição do produto.
        </p>

        <form
          action={action}
          className="mt-8 space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <section>
            <h2 className="mb-4 font-bold">Informações básicas</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Código *
                <input
                  name="code"
                  required
                  defaultValue={product.code}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <label className="text-sm font-medium">
                Código de barras
                <input
                  name="barcode"
                  defaultValue={product.barcode ?? ""}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <label className="text-sm font-medium sm:col-span-2">
                Nome *
                <input
                  name="name"
                  required
                  defaultValue={product.name}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <label className="text-sm font-medium sm:col-span-2">
                Descrição
                <textarea
                  name="description"
                  defaultValue={product.description ?? ""}
                  rows={2}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <label className="text-sm font-medium sm:col-span-2">
                Categoria
                <select
                  name="categoryId"
                  defaultValue={product.categoryId}
                  required
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="border-t border-slate-100 pt-6">
            <h2 className="mb-3 font-bold">Classificação e estoque</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium">Tipo de produto</p>
                <p className="mt-2 rounded-lg bg-slate-100 p-3 text-sm">
                  {typeLabels[product.type] ?? product.type}
                </p>
                <input type="hidden" name="type" value={product.type} />
              </div>

              {product.stockItem && (
                <div>
                  <p className="text-sm font-medium">Unidade de controle</p>
                  <p className="mt-2 rounded-lg bg-slate-100 p-3 text-sm">
                    {product.stockItem.unit === "UNIT"
                      ? "Unidade"
                      : product.stockItem.unit === "ML"
                        ? "Mililitros (ml)"
                        : "Gramas (g)"}
                  </p>
                  <input
                    type="hidden"
                    name="unit"
                    value={product.stockItem.unit}
                  />
                </div>
              )}
            </div>

            {(product.type === "STANDARD" || product.type === "SUPPLY") && (
              <div className="mt-4 rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-semibold">Configuração de embalagem</p>
                <p className="mt-2 text-sm text-slate-700">
                  {packagingMode === "SELF"
                    ? "Embalagem do próprio produto"
                    : packagingMode === "CHILD"
                      ? "Embalagem que gera outro produto"
                      : "Sem embalagem / estoque direto"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {packagingDescription}
                </p>
                <p className="mt-3 text-xs text-amber-800">
                  A estrutura da embalagem não pode ser alterada nesta tela,
                  para preservar o histórico de estoque. Se precisar mudar
                  essa configuração, será necessário fazer um procedimento
                  específico de conversão.
                </p>
              </div>
            )}

            {product.stockItem && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Estoque mínimo
                  <input
                    name="minStock"
                    type="number"
                    min="0"
                    step="0.001"
                    defaultValue={minStock}
                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                  />
                </label>

                <label className="text-sm font-medium">
                  Custo de compra (R$)
                  <input
                    name="purchaseCost"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={purchaseCost}
                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                  />
                </label>
              </div>
            )}
          </section>

          <EditProductFields
            type={product.type}
            stockItems={stockItems}
            products={products.filter((item) => item.id !== product.id)}
            initialRecipeItems={product.recipeItems.map((item) => ({
              stockItemId: item.stockItemId,
              quantity: item.quantity.toNumber(),
            }))}
            initialComboItems={product.comboItems.map((item) => ({
              componentProductId: item.componentProductId,
              quantity: item.quantity.toNumber(),
            }))}
          />

          <section className="border-t border-slate-100 pt-6">
            <h2 className="mb-4 font-bold">Preço de venda</h2>

            <label className="block text-sm font-medium">
              Preço de venda (R$) *
              <input
                name="salePrice"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={product.salePrice.toString()}
                className="mt-2 w-full rounded-lg border border-slate-300 p-3"
              />
            </label>
          </section>

          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-6">
            <Link
              href="/dashboard/products"
              className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Salvar alterações
            </button>
          </div>
        </form>

        <p className="mt-4 text-xs text-slate-500">
          O saldo físico não pode ser alterado nesta tela. Entradas,
          perdas, aberturas e ajustes continuam no módulo Estoque.
        </p>
      </div>
    </main>
  );
}
