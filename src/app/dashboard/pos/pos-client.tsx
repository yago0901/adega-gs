"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ListPagination } from "@/components/data-table/list-pagination";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fetchAddressByCep, formatCep } from "@/lib/via-cep";
import {
  finalizeSale,
  openCashRegister,
  closeCashRegister,
  registerCashSupply,
  registerCashWithdrawal,
  searchPosProductsAction,
} from "./actions";
import OpeningConfirmationModal from "./OpeningConfirmationModal";
import ReceiveDebtModal from "./ReceiveDebtModal";
import SignOutButton from "../sign-out-button";
import {
  DeliveriesTab,
  type DeliveryOrder,
} from "./components/deliveries/DeliveriesTab";

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
  imageUrl: string | null;
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

type DeliveryPaymentRequest = {
  type: "PREPAID" | "TO_COLLECT";
  method: "CASH" | "PIX" | "CREDIT_CARD" | "DEBIT_CARD";
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

type CustomerAddress = {
  id: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  reference: string | null;
  deliveryFee: string;
  isDefault: boolean;
};

type Customer = {
  id: string;
  name: string;
  phone: string;
  addresses: CustomerAddress[];
};

type Motoboy = {
  id: string;
  name: string;
  phone: string;
};

type DeliveryAddress = {
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  reference: string;
  deliveryFee: string;
};

const emptyDeliveryAddress: DeliveryAddress = {
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  reference: "",
  deliveryFee: "0",
};

function parseMoneyToCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [integer, decimal = ""] = normalized.split(".");

  return (
    Number(integer) * 100 +
    Number(decimal.padEnd(2, "0"))
  );
}

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
  products: initialProducts,
  productsMeta: initialProductsMeta,
  customers,
  motoboys,
  cashRegister,
  canManageCashRegister,
  showBackToDashboard,
  deliveries,
}: {
  products: Product[];
  productsMeta: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
  customers: Customer[];
  motoboys: Motoboy[];
  cashRegister: CashRegister | null;
  canManageCashRegister: boolean;
  showBackToDashboard: boolean;
  deliveries: DeliveryOrder[];
}) {

  const router = useRouter();

  const [search, setSearch] = useState("");
  const [productsPage, setProductsPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 250);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [message, setMessage] = useState("");
  const [saleError, setSaleError] = useState("");
  const [accountAmount, setAccountAmount] = useState("0.00");
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
  const [pendingSaleCustomerId, setPendingSaleCustomerId] = useState<string | null>(null);
  const [pendingSaleAccountAmount, setPendingSaleAccountAmount] =
    useState<string | null>(null);
  const isSaleAwaitingConfirmation = pendingSaleItems !== null;

  const [pendingSaleIsDelivery, setPendingSaleIsDelivery] = useState(false);
  const [pendingSaleDeliveryAddress, setPendingSaleDeliveryAddress] =
    useState<DeliveryAddress | null>(null);


  const [openingAmount, setOpeningAmount] = useState("0,00");
  const [openingError, setOpeningError] = useState("");
  const [isOpeningPending, startOpeningTransition] = useTransition();
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [countedAmount, setCountedAmount] = useState("");
  const [closingError, setClosingError] = useState("");
  const [isClosingPending, startClosingTransition] = useTransition();

  const [activeView, setActiveView] = useState<"SALES" | "DELIVERIES">("SALES");
  const [showReceiveDebtModal, setShowReceiveDebtModal] = useState(false);
  const [isDelivery, setIsDelivery] = useState(false);
  const [temporaryAddress, setTemporaryAddress] =
    useState<DeliveryAddress | null>(null);

  const [showTemporaryAddressModal, setShowTemporaryAddressModal] =
    useState(false);

  const [temporaryAddressDraft, setTemporaryAddressDraft] =
    useState<DeliveryAddress>(emptyDeliveryAddress);

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
    debtPaymentTotals: {
      cash: string;
      pix: string;
      creditCard: string;
      debitCard: string;
      total: string;
    };
  } | null>(null);

  const [showCashMovementModal, setShowCashMovementModal] = useState(false);
  const [cashMovementType, setCashMovementType] = useState<"SUPPLY" | "WITHDRAWAL">("SUPPLY");
  const [cashMovementAmount, setCashMovementAmount] = useState("");
  const [cashMovementDescription, setCashMovementDescription] = useState("");
  const [cashMovementError, setCashMovementError] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerOptions, setShowCustomerOptions] = useState(false);
  const [showCustomerSection, setShowCustomerSection] = useState(false);
  const [isCashMovementPending, startCashMovementTransition] = useTransition();

  const [deliveryPayments, setDeliveryPayments] = useState<
    DeliveryPaymentRequest[]
  >([]);

  const [
    pendingSaleDeliveryPayments,
    setPendingSaleDeliveryPayments,
  ] = useState<DeliveryPaymentRequest[] | null>(null);

  const productsQuery = useQuery({
    queryKey: ["pos-products", debouncedSearch, productsPage],
    queryFn: () =>
      searchPosProductsAction({
        search: debouncedSearch,
        page: productsPage,
        pageSize: initialProductsMeta.pageSize,
        sortBy: "name",
        sortDir: "asc",
      }),
    initialData:
      debouncedSearch === "" && productsPage === 1
        ? {
            items: initialProducts,
            total: initialProductsMeta.total,
            page: initialProductsMeta.page,
            pageSize: initialProductsMeta.pageSize,
            pageCount: initialProductsMeta.pageCount,
          }
        : undefined,
    placeholderData: keepPreviousData,
  });

  const availableProducts = productsQuery.data?.items ?? initialProducts;

  const availableCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();

    if (!term) return [];

    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(term) ||
        customer.phone.includes(term),
    );
  }, [customers, customerSearch]);

  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId,
  );

  const selectedCustomerAddress =
    selectedCustomer?.addresses.find(
      (address) => address.id === selectedAddressId,
    ) ??
    selectedCustomer?.addresses.find((address) => address.isDefault) ??
    selectedCustomer?.addresses[0] ??
    null;

  const currentDeliveryAddress: DeliveryAddress | null =
    temporaryAddress ??
    (selectedCustomerAddress
      ? {
        zipCode: selectedCustomerAddress.zipCode,
        street: selectedCustomerAddress.street,
        number: selectedCustomerAddress.number,
        complement: selectedCustomerAddress.complement ?? "",
        neighborhood: selectedCustomerAddress.neighborhood,
        city: selectedCustomerAddress.city,
        state: selectedCustomerAddress.state,
        reference: selectedCustomerAddress.reference ?? "",
        deliveryFee: selectedCustomerAddress.deliveryFee,
      }
      : null);

  const itemsTotal = cart.reduce(
    (sum, item) =>
      sum + Number(item.product.salePrice) * item.quantity,
    0,
  );

  const deliveryFeeCents = isDelivery
    ? parseMoneyToCents(currentDeliveryAddress?.deliveryFee ?? "0")
    : 0;

  const deliveryFeeAmount =
    deliveryFeeCents === null ? 0 : deliveryFeeCents / 100;

  const total =
    itemsTotal + (isDelivery && deliveryFeeCents !== null ? deliveryFeeAmount : 0);

  const totalCents = Math.round(total * 100);
  const itemsTotalCents = Math.round(itemsTotal * 100);

  const paymentAmountsInCents = payments.map((payment) =>
    parseMoneyToCents(payment.amount),
  );

  const accountAmountCents = parseMoneyToCents(accountAmount);

  const paidTotalCents = paymentAmountsInCents.reduce<number>(
    (sum, amount) => sum + (amount ?? 0),
    0,
  );

  const distributedTotalCents =
    paidTotalCents + (accountAmountCents ?? 0);

  const cashReceivedCents = payments.reduce((sum, payment) => {
    if (payment.paymentMethod !== "CASH") return sum;

    return sum + (parseMoneyToCents(payment.amount) ?? 0);
  }, 0);

  const changeAmountCents = Math.max(
    0,
    distributedTotalCents - totalCents,
  );

  const hasInvalidChange =
    changeAmountCents > cashReceivedCents;

  const remainingAmount =
    Math.max(0, totalCents - distributedTotalCents) / 100;

  const changeAmount = changeAmountCents / 100;

  const activePayments = payments.filter((payment) => {
    const cents = parseMoneyToCents(payment.amount);
    return cents !== null && cents > 0;
  });

  const hasDuplicatePaymentMethods =
    new Set(activePayments.map((payment) => payment.paymentMethod)).size !==
    activePayments.length;

  const paidTotal = paidTotalCents / 100;

  const deliveryPaymentAmountsInCents = deliveryPayments.map((payment) =>
    parseMoneyToCents(payment.amount),
  );


  const deliveryTotalCents = deliveryPaymentAmountsInCents.reduce<number>(
    (sum, amount) => sum + (amount ?? 0),
    0,
  );

  const hasInvalidDeliveryPayment = deliveryPayments.some(
    (payment, index) => {
      const amount = deliveryPaymentAmountsInCents[index];

      return (
        amount === null ||
        amount <= 0 ||
        !["PREPAID", "TO_COLLECT"].includes(payment.type) ||
        !["CASH", "PIX", "CREDIT_CARD", "DEBIT_CARD"].includes(payment.method)
      );
    },
  );

  const hasDuplicateDeliveryPayments =
    new Set(
      deliveryPayments.map(
        (payment) => `${payment.type}:${payment.method}`,
      ),
    ).size !== deliveryPayments.length;

  const deliveryNonCashCents = deliveryPayments.reduce(
    (sum, payment, index) => {
      const amount = deliveryPaymentAmountsInCents[index] ?? 0;

      return payment.type === "PREPAID" || payment.method !== "CASH"
        ? sum + amount
        : sum;
    },
    0,
  );

  const deliveryCashToCollectCents = deliveryPayments.reduce(
    (sum, payment, index) => {
      const amount = deliveryPaymentAmountsInCents[index] ?? 0;

      return payment.type === "TO_COLLECT" && payment.method === "CASH"
        ? sum + amount
        : sum;
    },
    0,
  );

  const deliveryChangeCents = Math.max(
    0,
    deliveryTotalCents - totalCents,
  );

  const isDeliveryPaymentValid =
    deliveryPayments.length > 0 &&
    deliveryPayments.length <= 8 &&
    !hasInvalidDeliveryPayment &&
    !hasDuplicateDeliveryPayments &&
    deliveryFeeCents !== null &&
    deliveryFeeCents >= 0 &&
    deliveryTotalCents >= totalCents &&
    deliveryNonCashCents <= totalCents &&
    deliveryChangeCents <= deliveryCashToCollectCents;


  const isPaymentValid = isDelivery
    ? Boolean(
      selectedCustomerId &&
      currentDeliveryAddress &&
      deliveryFeeCents !== null &&
      isDeliveryPaymentValid
    )
    : (
      paymentAmountsInCents.every(
        (amount) => amount !== null && amount >= 0,
      ) &&
      accountAmountCents !== null &&
      accountAmountCents >= 0 &&
      !hasDuplicatePaymentMethods &&
      distributedTotalCents >= totalCents &&
      !hasInvalidChange &&
      (accountAmountCents === 0 || Boolean(selectedCustomerId))
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
    customerId: string | null = selectedCustomerId || null,
    saleAccountAmount: string = accountAmount.trim().replace(",", "."),
    saleIsDelivery = false,
    saleDeliveryAddress: DeliveryAddress | null = null,
    saleDeliveryPayments: DeliveryPaymentRequest[] = [],
  ) {
    startTransition(async () => {
      try {
        const result = await finalizeSale(
          saleItems,
          salePayments,
          confirmOpenings,
          confirmedOpenings,
          customerId,
          saleAccountAmount,
          saleIsDelivery,
          saleDeliveryAddress,
          saleDeliveryPayments,
        );

        if (!result.success) {
          if (confirmOpenings) {
            setPendingOpenings([]);
            setPendingSaleItems(null);
            setPendingSalePayments(null);
            setPendingSaleCustomerId(null);
            setPendingSaleAccountAmount(null);
            setPendingSaleIsDelivery(false);
            setPendingSaleDeliveryAddress(null);
            setPendingSaleDeliveryPayments(null);
          }

          setSaleError(result.error);
          return;
        }

        if ("confirmationRequired" in result) {
          setPendingOpenings(result.openings);
          setPendingSaleItems(saleItems);
          setPendingSalePayments(salePayments);
          setPendingSaleCustomerId(customerId);
          setPendingSaleAccountAmount(saleAccountAmount);
          setPendingSaleIsDelivery(saleIsDelivery);
          setPendingSaleDeliveryAddress(saleDeliveryAddress);
          setPendingSaleDeliveryPayments(saleDeliveryPayments);
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
        setPendingSaleCustomerId(null);
        setSelectedCustomerId("");
        setCustomerSearch("");
        setShowCustomerOptions(false);
        setShowCustomerSection(false);
        setSearch("");
        setProductsPage(1);
        setAccountAmount("0.00");
        setPendingSaleAccountAmount(null);
        setPendingSaleIsDelivery(false);
        setPendingSaleDeliveryAddress(null);
        setPendingSaleDeliveryPayments(null);

        setDeliveryPayments([]);
        setIsDelivery(false);
        setTemporaryAddress(null);

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

  function handleAddDeliveryPayment() {
    if (deliveryPayments.length >= 8) return;

    setDeliveryPayments((current) => [
      ...current,
      {
        type: "TO_COLLECT",
        method: "PIX",
        amount: "",
      },
    ]);
  }

  function handleDeliveryPaymentChange(
    index: number,
    field: "type" | "method" | "amount",
    value: string,
  ) {
    setDeliveryPayments((current) =>
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

  function handleRemoveDeliveryPayment(index: number) {
    setDeliveryPayments((current) =>
      current.filter((_, i) => i !== index),
    );
  }

  function handleFinalize() {
    if (cart.length === 0 || isPending) return;

    setMessage("");
    setSaleError("");

    if (isDelivery && !currentDeliveryAddress) {
      setSaleError("Informe um endereço válido para a entrega.");
      return;
    }

    if (isDelivery && deliveryFeeCents === null) {
      setSaleError("Informe uma taxa de entrega válida.");
      return;
    }

    const saleItems = cart.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      selections: item.selections,
    }));

    const salePayments = isDelivery
      ? []
      : payments
        .filter((payment) => {
          const cents = parseMoneyToCents(payment.amount);
          return cents !== null && cents > 0;
        })
        .map((payment) => ({
          ...payment,
          amount: payment.amount.trim().replace(",", "."),
        }));

    executeSale(
      saleItems,
      salePayments,
      false,
      [],
      selectedCustomerId || null,
      isDelivery ? "0" : accountAmount.trim().replace(",", "."),
      isDelivery,
      isDelivery ? currentDeliveryAddress : null,
      isDelivery
        ? deliveryPayments.map((payment) => ({
          ...payment,
          amount: payment.amount.trim().replace(",", "."),
        }))
        : [],
    );
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
        debtPaymentTotals: result.debtPaymentTotals,
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
      pendingSaleCustomerId,
      pendingSaleAccountAmount ?? "0.00",
      pendingSaleIsDelivery,
      pendingSaleDeliveryAddress,
      pendingSaleDeliveryPayments ?? [],
    );
  }

  function handleCancelOpenings() {
    setPendingOpenings([]);
    setPendingSaleItems(null);
    setPendingSalePayments(null);
    setPendingSaleCustomerId(null);
    setSelectedCustomerId("");
    setPendingSaleAccountAmount(null);
    setPendingSaleIsDelivery(false);
    setPendingSaleDeliveryAddress(null);
    setPendingSaleDeliveryPayments(null);
    setMessage("Abertura de estoque cancelada. A venda não foi realizada.");
  }

  function handleOpenCashMovement(type: "SUPPLY" | "WITHDRAWAL") {
    setCashMovementType(type);
    setCashMovementAmount("");
    setCashMovementDescription("");
    setCashMovementError("");
    setShowCashMovementModal(true);
  }

  function handleCashMovement() {
    setCashMovementError("");

    startCashMovementTransition(async () => {
      try {
        const result =
          cashMovementType === "SUPPLY"
            ? await registerCashSupply(
              cashMovementAmount,
              cashMovementDescription,
            )
            : await registerCashWithdrawal(
              cashMovementAmount,
              cashMovementDescription,
            );

        if (!result.success) {
          setCashMovementError(result.error);
          return;
        }

        setShowCashMovementModal(false);
        setCashMovementAmount("");
        setCashMovementDescription("");

        setMessage(
          `${cashMovementType === "SUPPLY" ? "Suprimento" : "Sangria"} registrado com sucesso! Saldo físico: ${currency.format(Number(result.balance))}`,
        );

        router.refresh();
      } catch {
        setCashMovementError(
          "Não foi possível registrar a movimentação. Tente novamente.",
        );
      }
    });
  }

  function handleSaveTemporaryAddress(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const feeCents = parseMoneyToCents(temporaryAddressDraft.deliveryFee);

    if (feeCents === null || feeCents < 0) {
      setSaleError("Informe uma taxa de entrega válida no endereço temporário.");
      return;
    }

    setSaleError("");
    setTemporaryAddress({
      ...temporaryAddressDraft,
      deliveryFee: temporaryAddressDraft.deliveryFee.trim().replace(",", "."),
    });
    setShowTemporaryAddressModal(false);
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

      {showCashMovementModal && canManageCashRegister && cashRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cash-movement-title"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h2
              id="cash-movement-title"
              className="text-xl font-bold text-gray-900"
            >
              {cashMovementType === "SUPPLY"
                ? "Adicionar dinheiro ao caixa"
                : "Retirar dinheiro do caixa"}
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              {cashMovementType === "SUPPLY"
                ? "Informe o valor que será colocado no caixa."
                : "Informe o valor que será retirado do caixa."}
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleCashMovement();
              }}
              className="mt-5 space-y-4"
            >
              <div>
                <label
                  htmlFor="cashMovementAmount"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Valor (R$)
                </label>

                <input
                  id="cashMovementAmount"
                  type="text"
                  inputMode="decimal"
                  value={cashMovementAmount}
                  onChange={(event) =>
                    setCashMovementAmount(event.target.value)
                  }
                  placeholder="0,00"
                  disabled={isCashMovementPending}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 text-lg text-gray-900 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="cashMovementDescription"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Motivo (opcional)
                </label>

                <textarea
                  id="cashMovementDescription"
                  value={cashMovementDescription}
                  onChange={(event) =>
                    setCashMovementDescription(event.target.value)
                  }
                  placeholder={
                    cashMovementType === "SUPPLY"
                      ? "Ex.: Dinheiro para troco"
                      : "Ex.: Retirada para o cofre"
                  }
                  maxLength={200}
                  rows={3}
                  disabled={isCashMovementPending}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500"
                />
              </div>

              {cashMovementError && (
                <p role="alert" className="text-sm text-red-600">
                  {cashMovementError}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCashMovementModal(false)}
                  disabled={isCashMovementPending}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    isCashMovementPending ||
                    !cashMovementAmount.trim()
                  }
                  className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${cashMovementType === "SUPPLY"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                    }`}
                >
                  {isCashMovementPending
                    ? "Registrando..."
                    : cashMovementType === "SUPPLY"
                      ? "Confirmar suprimento"
                      : "Confirmar sangria"}
                </button>
              </div>
            </form>
          </div>
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
              <div className="space-y-2 border-b border-gray-200 pb-3">
                <h3 className="text-sm font-semibold text-gray-800">
                  Recebimentos de fiados
                </h3>

                {[
                  { label: "Dinheiro", value: closeSummary.debtPaymentTotals.cash },
                  { label: "PIX", value: closeSummary.debtPaymentTotals.pix },
                  { label: "Crédito", value: closeSummary.debtPaymentTotals.creditCard },
                  { label: "Débito", value: closeSummary.debtPaymentTotals.debitCard },
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
                    Total recebido
                  </span>
                  <strong className="text-gray-900">
                    {Number(closeSummary.debtPaymentTotals.total).toLocaleString("pt-BR", {
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
          {showBackToDashboard && (
            <Link
              href="/dashboard"
              className="text-sm text-emerald-700 hover:underline"
            >
              ← Voltar ao painel
            </Link>
          )}

          <h1
            className={`text-2xl font-bold text-gray-900 ${
              showBackToDashboard ? "mt-3" : ""
            }`}
          >
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

          {activeView === "SALES" && cashRegister && (
            <button
              type="button"
              onClick={() => setShowReceiveDebtModal(true)}
              className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              Pagar Fiado
            </button>
          )}

          {canManageCashRegister && cashRegister && (
            <>
              <button
                type="button"
                onClick={() => handleOpenCashMovement("SUPPLY")}
                className="rounded-lg border border-green-200 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50"
              >
                + Suprimento
              </button>

              <button
                type="button"
                onClick={() => handleOpenCashMovement("WITHDRAWAL")}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                − Sangria
              </button>
            </>
          )}

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

      {showTemporaryAddressModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="temporary-address-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
          >
            <h2
              id="temporary-address-title"
              className="text-xl font-bold text-gray-900"
            >
              Endereço temporário
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Informe o endereço onde esta venda deverá ser entregue.
              O endereço principal do cliente não será alterado.
            </p>

            <form
              onSubmit={handleSaveTemporaryAddress}
              className="mt-5 space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    CEP *
                  </label>
                  <input
                    value={temporaryAddressDraft.zipCode}
                    onChange={(event) => {
                      const formatted = formatCep(event.target.value);
                      setTemporaryAddressDraft((current) => ({
                        ...current,
                        zipCode: formatted,
                      }));
                    }}
                    onBlur={async (event) => {
                      const digits = event.currentTarget.value.replace(
                        /\D/g,
                        "",
                      );
                      if (digits.length !== 8) return;

                      const address = await fetchAddressByCep(digits);
                      if (!address) return;

                      setTemporaryAddressDraft((current) => ({
                        ...current,
                        zipCode: address.zipCode,
                        street: address.street || current.street,
                        neighborhood:
                          address.neighborhood || current.neighborhood,
                        city: address.city || current.city,
                        state: address.state || current.state,
                      }));
                    }}
                    required
                    maxLength={9}
                    placeholder="00000-000"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Número *
                  </label>
                  <input
                    value={temporaryAddressDraft.number}
                    onChange={(event) =>
                      setTemporaryAddressDraft((current) => ({
                        ...current,
                        number: event.target.value,
                      }))
                    }
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Rua *
                </label>
                <input
                  value={temporaryAddressDraft.street}
                  onChange={(event) =>
                    setTemporaryAddressDraft((current) => ({
                      ...current,
                      street: event.target.value,
                    }))
                  }
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Complemento
                </label>
                <input
                  value={temporaryAddressDraft.complement}
                  onChange={(event) =>
                    setTemporaryAddressDraft((current) => ({
                      ...current,
                      complement: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Bairro *
                </label>
                <input
                  value={temporaryAddressDraft.neighborhood}
                  onChange={(event) =>
                    setTemporaryAddressDraft((current) => ({
                      ...current,
                      neighborhood: event.target.value,
                    }))
                  }
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Cidade *
                  </label>
                  <input
                    value={temporaryAddressDraft.city}
                    onChange={(event) =>
                      setTemporaryAddressDraft((current) => ({
                        ...current,
                        city: event.target.value,
                      }))
                    }
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    UF *
                  </label>
                  <input
                    value={temporaryAddressDraft.state}
                    onChange={(event) =>
                      setTemporaryAddressDraft((current) => ({
                        ...current,
                        state: event.target.value.toUpperCase(),
                      }))
                    }
                    required
                    maxLength={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Ponto de referência
                </label>
                <textarea
                  value={temporaryAddressDraft.reference}
                  onChange={(event) =>
                    setTemporaryAddressDraft((current) => ({
                      ...current,
                      reference: event.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Taxa de entrega (R$) *
                </label>
                <input
                  value={temporaryAddressDraft.deliveryFee}
                  onChange={(event) =>
                    setTemporaryAddressDraft((current) => ({
                      ...current,
                      deliveryFee: event.target.value.replace(/[^\d.,]/g, ""),
                    }))
                  }
                  required
                  inputMode="decimal"
                  placeholder="0,00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTemporaryAddressModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Salvar endereço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReceiveDebtModal && cashRegister && activeView === "SALES" && (
        <ReceiveDebtModal
          customers={customers}
          onClose={() => setShowReceiveDebtModal(false)}
          onSuccess={(result) => {
            setShowReceiveDebtModal(false);

            setMessage(
              `Recebimento de ${currency.format(Number(result.amountPaid))} registrado com sucesso!${Number(result.changeAmount) > 0
                ? ` Troco: ${currency.format(Number(result.changeAmount))}`
                : ""
              }`,
            );

            router.refresh();
          }}
        />
      )}

      {activeView === "SALES" ? (
        cashRegister ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
            <section className="space-y-4">
              <Input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setProductsPage(1);
                }}
                placeholder="Digite para filtrar produtos..."
                disabled={isSaleAwaitingConfirmation}
                className="h-11"
              />

              {productsQuery.isFetching && (
                <p className="text-xs text-muted-foreground">
                  Atualizando produtos...
                </p>
              )}

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
                      <div className="flex items-start gap-3">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt=""
                            className="h-14 w-14 shrink-0 rounded-lg border border-gray-100 object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
                            {product.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
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

                          <span className="mt-2 block text-lg font-bold text-gray-900">
                            {currency.format(Number(product.salePrice))}
                          </span>

                          <span className="mt-1 block text-xs text-gray-500">
                            Disponível: {stock} un.
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {availableProducts.length === 0 && (
                  <p className="col-span-full rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                    Nenhum produto encontrado.
                  </p>
                )}
              </div>

              <ListPagination
                page={productsQuery.data?.page ?? productsPage}
                pageCount={productsQuery.data?.pageCount ?? 1}
                total={productsQuery.data?.total ?? 0}
                pageSize={
                  productsQuery.data?.pageSize ??
                  initialProductsMeta.pageSize
                }
                isLoading={productsQuery.isFetching}
                onPageChange={setProductsPage}
              />
            </section>

            <aside className="h-fit space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900">Venda atual</h2>

              {!showCustomerSection ? (
                <button
                  type="button"
                  disabled={isSaleAwaitingConfirmation}
                  onClick={() => setShowCustomerSection(true)}
                  className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50"
                >
                  + Adicionar cliente
                </button>
              ) : (
                <div>
                  <div className="grid grid-cols-2 items-end gap-3">
                    <div className="relative min-w-0">
                      <label
                        htmlFor="customerSearch"
                        className="mb-2 block text-sm font-medium text-gray-700"
                      >
                        Cliente
                      </label>

                      <input
                        id="customerSearch"
                        type="text"
                        value={customerSearch}
                        placeholder="Nome ou telefone..."
                        disabled={isSaleAwaitingConfirmation}
                        onChange={(event) => {
                          setCustomerSearch(event.target.value);
                          setSelectedCustomerId("");
                          setSelectedAddressId("");
                          setIsDelivery(false);
                          setDeliveryPayments([]);
                          setTemporaryAddress(null);
                          setShowCustomerOptions(true);
                        }}
                        onFocus={() => setShowCustomerOptions(true)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />

                      {showCustomerOptions && customerSearch.trim() && (
                        <div className="absolute z-20 mt-1 max-h-48 w-[calc(200%+0.75rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                          {availableCustomers.length > 0 ? (
                            availableCustomers.map((customer) => (
                              <button
                                key={customer.id}
                                type="button"
                                onClick={() => {
                                  const defaultAddress =
                                    customer.addresses.find(
                                      (address) => address.isDefault,
                                    ) ?? customer.addresses[0] ?? null;

                                  setSelectedCustomerId(customer.id);
                                  setSelectedAddressId(
                                    defaultAddress?.id ?? "",
                                  );
                                  setCustomerSearch(
                                    `${customer.name} — ${customer.phone}`,
                                  );
                                  setTemporaryAddress(null);
                                  setIsDelivery(false);
                                  setDeliveryPayments([]);
                                  setShowCustomerOptions(false);
                                }}
                                className="block w-full border-b border-gray-100 px-3 py-3 text-left text-sm hover:bg-gray-50"
                              >
                                <span className="block font-medium text-gray-900">
                                  {customer.name}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {customer.phone}
                                </span>
                              </button>
                            ))
                          ) : (
                            <p className="p-3 text-sm text-gray-500">
                              Nenhum cliente encontrado.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex min-h-[38px] items-center justify-start pb-0.5">
                      {selectedCustomer ? (
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-800">
                          <input
                            type="checkbox"
                            checked={isDelivery}
                            disabled={isSaleAwaitingConfirmation}
                            onChange={(event) => {
                              const checked = event.target.checked;

                              setIsDelivery(checked);

                              if (!checked) {
                                setDeliveryPayments([]);
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600"
                          />
                          Entrega
                        </label>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-3">
                    {selectedCustomerId ? (
                      <button
                        type="button"
                        disabled={isSaleAwaitingConfirmation}
                        onClick={() => {
                          setSelectedCustomerId("");
                          setSelectedAddressId("");
                          setCustomerSearch("");
                          setShowCustomerOptions(false);
                          setShowCustomerSection(false);
                          setIsDelivery(false);
                          setDeliveryPayments([]);
                          setTemporaryAddress(null);
                        }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remover cliente
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isSaleAwaitingConfirmation}
                        onClick={() => {
                          setShowCustomerSection(false);
                          setCustomerSearch("");
                          setShowCustomerOptions(false);
                        }}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>

                  {selectedCustomer && isDelivery && (
                    <div className="mt-3 space-y-2 rounded-lg border border-gray-200 p-3">
                      {!temporaryAddress &&
                        selectedCustomer.addresses.length > 1 && (
                          <label className="block text-sm font-medium text-gray-700">
                            Endereço cadastrado
                            <select
                              value={selectedAddressId}
                              disabled={isSaleAwaitingConfirmation}
                              onChange={(event) =>
                                setSelectedAddressId(event.target.value)
                              }
                              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                            >
                              {selectedCustomer.addresses.map((address) => (
                                <option key={address.id} value={address.id}>
                                  {address.street}, {address.number}
                                  {address.isDefault ? " (padrão)" : ""} — taxa{" "}
                                  {currency.format(
                                    Number(address.deliveryFee),
                                  )}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}

                      {currentDeliveryAddress ? (
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-500">
                            Endereço da entrega
                          </p>

                          <p className="mt-1 text-sm text-gray-800">
                            {currentDeliveryAddress.street},{" "}
                            {currentDeliveryAddress.number}
                            {currentDeliveryAddress.complement &&
                              ` — ${currentDeliveryAddress.complement}`}
                          </p>

                          <p className="text-sm text-gray-600">
                            {currentDeliveryAddress.neighborhood} —{" "}
                            {currentDeliveryAddress.city}/
                            {currentDeliveryAddress.state}
                          </p>

                          <p className="text-sm text-gray-600">
                            CEP: {currentDeliveryAddress.zipCode}
                          </p>

                          <p className="mt-1 text-sm font-medium text-gray-800">
                            Taxa:{" "}
                            {currency.format(
                              Number(currentDeliveryAddress.deliveryFee),
                            )}
                          </p>

                          {currentDeliveryAddress.reference && (
                            <p className="mt-1 text-xs text-gray-500">
                              Referência: {currentDeliveryAddress.reference}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-red-600">
                          Este cliente não possui endereço cadastrado.
                        </p>
                      )}

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={isSaleAwaitingConfirmation}
                          onClick={() => {
                            setTemporaryAddressDraft(
                              temporaryAddress
                                ? { ...temporaryAddress }
                                : emptyDeliveryAddress,
                            );
                            setShowTemporaryAddressModal(true);
                          }}
                          className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                        >
                          {temporaryAddress
                            ? "Editar endereço temporário"
                            : "Informar endereço temporário"}
                        </button>

                        {temporaryAddress && (
                          <button
                            type="button"
                            disabled={isSaleAwaitingConfirmation}
                            onClick={() => setTemporaryAddress(null)}
                            className="text-xs font-medium text-gray-600 hover:underline disabled:opacity-50"
                          >
                            Usar endereço cadastrado
                          </button>
                        )}
                      </div>

                      {temporaryAddress && (
                        <p className="text-xs text-blue-700">
                          Endereço temporário — usado só nesta venda.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

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

              <div className="mt-5 space-y-2 border-t border-gray-200 pt-4">
                {isDelivery && (
                  <>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Produtos</span>
                      <span>{currency.format(itemsTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Taxa de entrega</span>
                      <span>{currency.format(deliveryFeeAmount)}</span>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-600">Total</span>

                  <span className="text-2xl font-bold text-gray-900">
                    {currency.format(total)}
                  </span>
                </div>
              </div>

              {hasIncompleteComposition && (
                <p className="mt-3 text-sm text-amber-700">
                  Configure todas as opções obrigatórias das doses antes de
                  finalizar.
                </p>
              )}

              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">
                      {isDelivery
                        ? "Pagamentos da entrega"
                        : "Formas de pagamento"}
                    </h3>
                    {isDelivery && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        Antecipado ou a receber no local — entra no caixa só
                        quando a entrega for concluída.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={
                      isDelivery
                        ? handleAddDeliveryPayment
                        : handleAddPayment
                    }
                    disabled={
                      isSaleAwaitingConfirmation ||
                      (isDelivery
                        ? deliveryPayments.length >= 8
                        : payments.length >= 4)
                    }
                    className="shrink-0 text-sm text-blue-600 disabled:opacity-50"
                  >
                    + Adicionar
                  </button>
                </div>

                {isDelivery ? (
                  <>
                    {deliveryPayments.map((payment, index) => (
                      <div
                        key={index}
                        className="space-y-2 rounded-lg border border-gray-200 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-800">
                            Pagamento {index + 1}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveDeliveryPayment(index)}
                            disabled={isSaleAwaitingConfirmation}
                            className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          >
                            Remover
                          </button>
                        </div>

                        <select
                          value={payment.type}
                          disabled={isSaleAwaitingConfirmation}
                          onChange={(event) =>
                            handleDeliveryPaymentChange(
                              index,
                              "type",
                              event.target.value,
                            )
                          }
                          className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm"
                        >
                          <option value="PREPAID">Já pago antecipadamente</option>
                          <option value="TO_COLLECT">Receber na entrega</option>
                        </select>

                        <div className="flex items-center gap-2">
                          <select
                            value={payment.method}
                            disabled={isSaleAwaitingConfirmation}
                            onChange={(event) =>
                              handleDeliveryPaymentChange(
                                index,
                                "method",
                                event.target.value,
                              )
                            }
                            className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white p-2 text-sm"
                          >
                            <option value="CASH">Dinheiro</option>
                            <option value="PIX">PIX</option>
                            <option value="CREDIT_CARD">Crédito</option>
                            <option value="DEBIT_CARD">Débito</option>
                          </select>

                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Valor"
                            value={payment.amount}
                            disabled={isSaleAwaitingConfirmation}
                            onChange={(event) =>
                              handleDeliveryPaymentChange(
                                index,
                                "amount",
                                event.target.value,
                              )
                            }
                            className="w-28 rounded-md border border-gray-300 p-2 text-sm"
                          />
                        </div>

                        {payment.type === "TO_COLLECT" &&
                          (payment.method === "CREDIT_CARD" ||
                            payment.method === "DEBIT_CARD") && (
                            <p className="text-xs text-amber-700">
                              Motoboy precisa levar a maquininha.
                            </p>
                          )}
                      </div>
                    ))}

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total dos pagamentos</span>
                        <span>
                          {currency.format(deliveryTotalCents / 100)}
                        </span>
                      </div>

                      {deliveryTotalCents < totalCents && (
                        <p className="text-xs font-medium text-amber-700">
                          Faltam{" "}
                          {currency.format(
                            (totalCents - deliveryTotalCents) / 100,
                          )}{" "}
                          para completar o total.
                        </p>
                      )}

                      {deliveryNonCashCents > totalCents && (
                        <p className="text-xs font-medium text-red-700">
                          Antecipados e pagamentos sem dinheiro não podem
                          ultrapassar o total.
                        </p>
                      )}

                      {deliveryChangeCents > deliveryCashToCollectCents && (
                        <p className="text-xs font-medium text-red-700">
                          Dinheiro a receber insuficiente para o troco.
                        </p>
                      )}

                      {deliveryChangeCents > 0 &&
                        deliveryChangeCents <= deliveryCashToCollectCents && (
                          <div className="flex justify-between rounded-lg bg-green-50 p-3 font-bold text-green-700">
                            <span>Troco do motoboy</span>
                            <span>
                              {currency.format(deliveryChangeCents / 100)}
                            </span>
                          </div>
                        )}

                      {hasDuplicateDeliveryPayments && (
                        <p className="text-xs text-red-700">
                          Não repita a mesma forma na mesma situação.
                        </p>
                      )}

                      {deliveryPayments.length === 0 && (
                        <p className="text-xs text-amber-700">
                          Adicione pelo menos uma forma de pagamento.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {payments.map((payment, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <select
                          value={payment.paymentMethod}
                          disabled={isSaleAwaitingConfirmation}
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
                            handlePaymentChange(
                              index,
                              "amount",
                              event.target.value,
                            )
                          }
                          disabled={isSaleAwaitingConfirmation}
                          className="w-28 rounded-md border p-2"
                        />

                        {payments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePayment(index)}
                            disabled={isSaleAwaitingConfirmation}
                            className="text-red-600"
                            aria-label="Remover pagamento"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    ))}

                    {selectedCustomerId && (
                      <div>
                        <label
                          htmlFor="accountAmount"
                          className="mb-1 block text-sm font-medium text-gray-700"
                        >
                          Fiado (R$)
                        </label>

                        <input
                          id="accountAmount"
                          type="text"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={accountAmount}
                          onChange={(event) =>
                            setAccountAmount(
                              event.target.value.replace(/[^\d.,]/g, ""),
                            )
                          }
                          disabled={isSaleAwaitingConfirmation}
                          className="w-full rounded-md border p-2 disabled:bg-gray-100"
                        />
                      </div>
                    )}

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total informado:</span>
                        <span>{currency.format(paidTotal)}</span>
                      </div>

                      {selectedCustomerId && (
                        <div className="flex justify-between">
                          <span>Fiado:</span>
                          <span>
                            {currency.format((accountAmountCents ?? 0) / 100)}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between border-t pt-2 font-semibold">
                        <span>Total destinado:</span>
                        <span>
                          {currency.format(distributedTotalCents / 100)}
                        </span>
                      </div>

                      {remainingAmount > 0 && (
                        <div className="flex justify-between text-amber-700">
                          <span>Restante:</span>
                          <span>{currency.format(remainingAmount)}</span>
                        </div>
                      )}

                      {changeAmountCents > 0 && !hasInvalidChange && (
                        <div className="flex justify-between rounded-lg bg-green-50 p-3 font-bold text-green-700">
                          <span>Troco:</span>
                          <span>{currency.format(changeAmount)}</span>
                        </div>
                      )}

                      {hasInvalidChange && (
                        <p className="rounded-lg bg-red-50 p-3 text-red-700">
                          O troco de {currency.format(changeAmount)} precisa ser
                          coberto integralmente pelo pagamento em dinheiro. PIX
                          e cartões não podem gerar troco.
                        </p>
                      )}
                    </div>
                  </>
                )}
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
        <DeliveriesTab deliveries={deliveries} motoboys={motoboys} />
      )}
    </main>
  );
}
