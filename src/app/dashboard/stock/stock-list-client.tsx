"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ListPagination } from "@/components/data-table/list-pagination";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { Badge } from "@/components/ui/badge";
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
import type { StockListItem } from "@/modules/stock/list";
import {
  listStockItemsAction,
  openCommercialPackaging,
  openStockBottle,
} from "./actions";

type StockListClientProps = {
  initial: PaginatedResult<StockListItem>;
};

function formatQuantity(value: number) {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 3,
  });
}

function getUnitLabel(unit: string) {
  switch (unit) {
    case "ML":
      return "ml";
    case "GRAM":
      return "g";
    default:
      return "un.";
  }
}

export function StockListClient({ initial }: StockListClientProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [stockStatus, setStockStatus] = useState<"ALL" | "LOW" | "OK">("ALL");

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
    sortBy: "name",
    sortDir: "asc",
    pageSize: 20,
  });

  async function refreshStockAfterMutation(
    action: (formData: FormData) => Promise<void>,
    formData: FormData,
  ) {
    await action(formData);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["stock-items"] }),
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] }),
    ]);
    router.refresh();
  }

  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      page,
      pageSize: 20,
      sortBy,
      sortDir,
      stockStatus,
    }),
    [debouncedSearch, page, sortBy, sortDir, stockStatus],
  );

  const query = useQuery({
    queryKey: ["stock-items", filters],
    queryFn: () => listStockItemsAction(filters),
    initialData:
      page === 1 &&
      !debouncedSearch &&
      stockStatus === "ALL" &&
      sortBy === "name" &&
      sortDir === "asc"
        ? initial
        : undefined,
    placeholderData: keepPreviousData,
  });

  const result = query.data;
  const items = result?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nome, código ou categoria..."
          className="max-w-md"
        />

        <Select
          value={stockStatus}
          onValueChange={(value) =>
            resetPageAnd(() =>
              setStockStatus((value ?? "ALL") as "ALL" | "LOW" | "OK"),
            )
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os itens</SelectItem>
            <SelectItem value="LOW">Estoque baixo</SelectItem>
            <SelectItem value="OK">Estoque normal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {query.isFetching && (
        <p className="text-xs text-muted-foreground">Atualizando lista...</p>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold">Itens em estoque</h2>
          <p className="mt-1 text-sm text-slate-500">
            Embalagens fechadas e quantidades já abertas são exibidas
            separadamente.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            {search || stockStatus !== "ALL"
              ? "Nenhum item encontrado com os filtros atuais."
              : "Nenhum item de estoque cadastrado."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    label="Produto"
                    column="name"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Categoria"
                    column="category"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Fechados"
                    column="stock"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>Disponível aberto</TableHead>
                <TableHead>Mínimo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.code}
                    </p>
                  </TableCell>
                  <TableCell>{product.categoryName}</TableCell>
                  <TableCell>
                    {product.closedQuantity > 0
                      ? `${formatQuantity(product.closedQuantity)} un.`
                      : "—"}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {product.openQuantity > 0
                      ? `${formatQuantity(product.openQuantity)} ${getUnitLabel(product.unit)}`
                      : product.closedQuantity > 0
                        ? "—"
                        : `${formatQuantity(0)} ${getUnitLabel(product.unit)}`}
                  </TableCell>
                  <TableCell>
                    {formatQuantity(product.minStock)}{" "}
                    {getUnitLabel(product.unit)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={product.isLow ? "destructive" : "default"}
                      className={
                        product.isLow
                          ? ""
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                      }
                    >
                      {product.isLow ? "Estoque baixo" : "Normal"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-3">
                      {product.canOpenPackaging && (
                        <form
                          action={(formData) =>
                            refreshStockAfterMutation(
                              openCommercialPackaging,
                              formData,
                            )
                          }
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="productId"
                            value={product.id}
                          />
                          <input
                            type="number"
                            name="quantity"
                            min="1"
                            step="1"
                            defaultValue="1"
                            required
                            aria-label={`Quantidade de embalagens para abrir de ${product.name}`}
                            className="w-16 rounded border border-slate-300 p-1.5"
                          />
                          <button
                            type="submit"
                            className="font-semibold text-blue-700 hover:underline"
                          >
                            Abrir embalagem(ns)
                          </button>
                        </form>
                      )}

                      {product.canOpenBottle && (
                        <form
                          action={(formData) =>
                            refreshStockAfterMutation(
                              openStockBottle,
                              formData,
                            )
                          }
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="productId"
                            value={product.id}
                          />
                          <input
                            type="number"
                            name="quantity"
                            min="1"
                            step="1"
                            defaultValue="1"
                            required
                            aria-label={`Quantidade de garrafas para abrir de ${product.name}`}
                            className="w-16 rounded border border-slate-300 p-1.5"
                          />
                          <button
                            type="submit"
                            className="font-semibold text-purple-700 hover:underline"
                          >
                            Abrir garrafa(s)
                          </button>
                        </form>
                      )}
                    </div>
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