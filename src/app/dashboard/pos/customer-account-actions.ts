"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAccess } from "@/lib/permissions";
import {
  getCustomerOpenDebtsRecord,
  receiveCustomerDebtPaymentRecord,
} from "@/modules/pos/customer-account.service";
import type { SalePaymentRequest } from "@/modules/pos/types";

export async function getCustomerOpenDebts(customerId: string) {
  await requireModuleAccess("POS");
  return getCustomerOpenDebtsRecord(customerId);
}

export async function receiveCustomerDebtPayment(
  customerId: string,
  amountToApplyInput: string,
  payments: SalePaymentRequest[],
) {
  const session = await requireModuleAccess("POS");
  const result = await receiveCustomerDebtPaymentRecord(
    session.user.id,
    customerId,
    amountToApplyInput,
    payments,
  );

  if (result.success) {
    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/history");
    revalidatePath("/dashboard/fiados");
  }

  return result;
}
