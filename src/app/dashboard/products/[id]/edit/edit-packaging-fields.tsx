
"use client";

import { useState } from "react";

type ProductOption = {
  id: string;
  name: string;
};

type Props = {
  isSelfPackaging: boolean;
  products: ProductOption[];
  initialParentProductId: string;
  initialParentQuantity: string;
  initialChildProductId: string;
  initialChildQuantity: string;
};

export function EditPackagingFields({
  isSelfPackaging,
  products,
  initialParentProductId,
  initialParentQuantity,
  initialChildProductId,
  initialChildQuantity,
}: Props) {
  const [parentProductId, setParentProductId] = useState(
    initialParentProductId,
  );
  const [parentQuantity, setParentQuantity] = useState(
    initialParentQuantity,
  );

  const [childProductId, setChildProductId] = useState(
    initialChildProductId,
  );
  const [childQuantity, setChildQuantity] = useState(
    initialChildQuantity,
  );

  const packagingMode = isSelfPackaging
    ? "SELF"
    : parentProductId || childProductId
      ? "CHILD"
      : "NONE";

  if (isSelfPackaging) {
    return (
      <>
        <input type="hidden" name="packagingMode" value="SELF" />

        <div className="mt-4 rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold">
            Configuração de embalagem
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Este produto possui embalagem própria (SELF). A estrutura
            dessa embalagem permanece protegida nesta edição.
          </p>
        </div>
      </>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 p-4">
      <input type="hidden" name="packagingMode" value={packagingMode} />

      <p className="text-sm font-semibold">
        Configuração de embalagem
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium">
            Produto de origem
          </label>

          <select
            name="packagingParentProductId"
            value={parentProductId}
            onChange={(event) => {
              setParentProductId(event.target.value);

              if (!event.target.value) {
                setParentQuantity("");
              }
            }}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
          >
            <option value="">Nenhum produto de origem</option>

            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          {parentProductId && (
            <label className="mt-3 block text-sm font-medium">
              Quantidade gerada pelo produto de origem
              <input
                name="packagingParentQuantity"
                type="number"
                min="0.001"
                step="0.001"
                required
                value={parentQuantity}
                onChange={(event) => setParentQuantity(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 p-3"
              />
            </label>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4">
          <label className="text-sm font-medium">
            Produto gerado ao abrir este produto
          </label>

          <select
            name="packagingChildProductId"
            value={childProductId}
            onChange={(event) => {
              setChildProductId(event.target.value);

              if (!event.target.value) {
                setChildQuantity("");
              }
            }}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
          >
            <option value="">Não gera outro produto</option>

            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          {childProductId && (
            <label className="mt-3 block text-sm font-medium">
              Quantidade gerada
              <input
                name="packagingChildQuantity"
                type="number"
                min="0.001"
                step="0.001"
                required
                value={childQuantity}
                onChange={(event) => setChildQuantity(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 p-3"
              />
            </label>
          )}
        </div>

        <p className="text-xs text-slate-500">
          Um produto pode ter uma origem e gerar outro produto,
          formando uma cadeia de conversão sem ramificações.
        </p>
      </div>
    </div>
  );
}
