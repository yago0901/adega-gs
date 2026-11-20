"use server";

import { revalidatePath } from "next/cache";
import type { PaymentMethod } from "@/generated/prisma/client";
import { requireModuleAccess } from "@/lib/permissions";
import {
  FEE_PAYMENT_METHODS,
  getPaymentFeeMap,
  savePaymentFeeMap,
} from "@/modules/finance/fees";

function parsePercent(value: FormDataEntryValue | null): number {
  if (value == null) return 0;

  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return 0;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;

  return Math.max(0, Math.min(100, parsed));
}

export async function getPaymentFeesAction() {
  await requireModuleAccess("FINANCE");
  return getPaymentFeeMap();
}

export async function savePaymentFeesAction(formData: FormData) {
  await requireModuleAccess("FINANCE");

  const fees: Partial<Record<PaymentMethod, number>> = {};

  for (const method of FEE_PAYMENT_METHODS) {
    fees[method] = parsePercent(formData.get(`fee_${method}`));
  }

  const saved = await savePaymentFeeMap(fees);
  revalidatePath("/dashboard/finance");

  return { success: true as const, fees: saved };
}
