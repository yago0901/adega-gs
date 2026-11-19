
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/permissions";
import {
  createEmployeeRecord,
  parseCreateEmployeeInput,
  parseUpdateEmployeeInput,
  toggleEmployeeStatusRecord,
  updateEmployeeRecord,
} from "@/modules/employees/service";

export async function createEmployee(formData: FormData) {
  await requireAdmin();

  const parsed = parseCreateEmployeeInput(formData);

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const result = await createEmployeeRecord(parsed);

  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function updateEmployee(formData: FormData) {
  await requireAdmin();

  const parsed = parseUpdateEmployeeInput(formData);

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const result = await updateEmployeeRecord(parsed);

  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function toggleEmployeeStatus(employeeId: string) {
  await requireAdmin();

  const result = await toggleEmployeeStatusRecord(employeeId);

  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard");

  return { success: true };
}