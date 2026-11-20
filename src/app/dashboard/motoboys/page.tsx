import { Suspense } from "react";

import { requireModuleAccess } from "@/lib/permissions";
import { listMotoboys } from "@/modules/motoboys/list";
import { MotoboysListClient } from "./motoboys-list-client";

export const metadata = {
  title: "Motoboys | Adega GS",
};

export default function MotoboysPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-slate-500">
          Carregando motoboys...
        </div>
      }
    >
      <MotoboysContent />
    </Suspense>
  );
}

async function MotoboysContent() {
  await requireModuleAccess("MOTOBOYS");

  const [initial, activeSummary] = await Promise.all([
    listMotoboys({ page: 1, pageSize: 20 }),
    listMotoboys({ page: 1, pageSize: 1, active: "ACTIVE" }),
  ]);

  return (
    <main className="min-h-screen bg-slate-100 p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <MotoboysListClient
          initial={initial}
          initialActiveTotal={activeSummary.total}
        />
      </div>
    </main>
  );
}