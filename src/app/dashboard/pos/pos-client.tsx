
"use client";

import { useMemo, useState, useTransition } from "react";
import { finalizeSale } from "./actions";

type CompositionOption = {
  id: string;
  stockItemId: string;
  name: string;
  unit: string;
  quantity: string;
  available: string;
};

type CompositionGroup = {
  id: string;
  name: string;
  required: boolean;
  options: CompositionOption[];
};

type Product = {
  id: string;
  code: string;
  name: string;
  type: "STANDARD" | "SUPPLY" | "FRACTIONAL" | "COMBO";
  salePrice: string;
  unit: string;
  stock: string;
  composition: {
    groups: CompositionGroup[];
  } | null;
};

type CartItem = {
  id: string;
  product: Product;
  quantity: number;
  selections: {
    groupId: string;
    optionId: string;
  }[];
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function getTypeLabel(type: Product["type"]) {
  switch (type) {
    case "FRACTIONAL":
      return "Dose";
    case "COMBO":
      return "Combo";
    case "SUPPLY":
      return "Insumo";
    default:
      return "Produto";
  }
}

export default function PosClient({
  products,
}: {
  products: Product[];
}) {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const availableProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        product.code.toLowerCase().includes(term),
    );
  }, [products, search]);

  const total = cart.reduce(
    (sum, item) =>
      sum + Number(item.product.salePrice) * item.quantity,
    0,
  );

  const hasIncompleteComposition = cart.some((item) => {
    if (item.product.type !== "FRACTIONAL") return false;

    if (!item.product.composition) return true;

    return item.product.composition.groups.some((group) => {
      if (!group.required) return false;

      return !item.selections.some(
        (selection) =>
          selection.groupId === group.id &&
          group.options.some(
            (option) =>
              option.id === selection.optionId &&
              Number(option.available) > 0,
          ),
      );
    });
  });

  function addProduct(product: Product) {
    if (Number(product.stock) <= 0) {
      setMessage("Este produto está sem estoque suficiente.");
      return;
    }

    setMessage("");

    setCart((current) => {
      if (product.type === "FRACTIONAL") {
        return [
          ...current,
          {
            id: crypto.randomUUID(),
            product,
            quantity: 1,
            selections: [],
          },
        ];
      }

      const existing = current.find(
        (item) => item.product.id === product.id,
      );

      if (existing) {
        return current.map((item) =>
          item.id === existing.id
            ? {
              ...item,
              quantity: Math.min(
                item.quantity + 1,
                Number(product.stock),
              ),
            }
            : item,
        );
      }

      return [
        ...current,
        {
          id: crypto.randomUUID(),
          product,
          quantity: 1,
          selections: [],
        },
      ];
    });
  }

  function changeQuantity(cartItemId: string, quantity: number) {
    const item = cart.find(
      (cartItem) => cartItem.id === cartItemId,
    );

    if (!item || item.product.type === "FRACTIONAL") return;

    const safeQuantity = Math.min(
      Number(item.product.stock),
      Math.max(0, quantity),
    );

    setCart((current) =>
      safeQuantity === 0
        ? current.filter((cartItem) => cartItem.id !== cartItemId)
        : current.map((cartItem) =>
          cartItem.id === cartItemId
            ? { ...cartItem, quantity: safeQuantity }
            : cartItem,
        ),
    );
  }

  function removeProduct(cartItemId: string) {
    setCart((current) =>
      current.filter((item) => item.id !== cartItemId),
    );
  }

  function selectCompositionOption(
    cartItemId: string,
    groupId: string,
    optionId: string,
  ) {
    setCart((current) =>
      current.map((item) => {
        if (item.id !== cartItemId) return item;

        const selections = item.selections.filter(
          (selection) => selection.groupId !== groupId,
        );

        if (optionId) {
          selections.push({ groupId, optionId });
        }

        return {
          ...item,
          selections,
        };
      }),
    );
  }

  function handleFinalize() {
    if (cart.length === 0 || isPending) return;

    setMessage("");

    startTransition(async () => {
      try {
        const result = await finalizeSale(
          cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            selections: item.selections,
          })),
        );

        if (!result.success) {
          setMessage(result.error);
          return;
        }

        if ("confirmationRequired" in result) {
          setMessage(
            "É necessário confirmar a abertura de garrafas antes de concluir a venda.",
          );
          return;
        }

        setCart([]);
        setSearch("");

        setMessage(
          `Venda ${result.saleId} registrada! Total: ${currency.format(
            Number(result.total),
          )}`,
        );
      } catch {
        setMessage(
          "Não foi possível finalizar a venda. Tente novamente.",
        );
      }
    });
  }

  return (
    <main className="space-y-6 p-4 md:p-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          Frente de Caixa
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Selecione os produtos para iniciar uma venda.
        </p>
      </header>

      {message && (
        <div
          role="status"
          className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700"
        >
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <section className="space-y-4">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou código..."
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {availableProducts.map((product) => {
              const stock = Number(product.stock);

              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={stock <= 0}
                  onClick={() => addProduct(product)}
                  className="rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-blue-400 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-gray-900">
                      {product.name}
                    </span>

                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {getTypeLabel(product.type)}
                    </span>
                  </div>

                  <span className="mt-1 block text-xs text-gray-500">
                    Código: {product.code}
                  </span>

                  <span className="mt-3 block text-lg font-bold text-gray-900">
                    {currency.format(Number(product.salePrice))}
                  </span>

                  <span className="mt-1 block text-xs text-gray-500">
                    Disponível: {stock} un.
                  </span>
                </button>
              );
            })}

            {availableProducts.length === 0 && (
              <p className="col-span-full rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                Nenhum produto encontrado.
              </p>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-bold text-gray-900">
            Venda atual
          </h2>

          <div className="mt-4 space-y-4">
            {cart.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-500">
                Nenhum produto adicionado.
              </p>
            )}

            {cart.map((item) => (
              <div
                key={item.id}
                className="border-b border-gray-100 pb-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.product.name}
                      {item.product.type === "FRACTIONAL" && (
                        <span className="ml-2 text-xs text-gray-500">
                          Unidade individual
                        </span>
                      )}
                    </p>

                    <p className="text-xs text-gray-500">
                      {getTypeLabel(item.product.type)}
                    </p>

                    <p className="text-sm text-gray-500">
                      {currency.format(Number(item.product.salePrice))}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeProduct(item.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remover
                  </button>
                </div>

                {item.product.type === "FRACTIONAL" ? (
                  <div className="mt-3 space-y-3">
                    {item.product.composition?.groups.map((group) => {
                      const selectedOption = item.selections.find(
                        (selection) => selection.groupId === group.id,
                      );

                      const availableOptions = group.options.filter(
                        (option) => Number(option.available) > 0,
                      );

                      return (
                        <div key={group.id}>
                          <label
                            htmlFor={`${item.id}-${group.id}`}
                            className="mb-1 block text-sm font-medium text-gray-700"
                          >
                            {group.name}
                            {group.required ? " *" : " (opcional)"}
                          </label>

                          <select
                            id={`${item.id}-${group.id}`}
                            value={selectedOption?.optionId ?? ""}
                            onChange={(event) =>
                              selectCompositionOption(
                                item.id,
                                group.id,
                                event.target.value,
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                          >
                            <option value="">
                              {group.required
                                ? "Selecione uma opção..."
                                : "Não adicionar"}
                            </option>

                            {availableOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name} — {option.quantity}{" "}
                                {option.unit}
                              </option>
                            ))}
                          </select>

                          {group.required && availableOptions.length === 0 && (
                            <p className="mt-1 text-xs text-red-600">
                              Nenhuma opção disponível em estoque.
                            </p>
                          )}
                        </div>
                      );
                    })}

                    {!item.product.composition && (
                      <p className="text-sm text-red-600">
                        Este produto não possui composição cadastrada.
                      </p>
                    )}

                    <div className="flex justify-between pt-2">
                      <span className="text-sm text-gray-500">
                        Quantidade: 1 dose
                      </span>

                      <span className="font-semibold">
                        {currency.format(Number(item.product.salePrice))}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        changeQuantity(item.id, item.quantity - 1)
                      }
                      className="h-8 w-8 rounded border border-gray-300"
                      aria-label="Diminuir quantidade"
                    >
                      −
                    </button>

                    <span className="min-w-8 text-center font-medium">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        changeQuantity(item.id, item.quantity + 1)
                      }
                      disabled={
                        item.quantity >= Number(item.product.stock)
                      }
                      className="h-8 w-8 rounded border border-gray-300 disabled:opacity-40"
                      aria-label="Aumentar quantidade"
                    >
                      +
                    </button>

                    <span className="ml-auto font-semibold">
                      {currency.format(
                        Number(item.product.salePrice) * item.quantity,
                      )}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-gray-200 pt-4">
            <span className="font-medium text-gray-600">
              Total
            </span>

            <span className="text-2xl font-bold text-gray-900">
              {currency.format(total)}
            </span>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            O pagamento será realizado separadamente na maquininha
            ou conforme o meio utilizado pela adega.
          </p>

          {hasIncompleteComposition && (
            <p className="mt-3 text-sm text-amber-700">
              Configure todas as opções obrigatórias das doses antes de finalizar.
            </p>
          )}

          <button
            type="button"
            onClick={handleFinalize}
            disabled={cart.length === 0 || isPending || hasIncompleteComposition}
            className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Registrando venda..." : "Finalizar venda"}
          </button>
        </aside>
      </div>
    </main>
  );
}
