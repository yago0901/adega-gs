
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";
import { updateProduct } from "../../actions";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("PRODUCTS");

  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        stockItem: {
          select: {
            unit: true,
            minStock: true,
            purchaseCost: true,
          },
        },
        stockPackaging: {
          select: {
            conversionFactor: true,
          },
        },
      },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  if (!product || !product.active) {
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

        <form
          action={action}
          className="mt-8 grid gap-5 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2"
        >
          <label className="text-sm font-medium">
            Código *
            <input
              name="code"
              required
              defaultValue={product.code}
              className="mt-2 w-full rounded-lg border p-3"
            />
          </label>

          <label className="text-sm font-medium">
            Código de barras
            <input
              name="barcode"
              defaultValue={product.barcode ?? ""}
              className="mt-2 w-full rounded-lg border p-3"
            />
          </label>

          <label className="text-sm font-medium sm:col-span-2">
            Nome *
            <input
              name="name"
              required
              defaultValue={product.name}
              className="mt-2 w-full rounded-lg border p-3"
            />
          </label>

          <label className="text-sm font-medium sm:col-span-2">
            Descrição
            <textarea
              name="description"
              defaultValue={product.description ?? ""}
              rows={2}
              className="mt-2 w-full rounded-lg border p-3"
            />
          </label>

          <label className="text-sm font-medium">
            Categoria
            <select
              name="categoryId"
              defaultValue={product.categoryId}
              className="mt-2 w-full rounded-lg border bg-white p-3"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            Tipo
            <select
              name="type"
              defaultValue={product.type}
              className="mt-2 w-full rounded-lg border bg-white p-3"
            >
              <option value="STANDARD">Produto comum</option>
              <option value="SUPPLY">Descartável / insumo</option>
              <option value="FRACTIONAL">Fracionado</option>
              <option value="COMPOSITE">Composição</option>
              <option value="COMBO">Combo</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            Unidade
            <select
              name="unit"
              defaultValue={product.stockItem?.unit ?? "UNIT"}
              className="mt-2 w-full rounded-lg border bg-white p-3"
            >
              <option value="UNIT">Unidade</option>
              <option value="ML">Mililitros</option>
              <option value="GRAM">Gramas</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            Estoque mínimo
            <input
              name="minStock"
              type="number"
              min="0"
              step="0.001"
              defaultValue={minStock}
              className="mt-2 w-full rounded-lg border p-3"
            />
          </label>

          <label className="text-sm font-medium">
            Preço de venda
            <input
              name="salePrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={product.salePrice.toString()}
              className="mt-2 w-full rounded-lg border p-3"
            />
          </label>

          <label className="text-sm font-medium">
            Custo de compra
            <input
              name="purchaseCost"
              type="number"
              min="0"
              step="0.01"
              defaultValue={purchaseCost}
              className="mt-2 w-full rounded-lg border p-3"
            />
          </label>

          <div className="flex flex-wrap justify-end gap-3 border-t pt-5 sm:col-span-2">
            <Link
              href="/dashboard/products"
              className="rounded-lg border px-5 py-3 text-sm font-semibold"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white"
            >
              Salvar alterações
            </button>
          </div>
        </form>

        <p className="mt-4 text-xs text-slate-500">
          O saldo de estoque não pode ser alterado nesta tela. Entradas e
          ajustes serão feitos pelo módulo de estoque.
        </p>
      </div>
    </main>
  );
}
