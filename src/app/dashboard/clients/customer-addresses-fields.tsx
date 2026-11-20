"use client";

import { useMemo, useState } from "react";
import { fetchAddressByCep, formatCep } from "@/lib/via-cep";

export type CustomerAddressFormValue = {
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  reference: string;
  deliveryFee: string;
  isDefault: boolean;
};

const emptyAddress = (): CustomerAddressFormValue => ({
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  reference: "",
  deliveryFee: "0",
  isDefault: false,
});

type CustomerAddressesFieldsProps = {
  initialAddresses?: CustomerAddressFormValue[];
  variant?: "card" | "embedded" | "flat";
};

export function CustomerAddressesFields({
  initialAddresses,
  variant = "card",
}: CustomerAddressesFieldsProps) {
  const [addresses, setAddresses] = useState<CustomerAddressFormValue[]>(() => {
    if (initialAddresses && initialAddresses.length > 0) {
      return initialAddresses;
    }

    return [{ ...emptyAddress(), isDefault: true }];
  });

  const addressesJson = useMemo(
    () => JSON.stringify(addresses),
    [addresses],
  );

  function updateAddress(
    index: number,
    patch: Partial<CustomerAddressFormValue>,
  ) {
    setAddresses((current) =>
      current.map((address, i) =>
        i === index ? { ...address, ...patch } : address,
      ),
    );
  }

  function setDefault(index: number) {
    setAddresses((current) =>
      current.map((address, i) => ({
        ...address,
        isDefault: i === index,
      })),
    );
  }

  function addAddress() {
    setAddresses((current) => [
      ...current,
      { ...emptyAddress(), isDefault: current.length === 0 },
    ]);
  }

  function handleZipCodeInput(index: number, rawValue: string) {
    updateAddress(index, { zipCode: formatCep(rawValue) });
  }

  async function handleZipCodeBlur(index: number, rawValue: string) {
    const formatted = formatCep(rawValue);
    if (formatted.replace(/\D/g, "").length !== 8) {
      return;
    }

    const address = await fetchAddressByCep(formatted);
    if (!address) {
      return;
    }

    setAddresses((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              zipCode: address.zipCode,
              street: address.street || item.street,
              neighborhood: address.neighborhood || item.neighborhood,
              city: address.city || item.city,
              state: address.state || item.state,
            }
          : item,
      ),
    );
  }

  function removeAddress(index: number) {
    setAddresses((current) => {
      if (current.length <= 1) {
        return current;
      }

      const next = current.filter((_, i) => i !== index);

      if (!next.some((address) => address.isDefault)) {
        next[0] = { ...next[0], isDefault: true };
      }

      return next;
    });
  }

  const sectionClassName =
    variant === "card"
      ? "rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      : variant === "flat"
        ? ""
        : "border-t border-slate-100 pt-6";

  const addressBlockClassName =
    variant === "flat"
      ? "border-b border-slate-100 pb-6 last:border-b-0 last:pb-0"
      : "rounded-xl border border-slate-200 bg-slate-50 p-4";

  const headingClassName = variant === "flat" ? "text-sm font-semibold" : "font-bold";

  return (
    <section className={sectionClassName}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={headingClassName}>Endereços</h2>
          <p className="mt-1 text-sm text-slate-500">
            Cadastre pelo menos um endereço com a taxa de entrega.
          </p>
        </div>

        <button
          type="button"
          onClick={addAddress}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          + Adicionar endereço
        </button>
      </div>

      <input type="hidden" name="addressesJson" value={addressesJson} />

      <div className="space-y-6">
        {addresses.map((address, index) => (
          <div key={index} className={addressBlockClassName}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-slate-800">
                  Endereço {index + 1}
                </p>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="defaultAddress"
                    checked={address.isDefault}
                    onChange={() => setDefault(index)}
                    className="h-4 w-4 border-slate-300 text-emerald-600"
                  />
                  Padrão
                </label>
              </div>

              {addresses.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAddress(index)}
                  className="text-sm font-medium text-red-600 hover:underline"
                >
                  Remover
                </button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                CEP *
                <input
                  value={address.zipCode}
                  onChange={(event) =>
                    handleZipCodeInput(index, event.target.value)
                  }
                  onBlur={(event) =>
                    void handleZipCodeBlur(index, event.target.value)
                  }
                  required
                  maxLength={9}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                  placeholder="00000-000"
                />
              </label>

              <label className="text-sm font-medium">
                Estado (UF) *
                <input
                  value={address.state}
                  onChange={(event) =>
                    updateAddress(index, {
                      state: event.target.value.toUpperCase(),
                    })
                  }
                  required
                  minLength={2}
                  maxLength={2}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 uppercase"
                  placeholder="SP"
                />
              </label>

              <label className="text-sm font-medium sm:col-span-2">
                Rua / Avenida *
                <input
                  value={address.street}
                  onChange={(event) =>
                    updateAddress(index, { street: event.target.value })
                  }
                  required
                  maxLength={150}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                />
              </label>

              <label className="text-sm font-medium">
                Número *
                <input
                  value={address.number}
                  onChange={(event) =>
                    updateAddress(index, { number: event.target.value })
                  }
                  required
                  maxLength={20}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                />
              </label>

              <label className="text-sm font-medium">
                Complemento
                <input
                  value={address.complement}
                  onChange={(event) =>
                    updateAddress(index, { complement: event.target.value })
                  }
                  maxLength={100}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                />
              </label>

              <label className="text-sm font-medium">
                Bairro *
                <input
                  value={address.neighborhood}
                  onChange={(event) =>
                    updateAddress(index, {
                      neighborhood: event.target.value,
                    })
                  }
                  required
                  maxLength={100}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                />
              </label>

              <label className="text-sm font-medium">
                Cidade *
                <input
                  value={address.city}
                  onChange={(event) =>
                    updateAddress(index, { city: event.target.value })
                  }
                  required
                  maxLength={100}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                />
              </label>

              <label className="text-sm font-medium">
                Taxa de entrega (R$) *
                <input
                  value={address.deliveryFee}
                  onChange={(event) =>
                    updateAddress(index, {
                      deliveryFee: event.target.value.replace(/[^\d.,]/g, ""),
                    })
                  }
                  required
                  inputMode="decimal"
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                  placeholder="0,00"
                />
              </label>

              <label className="text-sm font-medium sm:col-span-2">
                Ponto de referência
                <input
                  value={address.reference}
                  onChange={(event) =>
                    updateAddress(index, { reference: event.target.value })
                  }
                  maxLength={200}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                  placeholder="Próximo a..."
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
