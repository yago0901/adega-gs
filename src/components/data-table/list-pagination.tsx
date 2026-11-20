"use client";

import { Button } from "@/components/ui/button";

type ListPaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
};

export function ListPagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  isLoading,
}: ListPaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <p className="text-sm text-muted-foreground">
        {total === 0
          ? "Nenhum registro"
          : `Mostrando ${from}–${to} de ${total}`}
      </p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground">
          Página {page} de {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading || page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
