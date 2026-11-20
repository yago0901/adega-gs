"use client";

import { useMemo, useState } from "react";

export type StockMutationProductOption = {
  id: string;
  name: string;
  optionLabel: string;
  canChooseBalanceTarget: boolean;
  packagingName: string | null;
  unitLabel: string;
};

type StockMutationFormFieldsProps = {
  products: StockMutationProductOption[];
  quantityLabel: string;
  quantityMin?: number;
  quantityStep?: string;
  reasonPlaceholder: string;
};

export function StockMutationFormFields({
  products,
  quantityLabel,
  quantityMin = 1,
  quantityStep = "1",
  reasonPlaceholder,
}: StockMutationFormFieldsProps) {
  const [productId, setProductId] = useState("");

  const selected = useMemo(
    () => products.find((product) => product.id === productId),
    [productId, products],
  );

  return (
    <>
      <label className="block text-sm font-medium">
        Produto
        <select
          name="productId"
          required
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
        >
          <option value="" disabled>
            Selecione
          </option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
              {product.optionLabel}
            </option>
          ))}
        </select>
      </label>

      {selected?.canChooseBalanceTarget && (
        <label className="block text-sm font-medium">
          Saldo alvo
          <select
            name="stockTarget"
            defaultValue="PACKAGING"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
          >
            <option value="PACKAGING">
              Embalagem fechada
              {selected.packagingName ? ` (${selected.packagingName})` : ""}
            </option>
            <option value="OPEN">
              Produto aberto ({selected.unitLabel})
            </option>
          </select>
        </label>
      )}

      <label className="block text-sm font-medium">
        {quantityLabel}
        <input
          name="quantity"
          type="number"
          min={quantityMin}
          step={quantityStep}
          required
          className="mt-2 w-full rounded-lg border border-slate-300 p-3"
        />
      </label>

      <label className="block text-sm font-medium">
        Justificativa
        <input
          name="reason"
          required
          minLength={3}
          placeholder={reasonPlaceholder}
          className="mt-2 w-full rounded-lg border border-slate-300 p-3"
        />
      </label>
    </>
  );
}