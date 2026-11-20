import "server-only";

import type { PaymentMethod } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const FEE_PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "PIX",
  "CREDIT_CARD",
  "DEBIT_CARD",
];

export type PaymentFeeMap = Record<PaymentMethod, number>;

const DEFAULT_FEES: PaymentFeeMap = {
  CASH: 0,
  PIX: 0,
  CREDIT_CARD: 0,
  DEBIT_CARD: 0,
};

export async function getPaymentFeeMap(): Promise<PaymentFeeMap> {
  const rows = await prisma.paymentMethodFee.findMany();

  const map: PaymentFeeMap = { ...DEFAULT_FEES };

  for (const row of rows) {
    map[row.method] = Number(row.percentFee);
  }

  return map;
}

export async function savePaymentFeeMap(
  fees: Partial<Record<PaymentMethod, number>>,
): Promise<PaymentFeeMap> {
  for (const method of FEE_PAYMENT_METHODS) {
    const raw = fees[method];
    const percentFee =
      raw == null || Number.isNaN(raw) ? 0 : Math.max(0, Math.min(100, raw));

    await prisma.paymentMethodFee.upsert({
      where: { method },
      create: { method, percentFee },
      update: { percentFee },
    });
  }

  return getPaymentFeeMap();
}

export function calcFeeAmount(gross: number, percentFee: number): number {
  if (gross <= 0 || percentFee <= 0) return 0;
  return Math.round(gross * percentFee * 100) / 10000;
}

export function calcNetAmount(gross: number, percentFee: number): number {
  return Math.round((gross - calcFeeAmount(gross, percentFee)) * 100) / 100;
}
