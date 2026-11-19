
import type { DeliveryOrder } from "./DeliveriesTab";

type DeliveryDetailsModalProps = {
  delivery: DeliveryOrder;
  onClose: () => void;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const paymentMethodLabels: Record<
  DeliveryOrder["payments"][number]["method"],
  string
> = {
  CASH: "Dinheiro",
  PIX: "PIX",
  CREDIT_CARD: "Crédito",
  DEBIT_CARD: "Débito",
};

export function DeliveryDetailsModal({
  delivery,
  onClose,
}: DeliveryDetailsModalProps) {
  const needsCardMachine = delivery.payments.some(
    (payment) =>
      payment.type === "TO_COLLECT" &&
      (payment.method === "CREDIT_CARD" ||
        payment.method === "DEBIT_CARD"),
  );

  const address = [
    delivery.sale.deliveryStreet,
    delivery.sale.deliveryNumber,
  ]
    .filter(Boolean)
    .join(", ");

  const location = [
    delivery.sale.deliveryNeighborhood,
    delivery.sale.deliveryCity,
    delivery.sale.deliveryState,
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Entrega #{delivery.sale.id.slice(-6).toUpperCase()}
            </h2>
            <p className="text-sm text-gray-500">
              {new Date(delivery.createdAt).toLocaleString("pt-BR")}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100"
          >
            Fechar
          </button>
        </div>

        <div className="space-y-6 p-6">
          <section>
            <h3 className="mb-3 font-semibold text-gray-900">
              Cliente
            </h3>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="font-medium text-gray-900">
                {delivery.sale.customer?.name ?? "Cliente não informado"}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {delivery.sale.customer?.phone ?? "Telefone não informado"}
              </p>
            </div>
          </section>

          <section>
            <h3 className="mb-3 font-semibold text-gray-900">
              Endereço de entrega
            </h3>

            <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
              <p>{address || "Endereço não informado"}</p>

              {delivery.sale.deliveryComplement && (
                <p className="mt-1">
                  Complemento: {delivery.sale.deliveryComplement}
                </p>
              )}

              {location && <p className="mt-1">{location}</p>}

              {delivery.sale.deliveryZipCode && (
                <p className="mt-1">
                  CEP: {delivery.sale.deliveryZipCode}
                </p>
              )}

              {delivery.sale.deliveryReference && (
                <p className="mt-2">
                  Referência: {delivery.sale.deliveryReference}
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-3 font-semibold text-gray-900">
              Produtos
            </h3>

            <div className="overflow-hidden rounded-xl border border-gray-200">
              {delivery.sale.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 border-b border-gray-100 p-3 last:border-b-0"
                >
                  <div>
                    <p className="font-medium text-gray-800">
                      {Number(item.quantity)}x {item.productName}
                    </p>
                    <p className="text-xs text-gray-500">
                      Código: {item.productCode}
                    </p>
                    <p className="text-xs text-gray-500">
                      Unitário: {currency.format(Number(item.unitPrice))}
                    </p>
                  </div>

                  <p className="whitespace-nowrap font-semibold text-gray-900">
                    {currency.format(Number(item.total))}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex justify-between text-sm">
              <span className="text-gray-500">Subtotal dos produtos</span>
              <span className="font-semibold text-gray-900">
                {currency.format(
                  Number(delivery.sale.total) -
                    Number(delivery.sale.deliveryFee),
                )}
              </span>
            </div>

            <div className="mt-1 flex justify-between text-sm">
              <span className="text-gray-500">Taxa de entrega</span>
              <span className="font-semibold text-gray-900">
                {currency.format(Number(delivery.sale.deliveryFee))}
              </span>
            </div>

            <div className="mt-1 flex justify-between text-sm font-semibold">
              <span className="text-gray-700">Total</span>
              <span className="text-gray-900">
                {currency.format(Number(delivery.sale.total))}
              </span>
            </div>
          </section>

          <section>
            <h3 className="mb-3 font-semibold text-gray-900">
              Pagamentos
            </h3>

            <div className="space-y-2">
              {delivery.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3"
                >
                  <div>
                    <p className="font-medium text-gray-800">
                      {paymentMethodLabels[payment.method]}
                    </p>
                    <p className="text-xs text-gray-500">
                      {payment.type === "PREPAID"
                        ? "Pago antecipadamente"
                        : "A receber na entrega"}
                    </p>
                  </div>

                  <p className="font-semibold text-gray-900">
                    {currency.format(Number(payment.amount))}
                  </p>
                </div>
              ))}

              {delivery.payments.length === 0 && (
                <p className="text-sm text-gray-500">
                  Nenhum pagamento informado.
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-3 font-semibold text-gray-900">
              Informações para o motoboy
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs text-gray-500">
                  Dinheiro bruto a receber
                </p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {currency.format(
                    Number(delivery.predictedCashReceived),
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs text-gray-500">
                  Troco previsto
                </p>
                <p className="mt-1 text-lg font-bold text-emerald-700">
                  {currency.format(
                    Number(delivery.predictedChangeAmount),
                  )}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-800">
                {needsCardMachine
                  ? "Levar maquininha"
                  : "Não precisa levar maquininha"}
              </p>
              {delivery.motoboy && (
                <p className="mt-1 text-sm text-gray-500">
                  Motoboy: {delivery.motoboy.name} —{" "}
                  {delivery.motoboy.phone}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
