import "server-only";

import { prisma } from "@/lib/prisma";
import { getText, normalizePhone } from "@/shared/form";

export type MotoboyData = {
  name: string;
  phone: string;
  phoneNormalized: string;
  notes: string | null;
};

export function parseMotoboyData(formData: FormData): MotoboyData {
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

export async function createMotoboyRecord(data: MotoboyData) {
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

  return prisma.motoboy.create({
    data,
  });
}

export async function updateMotoboyRecord(id: string, data: MotoboyData) {
  const existingMotoboy = await prisma.motoboy.findUnique({
    where: {
      phoneNormalized: data.phoneNormalized,
    },
    select: {
      id: true,
    },
  });

  if (existingMotoboy && existingMotoboy.id !== id) {
    throw new Error("Já existe outro motoboy cadastrado com esse telefone.");
  }

  return prisma.motoboy.update({
    where: { id },
    data,
  });
}

export async function deactivateMotoboyRecord(id: string) {
  return prisma.motoboy.update({
    where: { id },
    data: { active: false },
  });
}

export async function reactivateMotoboyRecord(id: string) {
  return prisma.motoboy.update({
    where: { id },
    data: { active: true },
  });
}

export async function listActiveMotoboys() {
  return prisma.motoboy.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}

export async function getActiveMotoboy(id: string) {
  return prisma.motoboy.findUnique({
    where: { id },
  });
}

export async function listAllMotoboys() {
  return prisma.motoboy.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export async function getMotoboyById(id: string) {
  return prisma.motoboy.findUnique({
    where: { id },
  });
}
