"use client";

import { useEffect, useRef } from "react";

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

type Props = {
  openings: Opening[];
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function OpeningConfirmationModal({
  openings,
  isPending,
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (openings.length > 0 && dialog && !dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, [openings]);

  if (openings.length === 0) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="opening-modal-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!isPending) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl backdrop:bg-black/70"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <span className="text-xl">!</span>
        </div>

        <h2
          id="opening-modal-title"
          className="text-lg font-bold text-gray-900"
        >
          Confirmar abertura de estoque
        </h2>
      </div>

      <p className="mt-4 text-sm text-gray-600">
        O estoque aberto não é suficiente para esta venda.
        Para continuar, será necessário abrir:
      </p>

      <div className="mt-4 max-h-60 space-y-3 overflow-y-auto">
        {openings.map((opening) => (
          <div
            key={
              opening.kind === "BOTTLE"
                ? `BOTTLE-${opening.stockPackagingId}`
                : `COMMERCIAL-${opening.productId}`
            }
            className="rounded-lg border border-gray-200 bg-gray-50 p-3"
          >
            {opening.kind === "BOTTLE" ? (
              <>
                <p className="font-semibold text-gray-900">
                  {opening.stockItemName}
                </p>

                <p className="mt-1 text-sm text-gray-600">
                  {opening.quantity}x {opening.packagingName}
                </p>

                <p className="text-sm text-gray-600">
                  Entrada de {opening.volume} ml no estoque aberto
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-gray-900">
                  {opening.parentProductName}
                </p>

                <p className="mt-1 text-sm text-gray-600">
                  {opening.quantity}x para gerar {opening.childProductName}
                </p>

                <p className="text-sm text-gray-600">
                  Entrada de {opening.generatedQuantity} unidades de{" "}
                  {opening.childProductName}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className="flex-1 rounded-lg bg-amber-600 px-4 py-3 font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Processando..." : "Confirmar abertura e venda"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </dialog>
  );
}