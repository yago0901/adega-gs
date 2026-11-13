"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finalizeSale, openCashRegister, closeCashRegister } from "./actions";
import OpeningConfirmationModal from "./OpeningConfirmationModal";
import SignOutButton from "../sign-out-button";

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
  canOpenFromPackaging: boolean;
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

type BottleOpening = {
  kind: "BOTTLE";
  productId: string;
  stockItemId: string;
  stockItemName: string;
  stockPackagingId: string;
  packagingName: string;
  quantity: number;
  volume: string;
};

type CommercialPackagingOpening = {
  kind: "COMMERCIAL";
  productId: string;
  productName: string;
  parentProductName: string;
  quantity: number;
  generatedQuantity: string;
  childProductName: string;
};

type Opening = BottleOpening | CommercialPackagingOpening;

type SaleRequestItem = {
  productId: string;
  quantity: number;
  selections: {
    groupId: string;
    optionId: string;
  }[];
};

type SalePaymentRequest = {
  paymentMethod: "CASH" | "PIX" | "CREDIT_CARD" | "DEBIT_CARD";
  amount: string;
};

type CashRegister = {
  id: string;
  openingAmount: string;
  openedAt: string;
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
  cashRegister,
  canManageCashRegister,
}: {
  products: Product[];
  cashRegister: CashRegister | null;
  canManageCashRegister: boolean;
}) {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [message, setMessage] = useState("");
  const [saleError, setSaleError] = useState("");
  const [payments, setPayments] = useState<SalePaymentRequest[]>([
    {
      paymentMethod: "CASH",
      amount: "0.00",
    },
  ]);

  const [isPending, startTransition] = useTransition();
  const [pendingOpenings, setPendingOpenings] = useState<Opening[]>([]);
  const [pendingSaleItems, setPendingSaleItems] = useState<SaleRequestItem[] | null>(null);
  const [pendingSalePayments, setPendingSalePayments] = useState<SalePaymentRequest[] | null>(null);
  const isSaleAwaitingConfirmation = pendingSaleItems !== null;

  const router = useRouter();

  const [openingAmount, setOpeningAmount] = useState("0,00");
  const [openingError, setOpeningError] = useState("");
  const [isOpeningPending, startOpeningTransition] = useTransition();
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [countedAmount, setCountedAmount] = useState("");
  const [closingError, setClosingError] = useState("");
  const [isClosingPending, startClosingTransition] = useTransition();

  const [activeView, setActiveView] = useState<"SALES" | "DELIVERIES">("SALES");

  const [closeSummary, setCloseSummary] = useState<{
    expectedAmount: string;
    countedAmount: string;
    difference: string;
    paymentTotals: {
      cash: string;
      pix: string;
      creditCard: string;
      debitCard: string;
      total: string;
    };
  } | null>(null);

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

  const paidTotal = payments.reduce(
    (sum, payment) => sum + Number(payment.amount.replace(",", ".") || 0),
    0,
  );

  const remainingAmount = Math.max(0, total - paidTotal);

  const paymentDifference = paidTotal - total;

  const isPaymentValid =
    payments.length > 0 &&
    payments.every(
      (payment) =>
        Number.isFinite(Number(payment.amount.replace(",", "."))) &&
        Number(payment.amount.replace(",", ".")) > 0,
    ) &&
    Math.abs(paymentDifference) < 0.001;

  const hasIncompleteComposition = cart.some((item) => {
    if (item.product.type !== "FRACTIONAL") return false;

    if (!item.product.composition) return true;

    return item.product.composition.groups.some((group) => {
      if (!group.required) return false;

      return !item.selections.some(
        (selection) =>
          selection.groupId === group.id &&
          group.options.some(
            (option) => option.id === selection.optionId,
          ),
      );
    });
  });

  function addProduct(product: Product) {
    if (
      Number(product.stock) <= 0 &&
      product.type !== "FRACTIONAL" &&
      !product.canOpenFromPackaging
    ) {
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
              quantity: product.canOpenFromPackaging
                ? item.quantity + 1
                : Math.min(
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

    const safeQuantity = item.product.canOpenFromPackaging
      ? Math.max(0, quantity)
      : Math.min(
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

  async function executeSale(
    saleItems: SaleRequestItem[],
    salePayments: SalePaymentRequest[],
    confirmOpenings = false,
    confirmedOpenings: Opening[] = [],
  ) {
    startTransition(async () => {
      try {
        const result = await finalizeSale(
          saleItems,
          salePayments,
          confirmOpenings,
          confirmedOpenings,
        );

        if (!result.success) {
          if (confirmOpenings) {
            setPendingOpenings([]);
            setPendingSaleItems(null);
            setPendingSalePayments(null);
          }

          setSaleError(result.error);
          return;
        }

        if ("confirmationRequired" in result) {
          setPendingOpenings(result.openings);
          setPendingSaleItems(saleItems);
          setPendingSalePayments(salePayments);
          return;
        }

        setPendingOpenings([]);
        setPendingSaleItems(null);
        setCart([]);
        setPayments([
          {
            paymentMethod: "CASH",
            amount: "0.00",
          },
        ]);
        setPendingSalePayments(null);
        setSearch("");

        setMessage(
          `Venda ${result.saleId} registrada! Total: ${currency.format(
            Number(result.total),
          )}`,
        );
      } catch {
        setSaleError("Não foi possível finalizar a venda. Tente novamente.");
      }
    });
  }

  function handlePaymentChange(
    index: number,
    field: "paymentMethod" | "amount",
    value: string,
  ) {
    setPayments((current) =>
      current.map((payment, i) =>
        i === index
          ? {
            ...payment,
            [field]:
              field === "amount"
                ? value.replace(/[^\d.,]/g, "")
                : value,
          }
          : payment,
      ),
    );
  }

  function handleAddPayment() {
    if (payments.length >= 4) return;

    setPayments((current) => [
      ...current,
      {
        paymentMethod: "PIX",
        amount: "",
      },
    ]);
  }

  function handleRemovePayment(index: number) {
    setPayments((current) =>
      current.filter((_, i) => i !== index),
    );
  }

  function handleFinalize() {
    if (cart.length === 0 || isPending) return;

    setMessage("");
    setSaleError("");

    const saleItems = cart.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      selections: item.selections,
    }));

    const salePayments = payments.map((payment) => ({
      ...payment,
      amount: payment.amount.trim().replace(",", "."),
    }));

    executeSale(saleItems, salePayments);
  }

  function handleCloseCashRegister() {
    setClosingError("");

    startClosingTransition(async () => {
      const result = await closeCashRegister(countedAmount);

      if (!result.success) {
        setClosingError(result.error);
        return;
      }

      setCloseSummary({
        expectedAmount: result.expectedAmount,
        countedAmount: result.countedAmount,
        difference: result.difference,
        paymentTotals: result.paymentTotals,
      });

      setShowCloseModal(false);
    });
  }

  function handleConfirmOpenings() {
    if (!pendingSaleItems || isPending) return;

    setMessage("");
    setSaleError("");
    if (!pendingSalePayments) return;

    executeSale(
      pendingSaleItems,
      pendingSalePayments,
      true,
      pendingOpenings,
    );
  }

  function handleCancelOpenings() {
    setPendingOpenings([]);
    setPendingSaleItems(null);
    setPendingSalePayments(null);
    setMessage("Abertura de estoque cancelada. A venda não foi realizada.");
  }

  return (
    <main className="space-y-6 p-4 md:p-8">
      {!cashRegister && canManageCashRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cash-register-title"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h2
              id="cash-register-title"
              className="text-xl font-bold text-gray-900"
            >
              Abrir caixa
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Informe o valor inicial disponível na gaveta para troco.
              Você precisa abrir o caixa antes de iniciar as vendas.
            </p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setOpeningError("");

                startOpeningTransition(async () => {
                  const result = await openCashRegister(openingAmount);

                  if (!result.success) {
                    setOpeningError(result.error);
                    return;
                  }

                  router.refresh();
                });
              }}
            >
              <div>
                <label
                  htmlFor="openingAmount"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Dinheiro inicial (R$)
                </label>

                <input
                  id="openingAmount"
                  type="text"
                  inputMode="decimal"
                  value={openingAmount}
                  onChange={(event) =>
                    setOpeningAmount(event.target.value)
                  }
                  placeholder="0,00"
                  disabled={isOpeningPending}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg outline-none focus:border-blue-500"
                />
              </div>

              {openingError && (
                <p role="alert" className="text-sm text-red-600">
                  {openingError}
                </p>
              )}

              <button
                type="submit"
                disabled={isOpeningPending}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isOpeningPending ? "Abrindo caixa..." : "Abrir caixa"}
              </button>
            </form>
          </div>
        </div>
      )}
      {!cashRegister && !canManageCashRegister && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <h2 className="font-semibold text-amber-800">
            Caixa fechado
          </h2>

          <p className="mt-2 text-sm text-amber-700">
            Aguardando a abertura do caixa por um funcionário autorizado.
            Você poderá registrar vendas assim que o caixa estiver aberto.
          </p>
        </div>
      )}
      {showCloseModal && canManageCashRegister && cashRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-gray-900">
              Fechar caixa
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Informe o valor total em dinheiro que você contou na gaveta.
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleCloseCashRegister();
              }}
              className="mt-5 space-y-4"
            >
              <div>
                <label
                  htmlFor="countedAmount"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Dinheiro contado (R$)
                </label>

                <input
                  id="countedAmount"
                  type="text"
                  inputMode="decimal"
                  value={countedAmount}
                  onChange={(event) => setCountedAmount(event.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              {closingError && (
                <p className="text-sm text-red-600">
                  {closingError}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  disabled={isClosingPending}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isClosingPending || !countedAmount.trim()}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isClosingPending ? "Fechando..." : "Confirmar fechamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {closeSummary && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-gray-900">
              Caixa fechado!
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Confira o resumo da sessão encerrada.
            </p>

            <div className="mt-5 space-y-3 rounded-lg bg-gray-50 p-4">
              <div className="space-y-2 border-b border-gray-200 pb-3">
                <h3 className="text-sm font-semibold text-gray-800">
                  Vendas por forma de pagamento
                </h3>

                {[
                  { label: "Dinheiro", value: closeSummary.paymentTotals.cash },
                  { label: "PIX", value: closeSummary.paymentTotals.pix },
                  { label: "Crédito", value: closeSummary.paymentTotals.creditCard },
                  { label: "Débito", value: closeSummary.paymentTotals.debitCard },
                ].map((payment) => (
                  <div
                    key={payment.label}
                    className="flex justify-between gap-4"
                  >
                    <span className="text-sm text-gray-600">
                      {payment.label}
                    </span>
                    <strong className="text-sm text-gray-900">
                      {Number(payment.value).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </strong>
                  </div>
                ))}

                <div className="flex justify-between gap-4 border-t border-gray-200 pt-2">
                  <span className="text-sm font-semibold text-gray-700">
                    Total de vendas
                  </span>
                  <strong className="text-gray-900">
                    {Number(closeSummary.paymentTotals.total).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </strong>
                </div>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-sm text-gray-600">
                  Dinheiro esperado
                </span>
                <strong>
                  {Number(closeSummary.expectedAmount).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </strong>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-sm text-gray-600">
                  Dinheiro contado
                </span>
                <strong>
                  {Number(closeSummary.countedAmount).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </strong>
              </div>

              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between gap-4">
                  <span className="text-sm font-semibold text-gray-700">
                    Diferença
                  </span>
                  <strong
                    className={
                      Number(closeSummary.difference) === 0
                        ? "text-green-600"
                        : Number(closeSummary.difference) > 0
                          ? "text-blue-600"
                          : "text-red-600"
                    }
                  >
                    {Number(closeSummary.difference) > 0 ? "+" : ""}
                    {Number(closeSummary.difference).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </strong>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {Number(closeSummary.difference) > 0
                    ? "Sobra no caixa"
                    : Number(closeSummary.difference) < 0
                      ? "Falta no caixa"
                      : "Caixa sem diferença"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setCloseSummary(null);
                router.refresh();
              }}
              className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Frente de Caixa
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            {activeView === "SALES"
              ? "Selecione os produtos para iniciar uma venda."
              : "Área de pedidos de entrega."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex rounded-lg border border-gray-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveView("SALES")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${activeView === "SALES"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
                }`}
            >
              Vendas
            </button>

            <button
              type="button"
              onClick={() => setActiveView("DELIVERIES")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${activeView === "DELIVERIES"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
                }`}
            >
              Entregas
            </button>
          </nav>

          {canManageCashRegister && cashRegister && (
            <button
              type="button"
              onClick={() => {
                setCountedAmount("");
                setClosingError("");
                setShowCloseModal(true);
              }}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              Fechar caixa
            </button>
          )}

          <SignOutButton />
        </div>
      </header>

      {message && (
        <div
          role="status"
          className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700"
        >
          {message}
        </div>
      )}

      {saleError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
        >
          {saleError}
        </div>
      )}

      <OpeningConfirmationModal
        openings={pendingOpenings}
        isPending={isPending}
        onConfirm={handleConfirmOpenings}
        onCancel={handleCancelOpenings}
      />

      {activeView === "SALES" ? (
        cashRegister ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
            <section className="space-y-4">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou código..."
                disabled={isSaleAwaitingConfirmation}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              />

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {availableProducts.map((product) => {
                  const stock = Number(product.stock);

                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={
                        (
                          stock <= 0 &&
                          product.type !== "FRACTIONAL" &&
                          !product.canOpenFromPackaging
                        ) ||
                        isSaleAwaitingConfirmation
                      }
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
                        disabled={isSaleAwaitingConfirmation}
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

                          const availableOptions = group.options;

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
                                disabled={isSaleAwaitingConfirmation}
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
                                    {option.name} — {option.quantity} {option.unit}
                                  </option>
                                ))}
                              </select>

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
                          disabled={isSaleAwaitingConfirmation}
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
                            (!item.product.canOpenFromPackaging &&
                              item.quantity >= Number(item.product.stock)) ||
                            isSaleAwaitingConfirmation
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
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Formas de pagamento</h3>

                  <button
                    type="button"
                    onClick={handleAddPayment}
                    disabled={payments.length >= 4}
                    className="text-sm text-blue-600 disabled:opacity-50"
                  >
                    + Adicionar
                  </button>
                </div>

                {payments.map((payment, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={payment.paymentMethod}
                      onChange={(event) =>
                        handlePaymentChange(
                          index,
                          "paymentMethod",
                          event.target.value,
                        )
                      }
                      className="min-w-0 flex-1 rounded-md border p-2"
                    >
                      <option value="CASH">Dinheiro</option>
                      <option value="PIX">PIX</option>
                      <option value="CREDIT_CARD">Cartão de crédito</option>
                      <option value="DEBIT_CARD">Cartão de débito</option>
                    </select>

                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Valor"
                      value={payment.amount}
                      onChange={(event) =>
                        handlePaymentChange(index, "amount", event.target.value)
                      }
                      className="w-28 rounded-md border p-2"
                    />

                    {payments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePayment(index)}
                        className="text-red-600"
                        aria-label="Remover pagamento"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                ))}

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total informado:</span>
                    <span>
                      {paidTotal.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Restante:</span>
                    <span>
                      {remainingAmount.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>

                  {paymentDifference > 0.001 && (
                    <p className="text-red-600">
                      O valor informado ultrapassa o total da venda.
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleFinalize}
                disabled={
                  cart.length === 0 ||
                  isPending ||
                  hasIncompleteComposition ||
                  pendingSaleItems !== null ||
                  !isPaymentValid
                }
                className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "Registrando venda..." : "Finalizar venda"}
              </button>
            </aside>
          </div>
        ) : null
      ) : (
        <section className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <h2 className="text-lg font-semibold text-gray-800">
            Pedidos de entrega
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Esta área será implementada futuramente.
          </p>
        </section>
      )}
    </main>
  );
}
