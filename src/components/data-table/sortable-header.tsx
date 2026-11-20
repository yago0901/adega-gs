"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SortDirection } from "@/lib/list-query";
import { cn } from "@/lib/utils";

type SortableHeaderProps = {
  label: string;
  column: string;
  sortBy?: string;
  sortDir?: SortDirection;
  onSort: (column: string) => void;
  className?: string;
};

export function SortableHeader({
  label,
  column,
  sortBy,
  sortDir = "desc",
  onSort,
  className,
}: SortableHeaderProps) {
  const active = sortBy === column;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("-ml-2 h-8 gap-1 px-2 font-semibold", className)}
      onClick={() => onSort(column)}
    >
      {label}
      {active ? (
        sortDir === "asc" ? (
          <ArrowUp className="size-3.5" />
        ) : (
          <ArrowDown className="size-3.5" />
        )
      ) : (
        <ArrowUpDown className="size-3.5 opacity-40" />
      )}
    </Button>
  );
}
