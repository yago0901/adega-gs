"use client";

import { useMemo, useState, useTransition } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPagination } from "@/components/data-table/list-pagination";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePaginatedListState } from "@/hooks/use-paginated-list";
import type { PaginatedResult } from "@/lib/list-query";
import type { EmployeeListItem } from "@/modules/employees/list";
import { EmployeeForm } from "./employee-form";
import { listEmployeesAction, toggleEmployeeStatus } from "./actions";

type Props = {
  initial: PaginatedResult<EmployeeListItem>;
};

const moduleNames: Record<string, string> = {
  POS: "PDV",
  STOCK: "Estoque",
  PRODUCTS: "Produtos",
  HISTORY: "Histórico",
  EMPLOYEES: "Funcionários",
  FINANCE: "Financeiro",
  FIADOS: "Fiados",
  CUSTOMERS: "Clientes",
};

export function EmployeeManagement({ initial }: Props) {
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeListItem | null>(null);
  const [active, setActive] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [feedback, setFeedback] = useState("");

  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const {
    search,
    page,
    sortBy,
    sortDir,
    filters: baseFilters,
    debouncedSearch,
    setPage,
    toggleSort,
    onSearchChange,
    resetPageAnd,
  } = usePaginatedListState({
    sortBy: "name",
    sortDir: "asc",
    pageSize: 20,
  });

  const filters = useMemo(
    () => ({
      ...baseFilters,
      active,
    }),
    [baseFilters, active],
  );

  const query = useQuery({
    queryKey: ["employees", filters],
    queryFn: () => listEmployeesAction(filters),
    initialData:
      page === 1 &&
      !debouncedSearch &&
      active === "ALL" &&
      sortBy === "name" &&
      sortDir === "asc"
        ? initial
        : undefined,
    placeholderData: keepPreviousData,
  });

  const result = query.data;
  const employees = result?.items ?? [];

  function handleToggleStatus(employee: EmployeeListItem) {
    setFeedback("");

    startTransition(async () => {
      const toggleResult = await toggleEmployeeStatus(employee.id);

      if (toggleResult.error) {
        setFeedback(toggleResult.error);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["employees"] });
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]">
      <section className="min-w-0 space-y-4">
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar por nome, usuário ou e-mail..."
          />
          <Select
            value={active}
            onValueChange={(value) =>
              resetPageAnd(() =>
                setActive((value as "ALL" | "ACTIVE" | "INACTIVE") ?? "ALL"),
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="ACTIVE">Ativos</SelectItem>
              <SelectItem value="INACTIVE">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {query.isFetching && (
          <p className="text-xs text-muted-foreground">Atualizando lista...</p>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {employees.length === 0 ? (
            <p className="p-12 text-center text-sm text-slate-500">
              {search || active !== "ALL"
                ? "Nenhum funcionário encontrado com esses filtros."
                : "Nenhum funcionário cadastrado."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortableHeader
                      label="Funcionário"
                      column="name"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      label="E-mail"
                      column="email"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                  </TableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead>
                    <SortableHeader
                      label="Situação"
                      column="active"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                  </TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => {
                  const isSelected = selectedEmployee?.id === employee.id;

                  return (
                    <TableRow
                      key={employee.id}
                      className={isSelected ? "bg-emerald-50/50" : undefined}
                    >
                      <TableCell>
                        <p className="font-medium">{employee.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {employee.username
                            ? `@${employee.username}`
                            : "Sem usuário"}
                        </p>
                      </TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {employee.accesses.map((access) => (
                            <span
                              key={access.module}
                              className="rounded-md bg-slate-100 px-2 py-1 text-xs"
                            >
                              {moduleNames[access.module] ?? access.module}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={employee.active ? "default" : "destructive"}
                        >
                          {employee.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setSelectedEmployee(
                                isSelected ? null : employee,
                              )
                            }
                          >
                            {isSelected ? "Selecionado" : "Editar"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isPending}
                            className={
                              employee.active
                                ? "text-red-700 hover:bg-red-50"
                                : "text-green-700 hover:bg-green-50"
                            }
                            onClick={() => handleToggleStatus(employee)}
                          >
                            {employee.active ? "Desativar" : "Ativar"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {feedback && (
            <p className="mt-3 text-sm text-red-600">{feedback}</p>
          )}

          <div className="border-t px-4">
            <ListPagination
              page={result?.page ?? page}
              pageCount={result?.pageCount ?? 1}
              total={result?.total ?? 0}
              pageSize={result?.pageSize ?? 20}
              isLoading={query.isFetching}
              onPageChange={setPage}
            />
          </div>
        </section>
      </section>

      <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">
              {selectedEmployee ? "Editar funcionário" : "Novo funcionário"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
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
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ["employees"] });
          }}
        />
      </section>
    </div>
  );
}