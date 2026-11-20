export const DEFAULT_PAGE_SIZE = 20;

export type SortDirection = "asc" | "desc";

export type ListQueryInput = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: SortDirection;
  startDate?: string;
  endDate?: string;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export function normalizeListQuery(input: ListQueryInput = {}) {
  const page = Math.max(1, Number(input.page) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(input.pageSize) || DEFAULT_PAGE_SIZE),
  );
  const search = input.search?.trim() ?? "";
  const sortBy = input.sortBy?.trim() || undefined;
  const sortDir: SortDirection =
    input.sortDir === "asc" || input.sortDir === "desc"
      ? input.sortDir
      : "desc";
  const startDate = input.startDate?.trim() || undefined;
  const endDate = input.endDate?.trim() || undefined;

  return {
    page,
    pageSize,
    search,
    sortBy,
    sortDir,
    startDate,
    endDate,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function parseDateRange(startDate?: string, endDate?: string) {
  const createdAt: { gte?: Date; lte?: Date } = {};

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    if (!Number.isNaN(start.getTime())) {
      createdAt.gte = start;
    }
  }

  if (endDate) {
    const end = new Date(`${endDate}T23:59:59.999`);
    if (!Number.isNaN(end.getTime())) {
      createdAt.lte = end;
    }
  }

  return Object.keys(createdAt).length > 0 ? createdAt : undefined;
}
