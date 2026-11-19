"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAccess, requireCashRegisterManagement } from "@/lib/permissions";
import {
  closeCashRegisterRecord,
  openCashRegisterRecord,
  registerCashSupplyRecord,
  registerCashWithdrawalRecord,
} from "@/modules/pos/cash-register.service";
import { dispatchDeliveryRecord } from "@/modules/pos/delivery.service";
import { cancelSaleRecord, finalizeSaleRecord } from "@/modules/pos/sale.service";
import type {
  Opening,
  SalePaymentRequest,
  SaleRequestItem,
  SaleResult,
} from "@/modules/pos/types";
import type { DeliveryPaymentRequest } from "@/modules/pos/types";

export type { SaleResult } from "@/modules/pos/types";

export async function openCashRegister(openingAmount: string) {
    const session = await requireCashRegisterManagement();
  const result = await openCashRegisterRecord(openingAmount, session.user.id);
  if (result.success) {
    revalidatePath("/dashboard/pos");
  }
  return result;
}

export async function closeCashRegister(countedAmount: string) {
    const session = await requireCashRegisterManagement();
  const result = await closeCashRegisterRecord(countedAmount, session.user.id);
  if (result.success) {
    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/history");
  }
  return result;
}

export async function finalizeSale(
  items: SaleRequestItem[],
  payments: SalePaymentRequest[],
  confirmOpenings = false,
  confirmedOpenings: Opening[] = [],
  customerId: string | null = null,
  accountAmount = "0",
  isDelivery = false,
  deliveryAddress: {
    zipCode: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    reference: string;
    deliveryFee: string;
  } | null = null,
  deliveryPayments: DeliveryPaymentRequest[] = [],
): Promise<SaleResult> {
    const session = await requireModuleAccess("POS");
  const result = await finalizeSaleRecord(
    session.user.id,
    items,
    payments,
    confirmOpenings,
    confirmedOpenings,
    customerId,
    accountAmount,
    isDelivery,
    deliveryAddress,
    deliveryPayments,
  );

  if (
    result.success &&
    !("confirmationRequired" in result && result.confirmationRequired)
  ) {
    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/stock");
    revalidatePath("/dashboard/stock/movements");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/history");
  }

  return result;
}

export async function cancelSale(saleId: string) {
    const session = await requireModuleAccess("POS");
  const result = await cancelSaleRecord(session.user.id, saleId);
  if (result.success) {
    revalidatePath("/dashboard/history");
    revalidatePath("/dashboard/stock");
    revalidatePath("/dashboard/stock/movements");
    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function registerCashSupply(amountInput: string, description?: string) {
    const session = await requireCashRegisterManagement();
  const result = await registerCashSupplyRecord(amountInput, session.user.id, description);
  if (result.success) {
    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/history");
  }
  return result;
}

export async function registerCashWithdrawal(amountInput: string, description?: string) {
    const session = await requireCashRegisterManagement();
  const result = await registerCashWithdrawalRecord(amountInput, session.user.id, description);
  if (result.success) {
    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/history");
  }
  return result;
}

export async function dispatchDelivery(
  deliveryId: string,
  motoboyId: string,
  feeInput: string,
) {
  const session = await requireModuleAccess("POS");
  const result = await dispatchDeliveryRecord(
    session.user.id,
    deliveryId,
    motoboyId,
    feeInput,
  );
  if (result.success) {
    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/history");
  }
  return result;
}
