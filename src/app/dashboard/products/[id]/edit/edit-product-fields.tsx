
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

type CompositionOption = {
  stockItemId: string;
  quantity: number;
};

type CompositionGroup = {
  name: string;
  required: boolean;
  options: CompositionOption[];
};

type ComboItem = {
  componentProductId: string;
  quantity: number;
};

type Props = {
  type: string;
  stockItems: StockItemOption[];
  products: ProductOption[];
  initialCompositionGroups: CompositionGroup[];
  initialComboItems: ComboItem[];
};

type CompositionOptionRow = CompositionOption & {
  key: number;
};

type CompositionGroupRow = {
  key: number;
  name: string;
  required: boolean;
  options: CompositionOptionRow[];
};

type ComboRow = ComboItem & {
  key: number;
};

const unitLabels = {
  UNIT: "Unidade",
  ML: "Mililitros (ml)",
  GRAM: "Gramas (g)",
};

function createInitialGroups(
  groups: CompositionGroup[],
): CompositionGroupRow[] {
  if (groups.length === 0) {
    return [
      {
        key: 0,
        name: "Base",
        required: true,
        options: [{ key: 0, stockItemId: "", quantity: 50 }],
      },
    ];
  }

  return groups.map((group, groupIndex) => ({
    key: groupIndex,
    name: group.name,
    required: group.required,
    options: group.options.map((option, optionIndex) => ({
      ...option,
      key: optionIndex,
    })),
  }));
}

export function EditProductFields({
  type,
  stockItems,
  products,
  initialCompositionGroups,
  initialComboItems,
}: Props) {
  const [compositionGroups, setCompositionGroups] = useState(() =>
    createInitialGroups(initialCompositionGroups),
  );

  const [comboRows, setComboRows] = useState<ComboRow[]>(
    initialComboItems.map((item, index) => ({
      ...item,
      key: index,
      quantity: String(item.quantity) as unknown as number,
    })),
  );

  function addGroup() {
    setCompositionGroups((groups) => [
      ...groups,
      {
        key: groups.length
          ? Math.max(...groups.map((group) => group.key)) + 1
          : 0,
        name: "",
        required: true,
        options: [
          {
            key: 0,
            stockItemId: "",
            quantity: 1,
          },
        ],
      },
    ]);
  }

  function removeGroup(groupKey: number) {
    setCompositionGroups((groups) =>
      groups.filter((group) => group.key !== groupKey),
    );
  }

  function updateGroup(
    groupKey: number,
    changes: Partial<CompositionGroupRow>,
  ) {
    setCompositionGroups((groups) =>
      groups.map((group) =>
        group.key === groupKey ? { ...group, ...changes } : group,
      ),
    );
  }

  function addOption(groupKey: number) {
    setCompositionGroups((groups) =>
      groups.map((group) => {
        if (group.key !== groupKey) return group;

        return {
          ...group,
          options: [
            ...group.options,
            {
              key: group.options.length
                ? Math.max(...group.options.map((option) => option.key)) + 1
                : 0,
              stockItemId: "",
              quantity: 1,
            },
          ],
        };
      }),
    );
  }

  function removeOption(groupKey: number, optionKey: number) {
    setCompositionGroups((groups) =>
      groups.map((group) => {
        if (group.key !== groupKey) return group;

        return {
          ...group,
          options: group.options.filter(
            (option) => option.key !== optionKey,
          ),
        };
      }),
    );
  }

  function updateOption(
    groupKey: number,
    optionKey: number,
    changes: Partial<CompositionOptionRow>,
  ) {
    setCompositionGroups((groups) =>
      groups.map((group) => {
        if (group.key !== groupKey) return group;

        return {
          ...group,
          options: group.options.map((option) =>
            option.key === optionKey
              ? { ...option, ...changes }
              : option,
          ),
        };
      }),
    );
  }

  function addComboRow() {
    setComboRows((rows) => [
      ...rows,
      {
        key: rows.length
          ? Math.max(...rows.map((row) => row.key)) + 1
          : 0,
        componentProductId: "",
        quantity: 1,
      },
    ]);
  }

  const compositionPayload = compositionGroups.map((group, groupIndex) => ({
    name: group.name.trim(),
    minSelections: group.required ? 1 : 0,
    maxSelections: 1,
    position: groupIndex,
    options: group.options.map((option, optionIndex) => ({
      stockItemId: option.stockItemId,
      quantity: Number(option.quantity),
      position: optionIndex,
    })),
  }));

  if (type === "FRACTIONAL") {
    return (
      <section className="border-t border-slate-100 pt-6 sm:col-span-2">
        <h2 className="mb-2 font-bold">Ficha técnica da dose</h2>

        <p className="mb-4 text-sm text-slate-500">
          Configure os ingredientes consumidos e as opções que podem ser
          escolhidas na venda. Em cada grupo, o cliente poderá escolher
          somente uma opção.
        </p>

        <input
          type="hidden"
          name="compositionGroups"
          value={JSON.stringify(compositionPayload)}
        />

        <div className="space-y-5">
          {compositionGroups.map((group, groupIndex) => (
            <div
              key={group.key}
              className="rounded-lg border border-slate-200 p-4"
            >
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <label className="min-w-0 flex-1 text-sm font-medium">
                  Nome do grupo
                  <input
                    type="text"
                    required
                    value={group.name}
                    onChange={(event) =>
                      updateGroup(group.key, {
                        name: event.target.value,
                      })
                    }
                    placeholder="Ex.: Base, Energético, Gelo..."
                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                  />
                </label>

                <label className="flex items-center gap-2 pb-3 text-sm">
                  <input
                    type="checkbox"
                    checked={group.required}
                    onChange={(event) =>
                      updateGroup(group.key, {
                        required: event.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                  Obrigatório
                </label>

                <button
                  type="button"
                  disabled={compositionGroups.length === 1}
                  onClick={() => removeGroup(group.key)}
                  className="rounded-lg border border-red-200 px-3 py-3 text-sm text-red-600 disabled:opacity-40"
                >
                  Remover grupo
                </button>
              </div>

              <p className="mb-3 text-xs text-slate-500">
                {group.required
                  ? "O cliente deverá escolher uma opção deste grupo."
                  : "O cliente poderá escolher uma opção ou não escolher nenhuma."}
              </p>

              <div className="space-y-3">
                {group.options.map((option) => (
                  <div
                    key={option.key}
                    className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_130px_auto]"
                  >
                    <label className="text-sm font-medium">
                      Ingrediente / opção
                      <select
                        required
                        value={option.stockItemId}
                        onChange={(event) =>
                          updateOption(group.key, option.key, {
                            stockItemId: event.target.value,
                          })
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
                        type="number"
                        min="0.001"
                        step="0.001"
                        required
                        value={option.quantity}
                        onChange={(event) =>
                          updateOption(group.key, option.key, {
                            quantity: Number(event.target.value),
                          })
                        }
                        className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={group.options.length === 1}
                      onClick={() =>
                        removeOption(group.key, option.key)
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
                onClick={() => addOption(group.key)}
                className="mt-3 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700"
              >
                + Adicionar opção
              </button>

              <p className="mt-3 text-xs text-slate-400">
                Grupo {groupIndex + 1} · Máximo de uma escolha
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addGroup}
          className="mt-4 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700"
        >
          + Adicionar grupo
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
                          ? {
                              ...item,
                              quantity: Number(event.target.value),
                            }
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
