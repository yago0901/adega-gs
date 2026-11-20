"use server";

import { requireModuleAccess } from "@/lib/permissions";
import {
  listHistoryCashRegisters,
  listHistoryCredits,
  listHistorySales,
  type HistoryListInput,
} from "@/modules/history/list";
import { loadCashRegisterDetails } from "@/modules/history/queries";

export async function listHistorySalesAction(input: HistoryListInput = {}) {
  await requireModuleAccess("HISTORY");
  return listHistorySales(input);
}

export async function listHistoryCreditsAction(input: HistoryListInput = {}) {
  await requireModuleAccess("HISTORY");
  return listHistoryCredits(input);
}

export async function listHistoryCashRegistersAction(
  input: HistoryListInput = {},
) {
  await requireModuleAccess("HISTORY");
  return listHistoryCashRegisters(input);
}

export async function getCashRegisterDetailsAction(cashRegisterId: string) {
  await requireModuleAccess("HISTORY");
  return loadCashRegisterDetails(cashRegisterId);
}
