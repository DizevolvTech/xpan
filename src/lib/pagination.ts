export interface PaginatedResult<T> {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  items: T[];
}

export function paginateArray<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
  const totalItems = items.length;
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, totalItems);

  return {
    page: safePage,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    items: items.slice(startIndex, endIndex),
  };
}
