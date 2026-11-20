"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/permissions";
import {
  listMotoboys,
  type MotoboyListInput,
} from "@/modules/motoboys/list";
import {
  createMotoboyRecord,
  deactivateMotoboyRecord,
  parseMotoboyData,
  reactivateMotoboyRecord,
  updateMotoboyRecord,
} from "@/modules/motoboys/service";

export async function listMotoboysAction(input: MotoboyListInput = {}) {
  await requireModuleAccess("MOTOBOYS");
  return listMotoboys(input);
}

export async function createMotoboy(formData: FormData) {
  await requireModuleAccess("MOTOBOYS");

  const data = parseMotoboyData(formData);
  await createMotoboyRecord(data);

  revalidatePath("/dashboard/motoboys");
  redirect("/dashboard/motoboys");
}

export async function updateMotoboy(id: string, formData: FormData) {
  await requireModuleAccess("MOTOBOYS");

  const data = parseMotoboyData(formData);
  await updateMotoboyRecord(id, data);

  revalidatePath("/dashboard/motoboys");
  revalidatePath(`/dashboard/motoboys/${id}/edit`);
  redirect("/dashboard/motoboys");
}

export async function saveMotoboy(formData: FormData, id?: string) {
  await requireModuleAccess("MOTOBOYS");

  try {
    const data = parseMotoboyData(formData);

    if (id) {
      await updateMotoboyRecord(id, data);
      revalidatePath(`/dashboard/motoboys/${id}/edit`);
    } else {
      await createMotoboyRecord(data);
    }

    revalidatePath("/dashboard/motoboys");

    return { success: true as const };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Não foi possível salvar.",
    };
  }
}

export async function deactivateMotoboy(id: string) {
  await requireModuleAccess("MOTOBOYS");

  await deactivateMotoboyRecord(id);

  revalidatePath("/dashboard/motoboys");
  revalidatePath("/dashboard/pos");
}

export async function reactivateMotoboy(id: string) {
  await requireModuleAccess("MOTOBOYS");

  await reactivateMotoboyRecord(id);

  revalidatePath("/dashboard/motoboys");
  revalidatePath("/dashboard/pos");
}
