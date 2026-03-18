"use client";

import { useMemo, useState } from "react";

import { paginateArray, type PaginatedResult } from "@/lib/pagination";
import { PaginationControls } from "@/components/shared/pagination-controls";

interface PaginatedSectionProps<T> {
  items: T[];
  label?: string;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  children: (items: T[], pagination: PaginatedResult<T>) => React.ReactNode;
}

export function PaginatedSection<T>({
  items,
  label = "registros",
  initialPageSize = 10,
  pageSizeOptions,
  children,
}: PaginatedSectionProps<T>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const pagination = useMemo(() => paginateArray(items, page, pageSize), [items, page, pageSize]);

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
      />
    </div>
  );
}
