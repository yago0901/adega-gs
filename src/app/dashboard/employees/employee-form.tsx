"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createEmployee, updateEmployee } from "./actions";

const modules = [
  { value: "POS", label: "Frente de caixa" },
  { value: "STOCK", label: "Estoque" },
  { value: "PRODUCTS", label: "Produtos" },
  { value: "HISTORY", label: "Histórico" },
  { value: "CUSTOMERS", label: "Clientes" },
  { value: "FIADOS", label: "Fiados" },
  { value: "EMPLOYEES", label: "Funcionários" },
  { value: "FINANCE", label: "Financeiro" },
] as const;

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10";

type Employee = {
  id: string;
  name: string;
  email: string;
  accesses: {
    module: string;
    canManageCashRegister: boolean;
  }[];
};

type Props = {
  employee?: Employee | null;
  onCancelEdit?: () => void;
  onSaved?: () => void;
};

export function EmployeeForm({
  employee = null,
  onCancelEdit,
  onSaved,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [selectedModules, setSelectedModules] = useState<string[]>(
    () => employee?.accesses.map((access) => access.module) ?? [],
  );
  const [canManageCashRegister, setCanManageCashRegister] = useState(
    () =>
      employee?.accesses.some(
        (access) => access.module === "POS" && access.canManageCashRegister,
      ) ?? false,
  );

  const isEditing = Boolean(employee);
  const hasPosAccess = selectedModules.includes("POS");

  const selectedLabels = useMemo(
    () =>
      modules
        .filter((module) => selectedModules.includes(module.value))
        .map((module) => module.label),
    [selectedModules],
  );

  function toggleModule(moduleValue: string) {
    const next = selectedModules.includes(moduleValue)
      ? selectedModules.filter((value) => value !== moduleValue)
      : [...selectedModules, moduleValue];

    setSelectedModules(next);

    if (!next.includes("POS")) {
      setCanManageCashRegister(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    formData.delete("modules");
    for (const module of selectedModules) {
      formData.append("modules", module);
    }

    if (hasPosAccess && canManageCashRegister) {
      formData.set("canManageCashRegister", "on");
    } else {
      formData.delete("canManageCashRegister");
    }

    setMessage("");

    startTransition(async () => {
      const result = isEditing
        ? await updateEmployee(formData)
        : await createEmployee(formData);

      if (result.error) {
        setMessage(result.error);
        return;
      }

      if (isEditing) {
        onCancelEdit?.();
      } else {
        form.reset();
        setSelectedModules([]);
        setCanManageCashRegister(false);
        setMessage("Funcionário cadastrado com sucesso!");
      }

      onSaved?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {isEditing && (
        <input type="hidden" name="id" value={employee!.id} />
      )}

      <section>
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-slate-800">
            Dados de acesso
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {isEditing
              ? "Atualize os dados de acesso do funcionário."
              : "Informe os dados que o funcionário utilizará para entrar no sistema."}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Nome completo *
            </label>
            <input
              name="name"
              required
              defaultValue={employee?.name ?? ""}
              className={inputClass}
              placeholder="Nome do funcionário"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              E-mail *
            </label>
            <input
              name="email"
              type="email"
              required
              defaultValue={employee?.email ?? ""}
              className={inputClass}
              placeholder="funcionario@email.com"
            />
          </div>

          {!isEditing && (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Nome de usuário *
                </label>
                <input
                  name="username"
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="[a-zA-Z0-9_.]+"
                  className={inputClass}
                  placeholder="Ex.: junior"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Letras, números, ponto e underline.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Senha inicial *
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  className={inputClass}
                  placeholder="Mínimo de 8 caracteres"
                />
              </div>
            </>
          )}
        </div>
      </section>

      <div className="border-t border-slate-100" />

      <section>
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Permissões de acesso
            </h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
              Obrigatório
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Selecione os módulos disponíveis para este funcionário.
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Módulos *</p>

          <div
            role="listbox"
            aria-multiselectable="true"
            aria-label="Módulos"
            className="overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            {modules.map((module) => {
              const selected = selectedModules.includes(module.value);

              return (
                <button
                  key={module.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => toggleModule(module.value)}
                  className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3.5 py-2.5 text-left text-sm last:border-b-0 transition ${
                    selected
                      ? "bg-emerald-50 font-medium text-emerald-800"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{module.label}</span>
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                      selected
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-300 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                </button>
              );
            })}
          </div>

          {selectedLabels.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              Selecionados: {selectedLabels.join(", ")}
            </p>
          )}
        </div>

        {hasPosAccess && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
            <input
              type="checkbox"
              checked={canManageCashRegister}
              onChange={(event) =>
                setCanManageCashRegister(event.target.checked)
              }
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600"
            />
            <span>
              <span className="block text-sm font-medium text-slate-800">
                Gerenciar caixa
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Permite abrir e fechar o caixa compartilhado da adega.
              </span>
            </span>
          </label>
        )}
      </section>

      {message && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${message.includes("sucesso")
            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border border-red-200 bg-red-50 text-red-700"
            }`}
        >
          {message}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
        <div>
          {isEditing && (
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={isPending}
              className="text-sm font-medium text-slate-500 transition hover:text-slate-800 disabled:opacity-50"
            >
              Cancelar edição
            </button>
          )}

          {!isEditing && (
            <p className="text-xs text-slate-400">
              Os campos marcados com * são obrigatórios.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              {isEditing ? "Salvando..." : "Cadastrando..."}
            </>
          ) : (
            <>
              <span className="text-base">{isEditing ? "✓" : "+"}</span>
              {isEditing ? "Salvar alterações" : "Cadastrar funcionário"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
