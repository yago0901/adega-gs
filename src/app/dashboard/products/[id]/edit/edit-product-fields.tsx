
"use client";

import { useState } from "react";

type StockItemOption = {
  id: string;
  name: string;
  unit: "UNIT" | "ML" | "GRAM";
};

type ProductOption = {
  id: string;
  name: string;
};

type RecipeItem = {
  stockItemId: string;
  quantity: number;
};

type ComboItem = {
  componentProductId: string;
  quantity: number;
};

type Props = {
  type: string;
  stockItems: StockItemOption[];
  products: ProductOption[];
  initialRecipeItems: RecipeItem[];
  initialComboItems: ComboItem[];
};

const unitLabels = {
  UNIT: "Unidade",
  ML: "Mililitros (ml)",
  GRAM: "Gramas (g)",
};

export function EditProductFields({
  type,
  stockItems,
  products,
  initialRecipeItems,
  initialComboItems,
}: Props) {
  const [recipeRows, setRecipeRows] = useState(
    initialRecipeItems.map((item, index) => ({
      key: index,
      stockItemId: item.stockItemId,
      quantity: String(item.quantity),
    })),
  );

  const [comboRows, setComboRows] = useState(
    initialComboItems.map((item, index) => ({
      key: index,
      componentProductId: item.componentProductId,
      quantity: String(item.quantity),
    })),
  );

  function addRecipeRow() {
    setRecipeRows((rows) => [
      ...rows,
      {
        key: rows.length ? Math.max(...rows.map((r) => r.key)) + 1 : 0,
        stockItemId: "",
        quantity: "",
      },
    ]);
  }

  function addComboRow() {
    setComboRows((rows) => [
      ...rows,
      {
        key: rows.length ? Math.max(...rows.map((r) => r.key)) + 1 : 0,
        componentProductId: "",
        quantity: "1",
      },
    ]);
  }

  if (type === "FRACTIONAL") {
    return (
      <section className="border-t border-slate-100 pt-6 sm:col-span-2">
        <h2 className="mb-2 font-bold">Ingredientes da dose</h2>
        <p className="mb-4 text-sm text-slate-500">
          Cada ingrediente utiliza sua própria unidade de controle.
          As alterações serão aplicadas à receita usada nas próximas vendas.
        </p>

        <div className="space-y-3">
          {recipeRows.map((row) => (
            <div
              key={row.key}
              className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_130px_auto]"
            >
              <label className="text-sm font-medium">
                Ingrediente
                <select
                  name="recipeStockItemId"
                  required
                  value={row.stockItemId}
                  onChange={(event) =>
                    setRecipeRows((rows) =>
                      rows.map((item) =>
                        item.key === row.key
                          ? { ...item, stockItemId: event.target.value }
                          : item,
                      ),
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {stockItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({unitLabels[item.unit]})
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium">
                Quantidade
                <input
                  name="recipeQuantity"
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
                  value={row.quantity}
                  onChange={(event) =>
                    setRecipeRows((rows) =>
                      rows.map((item) =>
                        item.key === row.key
                          ? { ...item, quantity: event.target.value }
                          : item,
                      ),
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <button
                type="button"
                disabled={recipeRows.length === 1}
                onClick={() =>
                  setRecipeRows((rows) =>
                    rows.filter((item) => item.key !== row.key),
                  )
                }
                className="self-end rounded-lg border border-red-200 px-3 py-3 text-sm text-red-600 disabled:opacity-40"
              >
                Remover
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRecipeRow}
          className="mt-3 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700"
        >
          + Adicionar ingrediente
        </button>

        {stockItems.length === 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Não existem ingredientes ativos cadastrados.
          </p>
        )}
      </section>
    );
  }

  if (type === "COMBO") {
    return (
      <section className="border-t border-slate-100 pt-6 sm:col-span-2">
        <h2 className="mb-2 font-bold">Produtos do combo</h2>
        <p className="mb-4 text-sm text-slate-500">
          A venda do combo descontará as quantidades configuradas de cada
          produto componente.
        </p>

        <div className="space-y-3">
          {comboRows.map((row) => (
            <div
              key={row.key}
              className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_130px_auto]"
            >
              <label className="text-sm font-medium">
                Produto
                <select
                  name="comboProductId"
                  required
                  value={row.componentProductId}
                  onChange={(event) =>
                    setComboRows((rows) =>
                      rows.map((item) =>
                        item.key === row.key
                          ? {
                              ...item,
                              componentProductId: event.target.value,
                            }
                          : item,
                      ),
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium">
                Quantidade
                <input
                  name="comboQuantity"
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
                  value={row.quantity}
                  onChange={(event) =>
                    setComboRows((rows) =>
                      rows.map((item) =>
                        item.key === row.key
                          ? { ...item, quantity: event.target.value }
                          : item,
                      ),
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <button
                type="button"
                disabled={comboRows.length === 1}
                onClick={() =>
                  setComboRows((rows) =>
                    rows.filter((item) => item.key !== row.key),
                  )
                }
                className="self-end rounded-lg border border-red-200 px-3 py-3 text-sm text-red-600 disabled:opacity-40"
              >
                Remover
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addComboRow}
          className="mt-3 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700"
        >
          + Adicionar produto
        </button>

        {products.length === 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Não existem produtos comuns ativos disponíveis.
          </p>
        )}
      </section>
    );
  }

  return null;
}
