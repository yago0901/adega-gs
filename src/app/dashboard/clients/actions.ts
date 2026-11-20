"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ListQueryInput } from "@/lib/list-query";
import { requireModuleAccess } from "@/lib/permissions";
import { listCustomers } from "@/modules/customers/list";
import {
  createCustomerRecord,
  deactivateCustomerRecord,
  getActiveCustomerWithAddresses,
  parseCustomerAddresses,
  parseCustomerPersonalData,
  updateCustomerRecord,
} from "@/modules/customers/service";

export async function listCustomersAction(input: ListQueryInput = {}) {
  await requireModuleAccess("CUSTOMERS");
  return listCustomers(input);
}

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

export async function getCustomerForEditAction(id: string) {
  await requireModuleAccess("CUSTOMERS");

  const customer = await getActiveCustomerWithAddresses(id);

  if (!customer || !customer.active) {
    return { error: "Cliente não encontrado." as const };
  }

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      notes: customer.notes ?? "",
      addresses: customer.addresses.map((address) => ({
        zipCode: address.zipCode,
        street: address.street,
        number: address.number,
        complement: address.complement ?? "",
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        reference: address.reference ?? "",
        deliveryFee: address.deliveryFee.toFixed(2),
        isDefault: address.isDefault,
      })),
    },
  };
}

export async function saveCustomer(formData: FormData, id?: string) {
  await requireModuleAccess("CUSTOMERS");

  try {
    const data = parseCustomerPersonalData(formData);
    const addresses = parseCustomerAddresses(formData);

    if (id) {
      await updateCustomerRecord(id, data, addresses);
      revalidatePath(`/dashboard/clients/${id}/edit`);
    } else {
      await createCustomerRecord(data, addresses);
    }

    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/pos");

    return { success: true as const };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Não foi possível salvar.",
    };
  }
}
