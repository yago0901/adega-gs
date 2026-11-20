"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAccess } from "@/lib/permissions";
import type { ListQueryInput } from "@/lib/list-query";
import { listFiados } from "@/modules/fiados/list";
import { allocateCustomerAvailableCreditsRecord } from "@/modules/fiados/service";

export async function listFiadosAction(input: ListQueryInput = {}) {
  await requireModuleAccess("FIADOS");
  return listFiados(input);
}

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
