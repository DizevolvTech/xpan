"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  label?: string;
}

export function PaginationControls({
  page,
  pageSize,
  totalItems,
  totalPages,
  startIndex,
  endIndex,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 30, 50],
  label = "registros",
}: PaginationControlsProps) {
  const from = totalItems === 0 ? 0 : startIndex + 1;
  const to = endIndex;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-panel px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span>
          Mostrando <strong className="text-foreground">{from}</strong> a {" "}
          <strong className="text-foreground">{to}</strong> de {" "}
          <strong className="text-foreground">{totalItems}</strong> {label}
        </span>

        <label className="inline-flex items-center gap-2">
          <span>Por página</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          aria-label="Primeira página"
        >
          <ChevronsLeft className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <span className="px-2 text-xs font-semibold text-foreground">
          Página {page} de {totalPages}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Próxima página"
        >
          <ChevronRight className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          aria-label="Última página"
        >
          <ChevronsRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
