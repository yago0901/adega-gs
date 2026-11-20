"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAccess } from "@/lib/permissions";
import { allocateCustomerAvailableCreditsRecord } from "@/modules/fiados/service";

export async function allocateCustomerCredits(
  customerId: string,
  creditMovementId?: string,
) {
  await requireModuleAccess("FIADOS");

  const result = await allocateCustomerAvailableCreditsRecord(
    customerId,
    creditMovementId,
  );

  if (result.success) {
    revalidatePath("/dashboard/fiados");
    revalidatePath(`/dashboard/fiados/${customerId}`);
    revalidatePath("/dashboard/history");
  }

  return result;
}
