"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/permissions";
import {
  createMotoboyRecord,
  deactivateMotoboyRecord,
  parseMotoboyData,
  reactivateMotoboyRecord,
  updateMotoboyRecord,
} from "@/modules/motoboys/service";

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
