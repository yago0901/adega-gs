
import { Suspense } from "react";
import { requireModuleAccess } from "@/lib/permissions";
import { loadHistoryPageData } from "@/modules/history/queries";
import { HistoryClient } from "./history-client";

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="p-8">Carregando histórico...</div>}>
      <HistoryContent />
    </Suspense>
  );
}

async function HistoryContent() {
  await requireModuleAccess("HISTORY");

  const { sales, cashRegisters, debtPayments } =
    await loadHistoryPageData();

  return (
    <HistoryClient
      sales={sales}
      cashRegisters={cashRegisters}
      debtPayments={debtPayments}
    />
  );
}