"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCustomerForEditAction, saveCustomer } from "./actions";
import {
  CustomerAddressesFields,
  type CustomerAddressFormValue,
} from "./customer-addresses-fields";

type CustomerFormModalProps = {
  open: boolean;
  customerId: string | null;
  onOpenChange: (open: boolean) => void;
};

export function CustomerFormModal({
  open,
  customerId,
  onOpenChange,
}: CustomerFormModalProps) {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [initialAddresses, setInitialAddresses] = useState<
    CustomerAddressFormValue[] | undefined
  >(undefined);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!customerId) {
      setName("");
      setPhone("");
      setNotes("");
      setInitialAddresses(undefined);
      setError("");
      setFormKey((current) => current + 1);
      return;
    }

    let cancelled = false;

    async function loadCustomer() {
      setIsLoading(true);
      setError("");

      const result = await getCustomerForEditAction(customerId!);

      if (cancelled) {
        return;
      }

      if ("error" in result && result.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      setName(result.customer.name);
      setPhone(result.customer.phone);
      setNotes(result.customer.notes);
      setInitialAddresses(result.customer.addresses);
      setFormKey((current) => current + 1);
      setIsLoading(false);
    }

    void loadCustomer();

    return () => {
      cancelled = true;
    };
  }, [open, customerId]);

  function handleSubmit() {
    if (!formRef.current) {
      return;
    }

    startSaveTransition(async () => {
      setError("");
      const formData = new FormData(formRef.current!);
      formData.set("name", name.trim());
      formData.set("phone", phone.trim());
      formData.set("notes", notes.trim());

      const result = await saveCustomer(formData, customerId ?? undefined);

      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {customerId ? "Editar cliente" : "Novo cliente"}
          </DialogTitle>
          <DialogDescription>
            {customerId
              ? "Atualize os dados cadastrais e endereços."
              : "Cadastre dados pessoais e pelo menos um endereço com taxa de entrega."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Carregando cliente...
          </p>
        ) : (
          <form
            ref={formRef}
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmit();
            }}
          >
            <label className="block text-sm font-medium">
              Nome completo *
              <input
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={120}
                className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                placeholder="Nome do cliente"
              />
            </label>

            <label className="block text-sm font-medium">
              Telefone com DDD *
              <input
                name="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
                minLength={10}
                maxLength={20}
                className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                placeholder="(11) 99999-9999"
              />
            </label>

            <label className="block text-sm font-medium">
              Observações
              <textarea
                name="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                maxLength={1000}
                className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                placeholder="Informações adicionais sobre o cliente..."
              />
            </label>

            <CustomerAddressesFields
              key={formKey}
              variant="flat"
              initialAddresses={initialAddresses}
            />

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </form>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={
              isSaving ||
              isLoading ||
              name.trim().length < 2 ||
              phone.trim().length < 10
            }
            onClick={handleSubmit}
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}