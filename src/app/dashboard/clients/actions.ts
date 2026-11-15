
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";

function getText(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function getCustomerData(formData: FormData) {
  const name = getText(formData, "name");
  const phone = getText(formData, "phone");
  const phoneNormalized = normalizePhone(phone);

  const zipCode = getText(formData, "zipCode").replace(/\D/g, "");
  const street = getText(formData, "street");
  const number = getText(formData, "number");
  const complement = getText(formData, "complement") || null;
  const neighborhood = getText(formData, "neighborhood");
  const city = getText(formData, "city");
  const state = getText(formData, "state").toUpperCase();
  const reference = getText(formData, "reference") || null;
  const notes = getText(formData, "notes") || null;

  if (name.length < 2) {
    throw new Error("Informe um nome válido.");
  }

  if (phoneNormalized.length < 10 || phoneNormalized.length > 13) {
    throw new Error("Informe um telefone válido com DDD.");
  }

  if (
    !zipCode ||
    !street ||
    !number ||
    !neighborhood ||
    !city ||
    !state
  ) {
    throw new Error("Preencha todos os campos obrigatórios do endereço.");
  }

  if (zipCode.length !== 8) {
    throw new Error("Informe um CEP válido.");
  }

  if (state.length !== 2) {
    throw new Error("Informe a sigla do estado com duas letras.");
  }

  return {
    name,
    phone,
    phoneNormalized,
    zipCode,
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    reference,
    notes,
  };
}

export async function createCustomer(formData: FormData) {
  await requireModuleAccess("CUSTOMERS");

  const data = getCustomerData(formData);

  const existingCustomer = await prisma.customer.findUnique({
    where: {
      phoneNormalized: data.phoneNormalized,
    },
    select: {
      id: true,
    },
  });

  if (existingCustomer) {
    throw new Error("Já existe um cliente cadastrado com esse telefone.");
  }

  await prisma.customer.create({
    data,
  });

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/pos");

  redirect("/dashboard/clients");
}

export async function updateCustomer(
  id: string,
  formData: FormData,
) {
  await requireModuleAccess("CUSTOMERS");

  const data = getCustomerData(formData);

  const existingCustomer = await prisma.customer.findUnique({
    where: {
      phoneNormalized: data.phoneNormalized,
    },
    select: {
      id: true,
    },
  });

  if (existingCustomer && existingCustomer.id !== id) {
    throw new Error("Já existe outro cliente cadastrado com esse telefone.");
  }

  await prisma.customer.update({
    where: { id },
    data,
  });

  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${id}/edit`);
  revalidatePath("/dashboard/pos");

  redirect("/dashboard/clients");
}

export async function deactivateCustomer(id: string) {
  await requireModuleAccess("CUSTOMERS");

  await prisma.customer.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/pos");
}
