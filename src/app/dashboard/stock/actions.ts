"use server";

import { revalidatePath } from "next/cache";

import type { StockListInput } from "@/modules/stock/list";
import {
  listStockItems,
  listStockMovements,
} from "@/modules/stock/list";
import { requireModuleAccess } from "@/lib/permissions";
import {
  openCommercialPackagingRecord,
  openStockBottleRecord,
  registerStockAdjustmentRecord,
  registerStockEntryRecord,
  registerStockLossRecord,
} from "@/modules/stock/service";

export async function listStockItemsAction(input: StockListInput = {}) {
  await requireModuleAccess("STOCK");
  return listStockItems(input);
}

export async function listStockMovementsAction(input: StockListInput = {}) {
  await requireModuleAccess("STOCK");
  return listStockMovements(input);
}

function revalidateStockPages() {
  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard/stock/movements");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
}

export async function registerStockEntry(formData: FormData) {
  const session = await requireModuleAccess("STOCK");

  await registerStockEntryRecord(formData, session.user.id);

  revalidateStockPages();
}

export async function registerStockLoss(formData: FormData) {
  const session = await requireModuleAccess("STOCK");

  await registerStockLossRecord(formData, session.user.id);

  revalidateStockPages();
}

export async function registerStockAdjustment(formData: FormData) {
  const session = await requireModuleAccess("STOCK");

  await registerStockAdjustmentRecord(formData, session.user.id);

  revalidateStockPages();
}

export async function openCommercialPackaging(formData: FormData) {
  const session = await requireModuleAccess("STOCK");

  await openCommercialPackagingRecord(formData, session.user.id);

  revalidateStockPages();
}

export async function openStockBottle(formData: FormData) {
  const session = await requireModuleAccess("STOCK");

  await openStockBottleRecord(formData, session.user.id);

  revalidateStockPages();
}