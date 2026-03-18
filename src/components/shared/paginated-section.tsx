"use client";

import { useMemo, useState } from "react";

import { paginateArray, type PaginatedResult } from "@/lib/pagination";
import { PaginationControls } from "@/components/shared/pagination-controls";
import {
  hasTemporalSortValue,
  sortItemsByTemporalValue,
  type TemporalSortOrder,
} from "@/lib/temporal-table-sort";

interface PaginatedSectionProps<T> {
  items: T[];
  label?: string;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  temporalSortKeys?: string[];
  children: (items: T[], pagination: PaginatedResult<T>) => React.ReactNode;
}

export function PaginatedSection<T>({
  items,
  label = "registros",
  initialPageSize = 10,
  pageSizeOptions,
  temporalSortKeys,
  children,
}: PaginatedSectionProps<T>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortOrder, setSortOrder] = useState<TemporalSortOrder>("recent_first");
  const objectItems = useMemo(
    () => items.filter((item): item is Extract<T, object> => typeof item === "object" && item !== null),
    [items],
  );
  const supportsTemporalSort = objectItems.length === items.length;
  const canSortByDate = useMemo(
    () => supportsTemporalSort && hasTemporalSortValue(objectItems, temporalSortKeys),
    [objectItems, supportsTemporalSort, temporalSortKeys],
  );
  const sortedItems = useMemo(
    () =>
      canSortByDate
        ? (sortItemsByTemporalValue(objectItems, sortOrder, temporalSortKeys) as unknown as T[])
        : items,
    [canSortByDate, items, objectItems, sortOrder, temporalSortKeys],
  );
  const pagination = useMemo(() => paginateArray(sortedItems, page, pageSize), [page, pageSize, sortedItems]);

  return (
    <div className="space-y-3">
      {children(pagination.items, pagination)}
      <PaginationControls
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalItems={pagination.totalItems}
        totalPages={pagination.totalPages}
        startIndex={pagination.startIndex}
        endIndex={pagination.endIndex}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
        pageSizeOptions={pageSizeOptions}
        label={label}
        sortOrder={sortOrder}
        onSortOrderChange={
          canSortByDate
            ? (nextSortOrder) => {
                setSortOrder(nextSortOrder);
                setPage(1);
              }
            : undefined
        }
      />
    </div>
  );
}
