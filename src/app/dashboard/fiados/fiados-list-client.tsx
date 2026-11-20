"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ListPagination } from "@/components/data-table/list-pagination";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FiadoBalanceFilter } from "@/modules/fiados/list";
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
import type { FiadoListItem } from "@/modules/fiados/list";
import { FiadoActions } from "./fiado-actions";
import { listFiadosAction } from "./actions";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type FiadosListResult = PaginatedResult<FiadoListItem> & {
  totalOpenDebt: number;
  customersWithDebtCount: number;
};

type FiadosListClientProps = {
  initial: FiadosListResult;
};

export function FiadosListClient({ initial }: FiadosListClientProps) {
  const [balanceFilter, setBalanceFilter] =
    useState<FiadoBalanceFilter>("DEBT");

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
    sortBy: "totalDebt",
    sortDir: "desc",
    pageSize: 20,
  });

  const filters = useMemo(
    () => ({
      ...baseFilters,
      balanceFilter,
    }),
    [baseFilters, balanceFilter],
  );

  const query = useQuery({
    queryKey: ["fiados", filters],
    queryFn: () => listFiadosAction(filters),
    initialData:
      page === 1 &&
      !debouncedSearch &&
      balanceFilter === "DEBT" &&
      sortBy === "totalDebt" &&
      sortDir === "desc"
        ? initial
        : undefined,
    placeholderData: keepPreviousData,
  });

  const result = query.data;
  const items = result?.items ?? [];
  const customersWithDebtCount =
    result?.customersWithDebtCount ?? initial.customersWithDebtCount;
  const totalOpenDebt = result?.totalOpenDebt ?? initial.totalOpenDebt;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Clientes com dívidas
          </p>
          <p className="mt-3 text-2xl font-bold">{customersWithDebtCount}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total em aberto</p>
          <p className="mt-3 text-2xl font-bold text-red-600">
            {currency.format(totalOpenDebt)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="max-w-md"
        />

        <Select
          value={balanceFilter}
          onValueChange={(value) =>
            resetPageAnd(() =>
              setBalanceFilter((value as FiadoBalanceFilter) ?? "DEBT"),
            )
          }
        >
          <SelectTrigger className="w-[15.5rem]">
            <SelectValue placeholder="Filtro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DEBT">Com dívida</SelectItem>
            <SelectItem value="CREDIT">Com crédito disponível</SelectItem>
            <SelectItem value="ALL">Todos com movimento</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {query.isFetching && (
        <p className="text-xs text-muted-foreground">Atualizando lista...</p>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {items.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="font-semibold">
              {search
                ? "Nenhum cliente encontrado"
                : balanceFilter === "CREDIT"
                  ? "Nenhum crédito disponível"
                  : balanceFilter === "ALL"
                    ? "Nenhum cliente com movimentação"
                    : "Nenhuma dívida em aberto"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {search
                ? "Tente outro termo de busca."
                : "Ajuste o filtro ou cadastre movimentações na conta do cliente."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    label="Cliente"
                    column="name"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Telefone"
                    column="phone"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Saldo devedor"
                    column="totalDebt"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                {(balanceFilter === "CREDIT" || balanceFilter === "ALL") && (
                  <TableHead>
                    <SortableHeader
                      label="Crédito disponível"
                      column="availableCredit"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                  </TableHead>
                )}
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-semibold">{customer.name}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell className="font-semibold text-red-600">
                    {customer.totalDebt > 0
                      ? currency.format(customer.totalDebt)
                      : "—"}
                  </TableCell>
                  {(balanceFilter === "CREDIT" || balanceFilter === "ALL") && (
                    <TableCell className="font-semibold text-emerald-700">
                      {customer.availableCredit > 0
                        ? currency.format(customer.availableCredit)
                        : "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <FiadoActions
                      customer={{
                        id: customer.id,
                        name: customer.name,
                        phone: customer.phone,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
    </div>
  );
}