"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ListPagination } from "@/components/data-table/list-pagination";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { Button } from "@/components/ui/button";
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
import type { CustomerListItem } from "@/modules/customers/list";
import { CustomerFormModal } from "./customer-form-modal";
import { deactivateCustomer, listCustomersAction } from "./actions";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type ClientsListClientProps = {
  initial: PaginatedResult<CustomerListItem>;
};

export function ClientsListClient({ initial }: ClientsListClientProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(
    null,
  );

  function openCreateModal() {
    setEditingCustomerId(null);
    setModalOpen(true);
  }

  function openEditModal(customerId: string) {
    setEditingCustomerId(customerId);
    setModalOpen(true);
  }

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
    sortBy: "name",
    sortDir: "asc",
    pageSize: 20,
  });

  const query = useQuery({
    queryKey: ["customers", filters],
    queryFn: () => listCustomersAction(filters),
    initialData:
      page === 1 &&
      !debouncedSearch &&
      sortBy === "name" &&
      sortDir === "asc"
        ? initial
        : undefined,
    placeholderData: keepPreviousData,
  });

  const result = query.data;
  const items = result?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <a
            href="/dashboard"
            className="text-sm text-emerald-700 hover:underline"
          >
            ← Dashboard
          </a>
          <h1 className="mt-3 text-2xl font-bold">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cadastro e consulta dos clientes da adega.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Novo cliente
        </button>
      </div>

      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Buscar por nome, telefone ou endereço..."
        className="max-w-md"
      />

      {query.isFetching && (
        <p className="text-xs text-muted-foreground">Atualizando lista...</p>
      )}

      <section className="overflow-hidden rounded-xl border bg-card">
        {items.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="font-semibold">Nenhum cliente encontrado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {search
                ? "Tente outro termo de busca."
                : "Comece cadastrando o primeiro cliente da adega."}
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
                <TableHead>Endereço padrão</TableHead>
                <TableHead>Taxa</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((customer) => {
                const addr = customer.defaultAddress;

                return (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <p className="font-semibold">{customer.name}</p>
                      {customer.addressesCount > 1 && (
                        <p className="text-xs text-muted-foreground">
                          {customer.addressesCount} endereços
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>
                      {addr ? (
                        <>
                          <p>
                            {addr.city} - {addr.state}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {addr.street}, {addr.number} · {addr.neighborhood}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          Sem endereço
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {addr ? currency.format(addr.deliveryFee) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0"
                          onClick={() => openEditModal(customer.id)}
                        >
                          Editar
                        </Button>
                        <form
                          action={deactivateCustomer.bind(null, customer.id)}
                        >
                          <Button
                            type="submit"
                            variant="link"
                            className="h-auto p-0 text-destructive"
                          >
                            Desativar
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
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

      <CustomerFormModal
        open={modalOpen}
        customerId={editingCustomerId}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}