
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

type Props = {
  stockItems: StockItemOption[];
  products: ProductOption[];
  packagingChildProducts: ProductOption[];
  packagingParentProducts: ProductOption[];
};

type CompositionOptionState = {
  id: number;
  stockItemId: string;
  quantity: string;
};

type CompositionGroupState = {
  id: number;
  name: string;
  required: boolean;
  options: CompositionOptionState[];
};

const unitLabels = {
  UNIT: "Unidade",
  ML: "Mililitros (ml)",
  GRAM: "Gramas (g)",
};

export function ProductTypeFields({
  stockItems,
  products,
  packagingChildProducts,
  packagingParentProducts,
}: Props) {
  const [type, setType] = useState("STANDARD");
  const [packagingMode, setPackagingMode] = useState("NONE");
  const [unit, setUnit] = useState<"UNIT" | "ML" | "GRAM">("UNIT");

  const [comboRows, setComboRows] = useState([0]);
  const [nextId, setNextId] = useState(1);

  const [packagingParentProductId, setPackagingParentProductId] = useState("");
  const [packagingParentQuantity, setPackagingParentQuantity] = useState("");
  const [packagingChildProductId, setPackagingChildProductId] = useState("");

  const [compositionGroups, setCompositionGroups] = useState<
    CompositionGroupState[]
  >([
    {
      id: 0,
      name: "Base",
      required: true,
      options: [{ id: 0, stockItemId: "", quantity: "" }],
    },
  ]);

  function addComboRow() {
    setComboRows((rows) => [...rows, Math.max(...rows) + 1]);
  }

  function removeComboRow(index: number) {
    setComboRows((rows) => rows.filter((row) => row !== index));
  }

  function changePackagingMode(value: string) {
    setPackagingMode(value);

    if (value === "SELF") {
      setUnit("ML");
    } else {
      setUnit("UNIT");
    }
  }

  function addCompositionGroup() {
    const id = nextId;

    setNextId((current) => current + 1);

    setCompositionGroups((groups) => [
      ...groups,
      {
        id,
        name: "",
        required: true,
        options: [
          {
            id: id + 100000,
            stockItemId: "",
            quantity: "",
          },
        ],
      },
    ]);
  }

  function removeCompositionGroup(groupId: number) {
    setCompositionGroups((groups) =>
      groups.filter((group) => group.id !== groupId),
    );
  }

  function updateGroupName(groupId: number, name: string) {
    setCompositionGroups((groups) =>
      groups.map((group) =>
        group.id === groupId ? { ...group, name } : group,
      ),
    );
  }

  function updateGroupRequired(groupId: number, required: boolean) {
    setCompositionGroups((groups) =>
      groups.map((group) =>
        group.id === groupId ? { ...group, required } : group,
      ),
    );
  }

  function addCompositionOption(groupId: number) {
    const id = nextId + 200000;

    setNextId((current) => current + 1);

    setCompositionGroups((groups) =>
      groups.map((group) =>
        group.id === groupId
          ? {
            ...group,
            options: [
              ...group.options,
              {
                id,
                stockItemId: "",
                quantity: "",
              },
            ],
          }
          : group,
      ),
    );
  }

  function removeCompositionOption(
    groupId: number,
    optionId: number,
  ) {
    setCompositionGroups((groups) =>
      groups.map((group) =>
        group.id === groupId
          ? {
            ...group,
            options: group.options.filter(
              (option) => option.id !== optionId,
            ),
          }
          : group,
      ),
    );
  }

  function updateCompositionOption(
    groupId: number,
    optionId: number,
    field: "stockItemId" | "quantity",
    value: string,
  ) {
    setCompositionGroups((groups) =>
      groups.map((group) =>
        group.id === groupId
          ? {
            ...group,
            options: group.options.map((option) =>
              option.id === optionId
                ? { ...option, [field]: value }
                : option,
            ),
          }
          : group,
      ),
    );
  }

  const compositionPayload = compositionGroups.map(
    (group, position) => ({
      name: group.name.trim(),
      minSelections: group.required ? 1 : 0,
      maxSelections: 1,
      position,
      options: group.options.map((option, optionPosition) => ({
        stockItemId: option.stockItemId,
        quantity: option.quantity,
        position: optionPosition,
      })),
    }),
  );

  return (
    <>
      <section className="border-t border-slate-100 pt-6">
        <h2 className="mb-4 font-bold">Classificação</h2>

        <label className="block text-sm font-medium">
          Tipo de produto
          <select
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
          >
            <option value="STANDARD">Produto comum</option>
            <option value="SUPPLY">Descartável / insumo</option>
            <option value="FRACTIONAL">Dose</option>
            <option value="COMBO">Combo</option>
          </select>
        </label>

        <p className="mt-2 text-xs text-slate-500">
          Produtos comuns possuem estoque próprio. Doses consomem
          ingredientes. Combos consomem produtos componentes.
        </p>
      </section>

      {(type === "STANDARD" || type === "SUPPLY") && (
        <>
          <section className="border-t border-slate-100 pt-6">
            <h2 className="mb-2 font-bold">Configuração de estoque</h2>

            <label className="block text-sm font-medium">
              Tipo de controle de embalagem
              <select
                name="packagingMode"
                value={packagingMode}
                onChange={(event) =>
                  changePackagingMode(event.target.value)
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
              >
                <option value="NONE">Sem embalagem / estoque direto</option>
                <option value="SELF">
                  Embalagem do próprio produto (ex.: whisky 1L)
                </option>
                <option value="CHILD">
                  Embalagens e embalados (ex.: fardo de latas)
                </option>
              </select>
            </label>

            <div className="mt-4">
              <label className="block text-sm font-medium">
                Unidade de controle
                <select
                  name={packagingMode === "CHILD" ? undefined : "unit"}
                  value={unit}
                  disabled={packagingMode === "CHILD"}
                  onChange={(event) =>
                    setUnit(event.target.value as "UNIT" | "ML" | "GRAM")
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 disabled:bg-slate-100"
                >
                  <option value="UNIT">Unidade</option>
                  <option value="ML">Mililitros (ml)</option>
                  <option value="GRAM">Gramas (g)</option>
                </select>

                {packagingMode === "CHILD" && (
                  <input type="hidden" name="unit" value="UNIT" />
                )}
              </label>
            </div>

            {packagingMode === "SELF" && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Nome da embalagem *
                  <input
                    name="packagingName"
                    required
                    placeholder="Ex.: Garrafa 1L"
                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                  />
                </label>

                <label className="text-sm font-medium">
                  Quantidade por embalagem *
                  <input
                    name="packagingConversionFactor"
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="Ex.: 1000"
                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                  />
                </label>
              </div>
            )}

            {packagingMode === "CHILD" && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h3 className="font-semibold text-blue-900">
                  Origem do produto
                </h3>

                <p className="mt-1 text-sm text-blue-800">
                  Este produto é obtido ao abrir outra embalagem?
                  Se sim, selecione o produto de origem.
                </p>

                <label className="mt-4 block text-sm font-medium">
                  Produto de origem
                  <select
                    name="packagingParentProductId"
                    value={packagingParentProductId}
                    onChange={(event) => {
                      setPackagingParentProductId(event.target.value);
                      setPackagingParentQuantity("");
                    }}
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                  >
                    <option value="">
                      Não possui origem em outra embalagem
                    </option>

                    {packagingParentProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>

                {packagingParentProductId && (
                  <label className="mt-4 block text-sm font-medium">
                    Quantidade deste produto gerada ao abrir a embalagem *
                    <input
                      name="packagingParentQuantity"
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={packagingParentQuantity}
                      onChange={(event) =>
                        setPackagingParentQuantity(event.target.value)
                      }
                      placeholder="Ex.: 10"
                      className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                    />
                  </label>
                )}

                {packagingParentProducts.length === 0 && (
                  <p className="mt-3 text-sm text-amber-800">
                    Não existem produtos disponíveis como origem.
                  </p>
                )}
              </div>
            )}

            {packagingMode === "CHILD" && (
              <div className="mt-4 space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div>
                  <h3 className="font-semibold text-emerald-900">
                    Conversão para outro produto
                  </h3>

                  <p className="mt-1 text-sm text-emerald-800">
                    Ao abrir esta embalagem, o sistema retirará uma unidade
                    deste produto e adicionará a quantidade informada ao
                    estoque do produto selecionado.
                  </p>
                </div>

                <label className="block text-sm font-medium">
                  Produto gerado pela embalagem
                  <select
                    name="packagingChildProductId"
                    value={packagingChildProductId}
                    onChange={(event) =>
                      setPackagingChildProductId(event.target.value)
                    }
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                  >
                    <option value="">
                      Não gera outro produto
                    </option>

                    {packagingChildProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>

                {packagingChildProductId && (
                  <label className="block text-sm font-medium">
                    Quantidade gerada ao abrir *
                    <input
                      name="packagingChildQuantity"
                      type="number"
                      min="1"
                      step="1"
                      required
                      placeholder="Ex.: 20"
                      className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                    />
                  </label>
                )}

                {packagingChildProducts.length === 0 && (
                  <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900">
                    Não existem produtos disponíveis para conversão.
                    Cadastre primeiro o produto individual, com estoque
                    controlado em unidades.
                  </p>
                )}

                <p className="text-xs text-emerald-800">
                  Exemplo: 1 pacote gera 20 maços. Os dois produtos terão
                  saldos independentes.
                </p>
              </div>
            )}

            <p className="mt-3 text-xs text-slate-500">
              A conversão só acontece quando você registrar a abertura da
              embalagem. A venda direta do fardo não altera o estoque das
              latas.
            </p>
          </section>

          <section className="border-t border-slate-100 pt-6">
            <h2 className="mb-4 font-bold">Estoque inicial</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Estoque mínimo
                <input
                  name="minStock"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="0"
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <label className="text-sm font-medium">
                {packagingMode === "SELF"
                  ? "Embalagens fechadas"
                  : packagingMode === "CHILD"
                    ? "Embalagens disponíveis"
                    : "Quantidade disponível"}
                <input
                  name="initialStock"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="0"
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              {packagingMode === "SELF" && (
                <label className="text-sm font-medium sm:col-span-2">
                  Quantidade já aberta ({unitLabels[unit]})
                  <input
                    name="initialOpenQuantity"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue="0"
                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                  />
                </label>
              )}
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Para whisky, informe as garrafas fechadas e o líquido já
              aberto separadamente. Para fardos, informe somente a
              quantidade de fardos fechados. As latas avulsas ficam no
              estoque do produto individual.
            </p>
          </section>
        </>
      )}

      {type === "FRACTIONAL" && (
        <section className="border-t border-slate-100 pt-6">
          <h2 className="mb-2 font-bold">Ficha técnica da dose</h2>

          <p className="mb-4 text-sm text-slate-500">
            Crie grupos de ingredientes. Em cada grupo, o cliente poderá
            escolher uma opção. Grupos obrigatórios precisam ter uma
            escolha; grupos opcionais podem ficar sem seleção.
          </p>

          <input
            type="hidden"
            name="compositionGroups"
            value={JSON.stringify(compositionPayload)}
          />

          <div className="space-y-5">
            {compositionGroups.map((group, groupIndex) => (
              <div
                key={group.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="font-semibold">
                    Grupo {groupIndex + 1}
                  </h3>

                  <button
                    type="button"
                    onClick={() => removeCompositionGroup(group.id)}
                    disabled={compositionGroups.length === 1}
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 disabled:opacity-40"
                  >
                    Remover grupo
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium">
                    Nome do grupo *
                    <input
                      value={group.name}
                      onChange={(event) =>
                        updateGroupName(group.id, event.target.value)
                      }
                      required
                      placeholder="Ex.: Energético"
                      className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Regra de seleção
                    <select
                      value={group.required ? "REQUIRED" : "OPTIONAL"}
                      onChange={(event) =>
                        updateGroupRequired(
                          group.id,
                          event.target.value === "REQUIRED",
                        )
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                    >
                      <option value="REQUIRED">
                        Obrigatório — escolher 1
                      </option>
                      <option value="OPTIONAL">
                        Opcional — escolher até 1
                      </option>
                    </select>
                  </label>
                </div>

                <div className="mt-5 space-y-3">
                  <p className="text-sm font-semibold">Opções do grupo</p>

                  {group.options.map((option) => (
                    <div
                      key={option.id}
                      className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_130px_auto]"
                    >
                      <label className="text-sm font-medium">
                        Ingrediente
                        <select
                          value={option.stockItemId}
                          onChange={(event) =>
                            updateCompositionOption(
                              group.id,
                              option.id,
                              "stockItemId",
                              event.target.value,
                            )
                          }
                          required
                          className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                        >
                          <option value="">Selecione</option>

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
                          value={option.quantity}
                          onChange={(event) =>
                            updateCompositionOption(
                              group.id,
                              option.id,
                              "quantity",
                              event.target.value,
                            )
                          }
                          required
                          placeholder="Ex.: 50"
                          className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          removeCompositionOption(group.id, option.id)
                        }
                        disabled={group.options.length === 1}
                        className="self-end rounded-lg border border-red-200 px-3 py-3 text-sm text-red-600 disabled:opacity-40"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => addCompositionOption(group.id)}
                  className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  + Adicionar opção
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addCompositionGroup}
            className="mt-4 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700"
          >
            + Adicionar grupo
          </button>

          {stockItems.length === 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Cadastre primeiro os produtos que serão utilizados na dose.
            </p>
          )}
        </section>
      )}

      {type === "COMBO" && (
        <section className="border-t border-slate-100 pt-6">
          <h2 className="mb-2 font-bold">Produtos do combo</h2>

          <p className="mb-4 text-sm text-slate-500">
            Selecione os produtos comuns que fazem parte deste combo.
            A venda descontará cada componente do estoque.
          </p>

          <div className="space-y-3">
            {comboRows.map((row) => (
              <div
                key={row}
                className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_130px_auto]"
              >
                <label className="text-sm font-medium">
                  Produto
                  <select
                    name="comboProductId"
                    required
                    defaultValue=""
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
                    min="1"
                    step="1"
                    required
                    defaultValue="1"
                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => removeComboRow(row)}
                  disabled={comboRows.length === 1}
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
              Cadastre primeiro os produtos comuns que farão parte do combo.
            </p>
          )}
        </section>
      )}
    </>
  );
}
