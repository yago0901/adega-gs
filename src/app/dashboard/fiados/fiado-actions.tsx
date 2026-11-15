
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReceiveDebtModal from "../pos/ReceiveDebtModal";

type Customer = {
  id: string;
  name: string;
  phone: string;
};

export function FiadoActions({
  customer,
  showDetailsLink = true,
}: {
  customer: Customer;
  showDetailsLink?: boolean;
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState("");

  const currency = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showDetailsLink && (
        <a
          href={`/dashboard/fiados/${customer.id}`}
          className="font-medium text-emerald-700 hover:underline"
        >
          Ver detalhes
        </a>
      )}

      <button
        type="button"
        onClick={() => {
          setMessage("");
          setShowModal(true);
        }}
        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
      >
        Pagar
      </button>

      {message && (
        <p className="w-full text-xs text-emerald-700">
          {message}
        </p>
      )}

      {showModal && (
        <ReceiveDebtModal
          customers={[customer]}
          initialCustomerId={customer.id}
          onClose={() => setShowModal(false)}
          onSuccess={(result) => {
            setShowModal(false);

            setMessage(
              `Recebimento de ${currency.format(Number(result.amountPaid))} registrado com sucesso!${
                Number(result.changeAmount) > 0
                  ? ` Troco: ${currency.format(Number(result.changeAmount))}`
                  : ""
              }`,
            );

            router.refresh();
          }}
        />
      )}
    </div>
  );
}
