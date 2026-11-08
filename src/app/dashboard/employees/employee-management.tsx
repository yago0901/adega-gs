"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmployeeForm } from "./employee-form";
import { toggleEmployeeStatus } from "./actions";

type Employee = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  active: boolean;
  createdAt: Date;
  accesses: {
    module: string;
  }[];
};

type Props = {
  employees: Employee[];
};

const moduleNames: Record<string, string> = {
  POS: "PDV",
  STOCK: "Estoque",
  PRODUCTS: "Produtos",
  HISTORY: "Histórico",
  EMPLOYEES: "Funcionários",
  FINANCE: "Financeiro",
};

export function EmployeeManagement({ employees }: Props) {
  const [selectedEmployee, setSelectedEmployee] =
    useState<Employee | null>(null);

  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");

  function handleToggleStatus(employee: Employee) {
    setFeedback("");

    startTransition(async () => {
      const result = await toggleEmployeeStatus(employee.id);

      if (result.error) {
        setFeedback(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]">

      <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Funcionários cadastrados
          </h2>

          <span className="text-sm text-zinc-500">
            {employees.length} cadastrados
          </span>
        </div>

        {employees.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            Nenhum funcionário cadastrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="pb-3 pr-4 font-medium">Funcionário</th>
                  <th className="pb-3 pr-4 font-medium">E-mail</th>
                  <th className="pb-3 pr-4 font-medium">Permissões</th>
                  <th className="pb-3 pr-4 font-medium">Situação</th>
                  <th className="pb-3 font-medium">Ações</th>
                </tr>
              </thead>

              <tbody>
                {employees.map((employee) => {
                  const isSelected = selectedEmployee?.id === employee.id;

                  return (
                    <Fragment key={employee.id}>
                      <tr className={`border-b border-zinc-100 ${isSelected ? "bg-emerald-50/50" : ""}`}>
                        <td className="py-4 pr-4">
                          <p className="font-medium">{employee.name}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {employee.username
                              ? `@${employee.username}`
                              : "Sem usuário"}
                          </p>
                        </td>

                        <td className="py-4 pr-4">
                          {employee.email}
                        </td>

                        <td className="py-4 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {employee.accesses.map((access) => (
                              <span
                                key={access.module}
                                className="rounded-md bg-zinc-100 px-2 py-1 text-xs"
                              >
                                {moduleNames[access.module] ?? access.module}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="py-4 pr-4">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${employee.active
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                              }`}
                          >
                            {employee.active ? "Ativo" : "Inativo"}
                          </span>
                        </td>

                        <td className="py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedEmployee(isSelected ? null : employee)
                              }
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                            >
                              {isSelected ? "Selecionado" : "Editar"}
                            </button>

                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleToggleStatus(employee)}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${employee.active
                                ? "border-red-200 text-red-700 hover:bg-red-50"
                                : "border-green-200 text-green-700 hover:bg-green-50"
                                }`}
                            >
                              {employee.active ? "Desativar" : "Ativar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {feedback && (
          <p className="mt-3 text-sm text-red-600">
            {feedback}
          </p>
        )}
      </section>

      <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-5">
        <div className="mb-5 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">
              {selectedEmployee ? "Editar funcionário" : "Novo funcionário"}
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              {selectedEmployee
                ? `Alterando os dados de ${selectedEmployee.name}.`
                : "Cadastre uma conta e defina seus acessos."}
            </p>
          </div>

          {selectedEmployee && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              Editando
            </span>
          )}
        </div>

        <EmployeeForm
          key={selectedEmployee?.id ?? "new"}
          employee={selectedEmployee}
          onCancelEdit={() => setSelectedEmployee(null)}
        />
      </section>
    </div>
  );
}
