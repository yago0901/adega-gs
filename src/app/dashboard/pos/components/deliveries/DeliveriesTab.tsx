
"use client";

import { useState } from "react";
import { DeliveryDetailsModal } from "./DeliveryDetailsModal";
import { useRouter } from "next/navigation";
import { dispatchDelivery } from "@/app/dashboard/pos/actions";

export type DeliveryOrder = {
  id: string;
  status: "PENDING" | "OUT_FOR_DELIVERY";
  fee: string;
  predictedCashReceived: string;
  predictedChangeAmount: string;
  payments: {
    id: string;
    type: "PREPAID" | "TO_COLLECT";
    method: "CASH" | "PIX" | "CREDIT_CARD" | "DEBIT_CARD";
    amount: string;
  }[];
  createdAt: string;
  dispatchedAt: string | null;
  motoboy: {
    id: string;
    name: string;
    phone: string;
  } | null;
  sale: {
    id: string;
    total: string;
    deliveryFee: string;
    customer: {
      name: string;
      phone: string;
    } | null;
    deliveryZipCode: string | null;
    deliveryStreet: string | null;
    deliveryNumber: string | null;
    deliveryComplement: string | null;
    deliveryNeighborhood: string | null;
    deliveryCity: string | null;
    deliveryState: string | null;
    deliveryReference: string | null;
    items: {
      id: string;
      productName: string;
      productCode: string;
      unit: string;
      quantity: string;
      unitPrice: string;
      total: string;
    }[];
  };
};

type Motoboy = {
  id: string;
  name: string;
  phone: string;
};

type DeliveriesTabProps = {
  deliveries: DeliveryOrder[];
  motoboys: Motoboy[];
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function parseMoney(value: string) {
  return Number(value.replace(",", "."));
}

export function DeliveriesTab({
  deliveries,
  motoboys,
}: DeliveriesTabProps) {
  const [selectedDelivery, setSelectedDelivery] =
    useState<DeliveryOrder | null>(null);
  const router = useRouter();
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  const [selectedMotoboys, setSelectedMotoboys] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      deliveries.map((delivery) => [
        delivery.id,
        delivery.motoboy?.id ?? "",
      ]),
    ),
  );

  const [deliveryFees, setDeliveryFees] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      deliveries.map((delivery) => [
        delivery.id,
        delivery.fee || delivery.sale.deliveryFee || "0",
      ]),
    ),
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleDispatch(delivery: DeliveryOrder) {
    const motoboyId = selectedMotoboys[delivery.id];
    const fee = deliveryFees[delivery.id];

    if (!motoboyId) {
      setErrors((prev) => ({
        ...prev,
        [delivery.id]: "Selecione um motoboy.",
      }));
      return;
    }

    if (fee === undefined || fee.trim() === "") {
      setErrors((prev) => ({
        ...prev,
        [delivery.id]: "Informe a taxa de entrega.",
      }));
      return;
    }

    setDispatchingId(delivery.id);
    setErrors((prev) => ({ ...prev, [delivery.id]: "" }));

    try {
      const result = await dispatchDelivery(
        delivery.id,
        motoboyId,
        fee,
      );

      if (!result.success) {
        setErrors((prev) => ({
          ...prev,
          [delivery.id]: result.error,
        }));
        return;
      }

      router.refresh();
    } catch {
      setErrors((prev) => ({
        ...prev,
        [delivery.id]: "Erro de comunicação ao despachar. Atualize a página.",
      }));
    } finally {
      setDispatchingId(null);
    }

  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Pedidos de entrega
          </h2>
          <p className="text-sm text-gray-500">
            A taxa já vem do endereço da venda e pode ser ajustada antes de
            despachar o motoboy.
          </p>
        </div>

        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
          {deliveries.length}{" "}
          {deliveries.length === 1 ? "pedido" : "pedidos"}
        </span>
      </div>

      {deliveries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="font-semibold text-gray-800">
            Nenhuma entrega pendente
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Quando uma venda para entrega for registrada, ela aparecerá aqui.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Motoboy</th>
                <th className="px-4 py-3">Taxa de entrega</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {deliveries.map((delivery) => {
                const isPending = delivery.status === "PENDING";
                const selectedMotoboy =
                  selectedMotoboys[delivery.id] ?? "";
                const feeValue = deliveryFees[delivery.id] ?? "";

                return (
                  <tr key={delivery.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-4">
                      <p className="font-semibold text-gray-900">
                        #{delivery.sale.id.slice(-6).toUpperCase()}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(delivery.createdAt).toLocaleString(
                          "pt-BR",
                        )}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900">
                        {delivery.sale.customer?.name ??
                          "Cliente não informado"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {delivery.sale.customer?.phone ?? "—"}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <p className="font-semibold text-gray-900">
                        {currency.format(Number(delivery.sale.total))}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedDelivery(delivery)}
                        className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        Ver detalhes
                      </button>
                    </td>

                    <td className="px-4 py-4">
                      {isPending ? (
                        <select
                          value={selectedMotoboy}
                          onChange={(event) => {
                            setSelectedMotoboys((current) => ({
                              ...current,
                              [delivery.id]: event.target.value,
                            }));
                            setErrors((current) => ({
                              ...current,
                              [delivery.id]: "",
                            }));
                          }}
                          className="w-44 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Selecionar motoboy</option>
                          {motoboys.map((motoboy) => (
                            <option
                              key={motoboy.id}
                              value={motoboy.id}
                            >
                              {motoboy.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div>
                          <p className="font-medium text-gray-800">
                            {delivery.motoboy?.name ?? "Não informado"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {delivery.motoboy?.phone ?? ""}
                          </p>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {isPending ? (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">R$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={feeValue}
                            onChange={(event) => {
                              setDeliveryFees((current) => ({
                                ...current,
                                [delivery.id]: event.target.value,
                              }));
                              setErrors((current) => ({
                                ...current,
                                [delivery.id]: "",
                              }));
                            }}
                            placeholder="0,00"
                            className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </div>
                      ) : (
                        <p className="font-medium text-gray-800">
                          {currency.format(Number(delivery.fee))}
                        </p>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      {isPending ? (
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                          Pendente
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                          Em entrega
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex min-w-[190px] flex-row flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedDelivery(delivery)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          Detalhes
                        </button>

                        {isPending ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDispatch(delivery)}
                              disabled={dispatchingId === delivery.id}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {dispatchingId === delivery.id ? "Despachando..." : "Despachar"}
                            </button>

                            <button
                              type="button"
                              disabled
                              title="Cancelamento será implementado na próxima etapa"
                              className="cursor-not-allowed text-xs font-medium text-red-400 opacity-60"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled
                              title="Conclusão será implementada na próxima etapa"
                              className="cursor-not-allowed rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white opacity-50"
                            >
                              Concluir
                            </button>

                            <button
                              type="button"
                              disabled
                              title="Cancelamento será implementado na próxima etapa"
                              className="cursor-not-allowed text-xs font-medium text-red-400 opacity-60"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                      </div>

                      {errors[delivery.id] && (
                        <p
                          className={`mt-2 max-w-[190px] text-xs ${errors[delivery.id].startsWith("Campos válidos")
                            ? "text-amber-700"
                            : "text-red-600"
                            }`}
                        >
                          {errors[delivery.id]}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedDelivery && (
        <DeliveryDetailsModal
          delivery={selectedDelivery}
          onClose={() => setSelectedDelivery(null)}
        />
      )}
    </section>
  );
}
