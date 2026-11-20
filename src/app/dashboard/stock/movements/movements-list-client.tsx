"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { DateRangeFilter } from "@/components/data-table/date-range-filter";
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
import type { StockMovementListItem } from "@/modules/stock/list";
import { listStockMovementsAction } from "../actions";

const movementLabels: Record<string, string> = {
  INITIAL: "Estoque inicial",
  PURCHASE: "Entrada",
  SALE: "Venda",
  LOSS: "Perda",
  OPEN_PACKAGING: "Abertura de embalagem",
  ADJUSTMENT: "Ajuste",
  REVERSAL: "Estorno",
};

type MovementsListClientProps = {
  initial: PaginatedResult<StockMovementListItem>;
};

function formatQuantity(value: number) {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 3,
  });
}

export function MovementsListClient({ initial }: MovementsListClientProps) {
  const [movementType, setMovementType] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const {
    search,
    page,
    sortBy,
    sortDir,
    debouncedSearch,
    setPage,
    toggleSort,
    onSearchChange,
    resetPageAnd,
  } = usePaginatedListState({
    sortBy: "createdAt",
    sortDir: "desc",
    pageSize: 20,
  });

  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      page,
      pageSize: 20,
      sortBy,
      sortDir,
      movementType,
      startDate,
      endDate,
    }),
    [debouncedSearch, page, sortBy, sortDir, movementType, startDate, endDate],
  );

  const query = useQuery({
    queryKey: ["stock-movements", filters],
    queryFn: () => listStockMovementsAction(filters),
    initialData:
      page === 1 &&
      !debouncedSearch &&
      movementType === "ALL" &&
      !startDate &&
      !endDate &&
      sortBy === "createdAt" &&
      sortDir === "desc"
        ? initial
        : undefined,
    placeholderData: keepPreviousData,
  });

  const result = query.data;
  const items = result?.items ?? [];

  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2 lg:grid-cols-3">
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar item, justificativa ou responsável..."
        />

        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={(value) =>
            resetPageAnd(() => setStartDate(value))
          }
          onEndDateChange={(value) => resetPageAnd(() => setEndDate(value))}
        />

        <Select
          value={movementType}
          onValueChange={(value) =>
            resetPageAnd(() => setMovementType(value ?? "ALL"))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os tipos</SelectItem>
            {Object.entries(movementLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {query.isFetching && (
        <p className="text-xs text-muted-foreground">Atualizando lista...</p>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {items.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            {search || movementType !== "ALL" || startDate || endDate
              ? "Nenhuma movimentação encontrada com os filtros atuais."
              : "Nenhuma movimentação registrada."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    label="Data"
                    column="createdAt"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>Item de estoque</TableHead>
                <TableHead>
                  <SortableHeader
                    label="Tipo"
                    column="type"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Quantidade"
                    column="quantity"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>Justificativa</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(movement.createdAt).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell className="font-medium">
                    {movement.itemName}
                  </TableCell>
                  <TableCell>
                    {movementLabels[movement.type] ?? movement.type}
                  </TableCell>
                  <TableCell
                    className={`whitespace-nowrap font-semibold ${
                      movement.quantity < 0
                        ? "text-red-600"
                        : "text-emerald-700"
                    }`}
                  >
                    {formatQuantity(movement.quantity)}
                  </TableCell>
                  <TableCell>{movement.reason ?? "—"}</TableCell>
                  <TableCell>{movement.employee}</TableCell>
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