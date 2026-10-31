
import Link from "next/link";
import { Suspense } from "react";

import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";

export const metadata = {
  title: "Movimentações | Adega GS",
};

const movementLabels: Record<string, string> = {
  INITIAL: "Estoque inicial",
  PURCHASE: "Entrada",
  SALE: "Venda",
  LOSS: "Perda",
  OPEN_CONTAINER: "Abertura",
  ADJUSTMENT: "Ajuste",
  REVERSAL: "Estorno",
};

function formatDate(date: Date) {
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function StockMovementsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-slate-500">
          Carregando movimentações...
        </div>
      }
    >
      <MovementsContent />
    </Suspense>
  );
}

async function MovementsContent() {
  await requireModuleAccess("STOCK");

  const movements = await prisma.stockMovement.findMany({
    include: {
      product: {
        select: {
          name: true,
          code: true,
          unit: true,
        },
      },
      user: {
        select: {
          name: true,
          username: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
  });

  return (
    <main className="min-h-screen bg-slate-100 p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/dashboard/stock"
          className="text-sm text-emerald-700 hover:underline"
        >
          ← Voltar para estoque
        </Link>

        <h1 className="mt-3 text-2xl font-bold">
          Histórico de movimentações
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Últimas 200 movimentações registradas no sistema.
        </p>

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {movements.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Nenhuma movimentação registrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Data</th>
                    <th className="px-5 py-4">Produto</th>
                    <th className="px-5 py-4">Tipo</th>
                    <th className="px-5 py-4">Quantidade</th>
                    <th className="px-5 py-4">Justificativa</th>
                    <th className="px-5 py-4">Responsável</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {movements.map((movement) => (
                    <tr key={movement.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-4">
                        {formatDate(movement.createdAt)}
                      </td>

                      <td className="px-5 py-4 font-medium">
                        {movement.product.name}
                        <p className="mt-1 text-xs text-slate-400">
                          {movement.product.code}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        {movementLabels[movement.type] ?? movement.type}
                      </td>

                      <td
                        className={`px-5 py-4 font-semibold ${
                          movement.quantity.toNumber() < 0
                            ? "text-red-600"
                            : "text-emerald-700"
                        }`}
                      >
                        {movement.quantity.toNumber()}{" "}
                        {movement.product.unit}
                      </td>

                      <td className="px-5 py-4">
                        {movement.reason ?? "—"}
                      </td>

                      <td className="px-5 py-4">
                        {movement.user?.name ??
                          movement.user?.username ??
                          "Sistema"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
