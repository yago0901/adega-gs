
"use client";

import { useMemo, useState, useTransition } from "react";
import { finalizeSale } from "./actions";

type Product = {
  id: string;
  code: string;
  name: string;
  salePrice: string;
  unit: string;
  stock: string;
};

type CartItem = {
  product: Product;
  quantity: number;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function PosClient({ products }: { products: Product[] }) {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "PIX" | "CREDIT_CARD" | "DEBIT_CARD" | "">("");
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
    (sum, item) => sum + Number(item.product.salePrice) * item.quantity,
    0,
  );

  function addProduct(product: Product) {
    if (Number(product.stock) <= 0) {
      setMessage("Este produto está sem estoque.");
      return;
    }

    setMessage("");

    setCart((current) => {
      const existing = current.find(
        (item) => item.product.id === product.id,
      );

      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
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

      return [...current, { product, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, quantity: number) {
    const item = cart.find(
      (cartItem) => cartItem.product.id === productId,
    );

    if (!item) return;

    const safeQuantity = Math.min(
      Number(item.product.stock),
      Math.max(0, quantity),
    );

    setCart((current) =>
      safeQuantity === 0
        ? current.filter((cartItem) => cartItem.product.id !== productId)
        : current.map((cartItem) =>
          cartItem.product.id === productId
            ? { ...cartItem, quantity: safeQuantity }
            : cartItem,
        ),
    );
  }

  function removeProduct(productId: string) {
    setCart((current) =>
      current.filter((item) => item.product.id !== productId),
    );
  }

  function handleFinalize() {
    if (cart.length === 0 || isPending) return;

    if (!paymentMethod) {
      setMessage("Selecione uma forma de pagamento.");
      return;
    }

    setMessage("");

    startTransition(async () => {
      const result = await finalizeSale(
        cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        paymentMethod,
      );

      if (!result.success) {
        setMessage(result.error);
        return;
      }

      setCart([]);
      setSearch("");
      setPaymentMethod("");

      setMessage(
        `Venda ${result.saleId} finalizada! Total: ${currency.format(Number(result.total))}`,
      );
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
                  <span className="block font-semibold text-gray-900">
                    {product.name}
                  </span>

                  <span className="mt-1 block text-xs text-gray-500">
                    Código: {product.code}
                  </span>

                  <span className="mt-3 block text-lg font-bold text-gray-900">
                    {currency.format(Number(product.salePrice))}
                  </span>

                  <span className="mt-1 block text-xs text-gray-500">
                    Estoque: {stock} {product.unit}
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
        <div className="mt-5 space-y-3 border-t border-gray-200 pt-4">
          <h3 className="font-semibold text-gray-900">
            Forma de pagamento
          </h3>

          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "CASH", label: "Dinheiro" },
              { value: "PIX", label: "Pix" },
              { value: "CREDIT_CARD", label: "Crédito" },
              { value: "DEBIT_CARD", label: "Débito" },
            ].map((method) => (
              <button
                key={method.value}
                type="button"
                onClick={() =>
                  setPaymentMethod(
                    method.value as
                    | "CASH"
                    | "PIX"
                    | "CREDIT_CARD"
                    | "DEBIT_CARD",
                  )
                }
                className={`rounded-lg border px-3 py-3 text-sm font-medium transition ${paymentMethod === method.value
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-700 hover:border-gray-400"
                  }`}
              >
                {method.label}
              </button>
            ))}
          </div>
        </div>

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
                key={item.product.id}
                className="border-b border-gray-100 pb-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.product.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {currency.format(Number(item.product.salePrice))}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeProduct(item.product.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remover
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      changeQuantity(
                        item.product.id,
                        item.quantity - 1,
                      )
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
                      changeQuantity(
                        item.product.id,
                        item.quantity + 1,
                      )
                    }
                    disabled={item.quantity >= Number(item.product.stock)}
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
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-gray-200 pt-4">
            <span className="font-medium text-gray-600">Total</span>
            <span className="text-2xl font-bold text-gray-900">
              {currency.format(total)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleFinalize}
            disabled={cart.length === 0 || isPending || !paymentMethod}
            className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Finalizando..." : "Finalizar venda"}
          </button>
        </aside>
      </div>
    </main>
  );
}
