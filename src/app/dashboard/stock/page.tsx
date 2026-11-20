
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

import { requireModuleAccess } from "@/lib/permissions";
import { listStockItems } from "@/modules/stock/list";
import { listActiveProductsWithStockDetails } from "@/modules/stock/queries";

import {
  registerStockEntry,
  registerStockLoss,
  registerStockAdjustment,
} from "./actions";
import { StockListClient } from "./stock-list-client";
import {
  StockMutationFormFields,
  type StockMutationProductOption,
} from "./stock-mutation-form-fields";
import { StockMutationForm } from "./stock-mutation-form";

export const metadata = {
  title: "Estoque | Adega GS",
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getUnitLabel(unit: string) {
  switch (unit) {
    case "ML":
      return "ml";
    case "GRAM":
      return "g";
    default:
      return "un.";
  }
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
  await connection();
  await requireModuleAccess("STOCK");

  const [products, initialStockItems] = await Promise.all([
    listActiveProductsWithStockDetails(),
    listStockItems({ page: 1, pageSize: 20 }),
  ]);

  const stockItems = products
    .filter((product) => product.stockItem !== null)
    .map((product) => {
      const stockItem = product.stockItem!;
      const packaging = product.stockPackaging;
      const childProduct = product.packagingChildProduct;

      const stockQuantity =
        stockItem.balance?.quantity.toNumber() ?? 0;

      const isCommercialPackaging = Boolean(childProduct);

      const closedQuantity = packaging
        ? (packaging.balance?.quantity.toNumber() ?? 0)
        : isCommercialPackaging
          ? stockQuantity
          : 0;

      const openQuantity = isCommercialPackaging ? 0 : stockQuantity;

      const conversionFactor = packaging
        ? packaging.conversionFactor.toNumber()
        : isCommercialPackaging
          ? (product.packagingChildQuantity?.toNumber() ?? 1)
          : 1;

      const minimum = stockItem.minStock.toNumber();
      const cost = stockItem.purchaseCost.toNumber();

      const totalBaseQuantity = isCommercialPackaging
        ? closedQuantity
        : openQuantity + closedQuantity * conversionFactor;

      const totalValue = totalBaseQuantity * cost;
      const isLow = totalBaseQuantity <= minimum;

      return {
        id: product.id,
        name: product.name,
        unit: stockItem.unit,
        hasPackaging: Boolean(packaging),
        isCommercialPackaging,
        packagingName: packaging?.name ?? null,
        childProductName: childProduct?.name ?? null,
        conversionFactor,
        minimum,
        totalValue,
        isLow,
      };
    });

  const mutationProducts: StockMutationProductOption[] = stockItems.map(
    (product) => ({
      id: product.id,
      name: product.name,
      optionLabel: product.isCommercialPackaging
        ? ` (${product.conversionFactor} ${product.childProductName} por embalagem)`
        : product.hasPackaging
          ? ` (${product.packagingName})`
          : ` (${getUnitLabel(product.unit)})`,
      canChooseBalanceTarget:
        product.hasPackaging &&
        !product.isCommercialPackaging &&
        product.unit === "ML",
      packagingName: product.packagingName,
      unitLabel: getUnitLabel(product.unit),
    }),
  );

  const totalProducts = stockItems.length;
  const lowStock = stockItems.filter((product) => product.isLow);
  const totalValue = stockItems.reduce(
    (total, product) => total + product.totalValue,
    0,
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
              Controle de quantidades, embalagens e produtos abertos.
            </p>
          </div>

          <Link
            href="/dashboard/stock/movements"
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50"
          >
            Histórico de movimentações
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Itens de estoque</p>
            <p className="mt-2 text-2xl font-bold">{totalProducts}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Itens com estoque baixo</p>
            <p className="mt-2 text-2xl font-bold text-red-600">
              {lowStock.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Valor estimado do estoque</p>
            <p className="mt-2 text-2xl font-bold">
              {formatCurrency(totalValue)}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <StockListClient initial={initialStockItems} />
        </div>

        <section
          id="movimentar"
          className="mt-8 grid scroll-mt-6 gap-5 lg:grid-cols-3"
        >
          <StockMutationForm
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

            <StockMutationFormFields
              products={mutationProducts}
              quantityLabel="Quantidade"
              reasonPlaceholder="Ex.: Compra de fornecedor"
            />

            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Registrar entrada
            </button>
          </StockMutationForm>

          <StockMutationForm
            action={registerStockLoss}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
          >
            <div>
              <h2 className="font-bold text-red-600">Registrar perda</h2>
              <p className="mt-1 text-xs text-slate-500">
                Retira quantidade do estoque.
              </p>
            </div>

            <StockMutationFormFields
              products={mutationProducts}
              quantityLabel="Quantidade"
              reasonPlaceholder="Ex.: Produto vencido"
            />

            <button
              type="submit"
              className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
            >
              Registrar perda
            </button>
          </StockMutationForm>

          <StockMutationForm
            action={registerStockAdjustment}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
          >
            <div>
              <h2 className="font-bold text-slate-700">Ajustar inventário</h2>
              <p className="mt-1 text-xs text-slate-500">
                Informa a quantidade física encontrada na contagem.
              </p>
            </div>

            <StockMutationFormFields
              products={mutationProducts}
              quantityLabel="Quantidade física encontrada"
              quantityMin={0}
              reasonPlaceholder="Ex.: Conferência física"
            />

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Ajustar estoque
            </button>
          </StockMutationForm>
        </section>
      </div>
    </main>
  );
}