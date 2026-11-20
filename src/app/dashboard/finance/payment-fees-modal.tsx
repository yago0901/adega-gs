"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PaymentMethod } from "@/generated/prisma/client";
import { savePaymentFeesAction } from "./actions";

const FEE_FIELDS: { method: PaymentMethod; label: string; hint: string }[] = [
  { method: "CASH", label: "Dinheiro", hint: "Normalmente 0%" },
  { method: "PIX", label: "PIX", hint: "Ex.: 0,99" },
  { method: "CREDIT_CARD", label: "Crédito", hint: "Ex.: 2,99" },
  { method: "DEBIT_CARD", label: "Débito", hint: "Ex.: 1,49" },
];

type PaymentFeesModalProps = {
  initialFees: Record<PaymentMethod, number>;
};

export function PaymentFeesModal({ initialFees }: PaymentFeesModalProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<PaymentMethod, string>>(() => ({
    CASH: formatInput(initialFees.CASH),
    PIX: formatInput(initialFees.PIX),
    CREDIT_CARD: formatInput(initialFees.CREDIT_CARD),
    DEBIT_CARD: formatInput(initialFees.DEBIT_CARD),
  }));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setError("");
      setValues({
        CASH: formatInput(initialFees.CASH),
        PIX: formatInput(initialFees.PIX),
        CREDIT_CARD: formatInput(initialFees.CREDIT_CARD),
        DEBIT_CARD: formatInput(initialFees.DEBIT_CARD),
      });
    }
  }

  function handleSave() {
    setError("");
    const formData = new FormData();

    for (const field of FEE_FIELDS) {
      formData.set(`fee_${field.method}`, values[field.method]);
    }

    startTransition(async () => {
      const result = await savePaymentFeesAction(formData);
      if (!result.success) {
        setError("Não foi possível salvar as taxas.");
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => handleOpenChange(true)}
      >
        Taxas da maquininha
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Taxas da maquininha</DialogTitle>
            <DialogDescription>
              Informe o percentual cobrado por cada forma. O financeiro usa
              esses valores para estimar o líquido do dia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {FEE_FIELDS.map((field) => (
              <label key={field.method} className="block text-sm font-medium">
                {field.label} (%)
                <input
                  inputMode="decimal"
                  value={values[field.method]}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [field.method]: event.target.value.replace(/[^\d.,]/g, ""),
                    }))
                  }
                  placeholder={field.hint}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </label>
            ))}

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? "Salvando..." : "Salvar taxas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatInput(value: number): string {
  if (!value) return "0";
  return String(value).replace(".", ",");
}
