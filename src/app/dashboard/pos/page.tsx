
import { Suspense } from "react";

import { requireModuleAccess } from "@/lib/permissions";
import { loadPosPageData } from "@/modules/pos/queries";

import PosClient from "./pos-client";

export const metadata = {
  title: "Frente de Caixa | Adega GS",
};

export default function PosPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-gray-500">
          Carregando frente de caixa...
        </div>
      }
    >
      <PosContent />
    </Suspense>
  );
}

async function PosContent() {
  const session = await requireModuleAccess("POS");

  const {
    canManageCashRegister,
    showBackToDashboard,
    products,
    productsMeta,
    customers,
    deliveries,
    motoboys,
    cashRegister,
  } = await loadPosPageData(session.user.id);

  return (
    <PosClient
      products={products}
      productsMeta={productsMeta}
      customers={customers}
      canManageCashRegister={canManageCashRegister}
      showBackToDashboard={showBackToDashboard}
      deliveries={deliveries}
      motoboys={motoboys}
      cashRegister={cashRegister}
    />
  );
}