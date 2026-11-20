"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ListPagination } from "@/components/data-table/list-pagination";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { Badge } from "@/components/ui/badge";
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
import type { ProductListItem } from "@/modules/products/list";
import { deactivateProduct, listProductsAction } from "./actions";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type ProductsListClientProps = {
  initial: PaginatedResult<ProductListItem>;
};

export function ProductsListClient({ initial }: ProductsListClientProps) {
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
    queryKey: ["products", filters],
    queryFn: () => listProductsAction(filters),
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
    <div className="space-y-4">
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Buscar por nome, código ou categoria..."
        className="max-w-md"
      />

      {query.isFetching && (
        <p className="text-xs text-muted-foreground">Atualizando lista...</p>
      )}

      <section className="overflow-hidden rounded-xl border bg-card">
        {items.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="font-semibold">Nenhum produto encontrado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {search
                ? "Tente outro termo de busca."
                : "Comece cadastrando o primeiro produto da adega."}
            </p>
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
                    label="Código"
                    column="code"
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
                <TableHead>Estoque</TableHead>
                <TableHead>
                  <SortableHeader
                    label="Venda"
                    column="salePrice"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.type}
                    </p>
                  </TableCell>
                  <TableCell>{product.code}</TableCell>
                  <TableCell>{product.categoryName}</TableCell>
                  <TableCell>
                    {product.hasStockItem ? (
                      <Badge
                        variant={product.isLow ? "destructive" : "default"}
                      >
                        {product.stockQuantity} {product.unit}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Não vinculado
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {currency.format(product.salePrice)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="link" className="h-auto p-0" asChild>
                        <Link
                          href={`/dashboard/products/${product.id}/edit`}
                        >
                          Editar
                        </Link>
                      </Button>
                      <form action={deactivateProduct.bind(null, product.id)}>
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