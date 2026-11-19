"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/permissions";
import {
  createCustomerRecord,
  deactivateCustomerRecord,
  parseCustomerAddresses,
  parseCustomerPersonalData,
  updateCustomerRecord,
} from "@/modules/customers/service";

export async function createCustomer(formData: FormData) {
  await requireModuleAccess("CUSTOMERS");

  const data = parseCustomerPersonalData(formData);
  const addresses = parseCustomerAddresses(formData);

  await createCustomerRecord(data, addresses);

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/pos");

  redirect("/dashboard/clients");
}

export async function updateCustomer(id: string, formData: FormData) {
  await requireModuleAccess("CUSTOMERS");

  const data = parseCustomerPersonalData(formData);
  const addresses = parseCustomerAddresses(formData);

  await updateCustomerRecord(id, data, addresses);

  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${id}/edit`);
  revalidatePath("/dashboard/pos");

  redirect("/dashboard/clients");
}

export async function deactivateCustomer(id: string) {
  await requireModuleAccess("CUSTOMERS");

  await deactivateCustomerRecord(id);

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/pos");
}
