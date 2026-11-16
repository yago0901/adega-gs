
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

function getMotoboyData(formData: FormData) {
  const name = getText(formData, "name");
  const phone = getText(formData, "phone");
  const phoneNormalized = normalizePhone(phone);
  const notes = getText(formData, "notes") || null;

  if (name.length < 2) {
    throw new Error("Informe um nome válido.");
  }

  if (phoneNormalized.length < 10 || phoneNormalized.length > 13) {
    throw new Error("Informe um telefone válido com DDD.");
  }

  return {
    name,
    phone,
    phoneNormalized,
    notes,
  };
}

export async function createMotoboy(formData: FormData) {
  await requireModuleAccess("MOTOBOYS");

  const data = getMotoboyData(formData);

  const existingMotoboy = await prisma.motoboy.findUnique({
    where: {
      phoneNormalized: data.phoneNormalized,
    },
    select: {
      id: true,
    },
  });

  if (existingMotoboy) {
    throw new Error("Já existe um motoboy cadastrado com esse telefone.");
  }

  await prisma.motoboy.create({
    data,
  });

  revalidatePath("/dashboard/motoboys");

  redirect("/dashboard/motoboys");
}

export async function updateMotoboy(
  id: string,
  formData: FormData,
) {
  await requireModuleAccess("MOTOBOYS");

  const data = getMotoboyData(formData);

  const existingMotoboy = await prisma.motoboy.findUnique({
    where: {
      phoneNormalized: data.phoneNormalized,
    },
    select: {
      id: true,
    },
  });

  if (existingMotoboy && existingMotoboy.id !== id) {
    throw new Error(
      "Já existe outro motoboy cadastrado com esse telefone.",
    );
  }

  await prisma.motoboy.update({
    where: { id },
    data,
  });

  revalidatePath("/dashboard/motoboys");
  revalidatePath(`/dashboard/motoboys/${id}/edit`);

  redirect("/dashboard/motoboys");
}

export async function deactivateMotoboy(id: string) {
  await requireModuleAccess("MOTOBOYS");

  await prisma.motoboy.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/dashboard/motoboys");
}

export async function reactivateMotoboy(id: string) {
  await requireModuleAccess("MOTOBOYS");

  await prisma.motoboy.update({
    where: { id },
    data: { active: true },
  });

  revalidatePath("/dashboard/motoboys");
}
