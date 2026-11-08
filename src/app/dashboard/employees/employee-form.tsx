
"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createEmployee, updateEmployee } from "./actions";

const modules = [
  { value: "POS", label: "Frente de caixa", description: "Registrar vendas e operar o caixa", icon: "▣" },
  { value: "STOCK", label: "Estoque", description: "Consultar e movimentar estoque", icon: "▦" },
  { value: "PRODUCTS", label: "Produtos", description: "Cadastrar e gerenciar produtos", icon: "▤" },
  { value: "HISTORY", label: "Histórico", description: "Consultar movimentações e vendas", icon: "◷" },
  { value: "EMPLOYEES", label: "Funcionários", description: "Acessar o módulo de funcionários", icon: "♙" },
  { value: "FINANCE", label: "Financeiro", description: "Acessar informações financeiras", icon: "＄" },
];

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10";

type Employee = {
  id: string;
  name: string;
  email: string;
  accesses: {
    module: string;
  }[];
};

type Props = {
  employee?: Employee | null;
  onCancelEdit?: () => void;
};

export function EmployeeForm({ employee = null, onCancelEdit }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const isEditing = Boolean(employee);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

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
        setMessage("Funcionário cadastrado com sucesso!");
      }

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
        <div className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Permissões de acesso
            </h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
              Obrigatório
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Selecione os módulos que estarão disponíveis para este funcionário.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <label key={module.value} className="group cursor-pointer">
              <input
                type="checkbox"
                name="modules"
                value={module.value}
                defaultChecked={employee?.accesses.some(
                  (access) => access.module === module.value
                ) ?? false}
                className="peer sr-only"
              />

              <div className="flex h-full min-h-20 items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50 peer-checked:border-emerald-500 peer-checked:bg-emerald-50/60 peer-checked:ring-1 peer-checked:ring-emerald-500/20">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg text-slate-600 transition peer-checked:bg-emerald-100 peer-checked:text-emerald-700 group-has-[:checked]:bg-emerald-100 group-has-[:checked]:text-emerald-700">
                  {module.icon}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800">
                    {module.label}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                    {module.description}
                  </span>
                </span>

                <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-300 text-[10px] text-transparent peer-checked:border-emerald-600 peer-checked:bg-emerald-600 peer-checked:text-white group-has-[:checked]:border-emerald-600 group-has-[:checked]:bg-emerald-600 group-has-[:checked]:text-white">
                  ✓
                </span>
              </div>
            </label>
          ))}
        </div>

        <p className="mt-3 text-xs text-slate-400">
          O funcionário terá acesso somente aos módulos selecionados.
        </p>
      </section>

      {message && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${
            message.includes("sucesso")
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
