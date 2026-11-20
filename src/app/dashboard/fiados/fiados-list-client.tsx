"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ListPagination } from "@/components/data-table/list-pagination";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { Input } from "@/components/ui/input";
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
  const {
    search,
    page,
    sortBy,
    sortDir,
    filters,
    debouncedSearch,
    setPage,
    toggleSort,
    onSearchChange,
  } = usePaginatedListState({
    sortBy: "totalDebt",
    sortDir: "desc",
    pageSize: 20,
  });

  const query = useQuery({
    queryKey: ["fiados", filters],
    queryFn: () => listFiadosAction(filters),
    initialData:
      page === 1 &&
      !debouncedSearch &&
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

      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Buscar por nome ou telefone..."
        className="max-w-md"
      />

      {query.isFetching && (
        <p className="text-xs text-muted-foreground">Atualizando lista...</p>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {items.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="font-semibold">
              {search
                ? "Nenhum cliente encontrado"
                : "Nenhuma dívida em aberto"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {search
                ? "Tente outro termo de busca."
                : "Os clientes com saldo devedor aparecerão aqui."}
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
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-semibold">{customer.name}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell className="font-semibold text-red-600">
                    {currency.format(customer.totalDebt)}
                  </TableCell>
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