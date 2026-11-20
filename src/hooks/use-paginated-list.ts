"use client";

import { useMemo, useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { SortDirection } from "@/lib/list-query";

export function usePaginatedListState(defaults?: {
  sortBy?: string;
  sortDir?: SortDirection;
  pageSize?: number;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(defaults?.sortBy ?? "name");
  const [sortDir, setSortDir] = useState<SortDirection>(
    defaults?.sortDir ?? "asc",
  );
  const debouncedSearch = useDebouncedValue(search, 250);

  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      page,
      pageSize: defaults?.pageSize ?? 20,
      sortBy,
      sortDir,
    }),
    [debouncedSearch, page, sortBy, sortDir, defaults?.pageSize],
  );

  function resetPageAnd(updater: () => void) {
    updater();
    setPage(1);
  }

  function toggleSort(column: string) {
    if (sortBy === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
    setPage(1);
  }

  function onSearchChange(value: string) {
    resetPageAnd(() => setSearch(value));
  }

  return {
    search,
    page,
    sortBy,
    sortDir,
    filters,
    debouncedSearch,
    setPage,
    setSortBy,
    setSortDir,
    resetPageAnd,
    toggleSort,
    onSearchChange,
  };
}
