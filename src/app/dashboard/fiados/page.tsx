
import Link from "next/link";
import { Suspense } from "react";

import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";
import { FiadoActions } from "./fiado-actions";

export const metadata = {
  title: "Fiados | Adega GS",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function FiadosPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-slate-500">
          Carregando fiados...
        </div>
      }
    >
      <FiadosContent />
    </Suspense>
  );
}

async function FiadosContent() {
  await requireModuleAccess("FIADOS");

  const customers = await prisma.customer.findMany({
    where: {
      active: true,
      accountMovements: {
        some: {
          type: "DEBIT",
          reversedBy: null,
        },
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      accountMovements: {
        where: {
          type: "DEBIT",
          reversedBy: null,
        },
        select: {
          amount: true,
          allocationsAsDebit: {
            select: {
              amount: true,
            },
          },
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  const customersWithDebt = customers
    .map((customer) => {
      const totalDebt = customer.accountMovements.reduce(
        (total, movement) => {
          const paid = movement.allocationsAsDebit.reduce(
            (sum, allocation) => sum + Number(allocation.amount),
            0,
          );

          return total + Number(movement.amount) - paid;
        },
        0,
      );

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        totalDebt: Math.max(0, totalDebt),
      };
    })
    .filter((customer) => customer.totalDebt > 0);

  const totalOpenDebt = customersWithDebt.reduce(
    (total, customer) => total + customer.totalDebt,
    0,
  );

  return (
    <main className="min-h-screen bg-slate-100 p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-emerald-700 hover:underline"
          >
            ← Dashboard
          </Link>

          <h1 className="mt-3 text-2xl font-bold">Fiados</h1>

          <p className="mt-1 text-sm text-slate-500">
            Consulte as dívidas em aberto dos clientes e acompanhe os recebimentos.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Clientes com dívidas
            </p>
            <p className="mt-3 text-2xl font-bold">
              {customersWithDebt.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total em aberto
            </p>
            <p className="mt-3 text-2xl font-bold text-red-600">
              {formatCurrency(totalOpenDebt)}
            </p>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {customersWithDebt.length === 0 ? (
            <div className="p-12 text-center">
              <h2 className="font-semibold">
                Nenhuma dívida em aberto
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Os clientes com saldo devedor aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Cliente</th>
                    <th className="px-5 py-4">Telefone</th>
                    <th className="px-5 py-4">Saldo devedor</th>
                    <th className="px-5 py-4">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {customersWithDebt.map((customer) => (
                    <tr
                      key={customer.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 font-semibold">
                        {customer.name}
                      </td>

                      <td className="px-5 py-4">
                        {customer.phone}
                      </td>

                      <td className="px-5 py-4 font-semibold text-red-600">
                        {formatCurrency(customer.totalDebt)}
                      </td>

                      <td className="px-5 py-4">
                        <FiadoActions
                          customer={{
                            id: customer.id,
                            name: customer.name,
                            phone: customer.phone,
                          }}
                        />
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
