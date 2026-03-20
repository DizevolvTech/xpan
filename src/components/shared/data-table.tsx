"use client";

import { useMemo, useState } from "react";

import {
  hasTemporalSortValue,
  sortItemsByTemporalValue,
  type TemporalSortOrder,
} from "@/lib/temporal-table-sort";
import { cn, formatKgValue } from "@/lib/utils";
import { LucideIcon, Eye, Pencil, Trash2, Printer, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { paginateArray } from "@/lib/pagination";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
}

interface Action<T> {
  icon: "view" | "edit" | "delete" | "print" | "add" | "user";
  label: string;
  onClick: (item: T) => void;
  variant?: "default" | "destructive" | "outline";
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  actions?: Action<T>[];
  keyField: keyof T;
  emptyMessage?: string;
  isLoading?: boolean;
  rowClassName?: (item: T) => string;
  onRowClick?: (item: T) => void;
  isRowClickable?: (item: T) => boolean;
  isRowExpanded?: (item: T) => boolean;
  renderExpandedRow?: (item: T) => React.ReactNode;
  pagination?: boolean;
  paginationLabel?: string;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  stickyHeader?: boolean;
  compact?: boolean;
  temporalSortKeys?: string[];
  showFooterControls?: boolean;
  tableClassName?: string;
  emptyStateAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
}

function formatDefaultCellValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "number" && Number.isFinite(value) && key.toLowerCase().includes("kg")) {
    return formatKgValue(value);
  }

  return String(value);
}

export function DataTable<T extends object>({
  data,
  columns,
  actions,
  keyField,
  emptyMessage = "Nenhum registro encontrado",
  isLoading,
  rowClassName,
  onRowClick,
  isRowClickable,
  isRowExpanded,
  renderExpandedRow,
  pagination = true,
  paginationLabel = "registros",
  initialPageSize = 10,
  pageSizeOptions,
  stickyHeader = false,
  compact = false,
  temporalSortKeys,
  showFooterControls = true,
  tableClassName,
  emptyStateAction,
}: DataTableProps<T>) {
  const actionIcons: Record<string, LucideIcon> = {
    view: Eye,
    edit: Pencil,
    delete: Trash2,
    print: Printer,
    add: Plus,
    user: UserRound,
  };
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortOrder, setSortOrder] = useState<TemporalSortOrder>("recent_first");
  const canSortByDate = useMemo(
    () => hasTemporalSortValue(data, temporalSortKeys),
    [data, temporalSortKeys],
  );
  const sortedData = useMemo(
    () => (canSortByDate ? sortItemsByTemporalValue(data, sortOrder, temporalSortKeys) : data),
    [canSortByDate, data, sortOrder, temporalSortKeys],
  );
  const paginated = useMemo(
    () => paginateArray(sortedData, page, pageSize),
    [page, pageSize, sortedData],
  );

  const footerPagination = useMemo(
    () =>
      pagination
        ? paginated
        : paginateArray(sortedData, 1, Math.max(sortedData.length, 1)),
    [paginated, pagination, sortedData],
  );
  const visibleData = pagination ? paginated.items : sortedData;

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-border/80 bg-card shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Carregando registros...
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-44 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong/35 bg-card px-6 text-center shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        {emptyStateAction && (
          <Button type="button" variant="outline" size="sm" onClick={emptyStateAction.onClick}>
            {emptyStateAction.icon && <emptyStateAction.icon className="mr-1.5 size-4" />}
            {emptyStateAction.label}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/80 bg-card shadow-[var(--shadow-soft)]">
        <div className="overflow-x-auto overscroll-x-contain">
        <table
          className={cn(
            "w-full min-w-[640px] border-collapse bg-card xl:min-w-full",
            tableClassName,
          )}
        >
          <thead
            className={cn(
              "border-b border-border/70 bg-panel",
              stickyHeader && "sticky top-0 z-10",
            )}
          >
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "whitespace-nowrap px-4 text-left text-xs font-semibold text-muted-foreground/95",
                    compact ? "py-2.5" : "py-3.5",
                  )}
                >
                  {column.header}
                </th>
              ))}
              {actions && actions.length > 0 && (
                <th
                  className={cn(
                    "w-px whitespace-nowrap px-4 text-right text-xs font-semibold text-muted-foreground/95",
                    compact ? "py-2.5" : "py-3.5",
                  )}
                >
                  Ações
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {visibleData.flatMap((item) => {
              const rowClickable = onRowClick ? (isRowClickable?.(item) ?? true) : false;
              const handleRowClick = onRowClick;
              const rowExpanded = isRowExpanded?.(item) ?? false;
              const rowKey = String(item[keyField]);
              const cellsCount = columns.length + (actions && actions.length > 0 ? 1 : 0);

              return [
                <tr
                  key={rowKey}
                  className={cn(
                    "transition-colors duration-200 hover:bg-panel/45",
                    rowClickable && "cursor-pointer",
                    rowExpanded && "bg-primary/[0.04]",
                    rowClassName?.(item),
                  )}
                  onClick={
                    rowClickable
                      ? (event) => {
                          const target = event.target as HTMLElement;
                          if (
                            target.closest(
                              "button, a, input, select, textarea, [role='button'], [data-stop-row-click='true']",
                            )
                          ) {
                            return;
                          }
                          handleRowClick?.(item);
                        }
                      : undefined
                  }
                >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "align-top border-t border-border/70 px-4 text-sm text-foreground",
                      rowExpanded
                        ? "bg-primary/[0.05] first:border-l-2 first:border-l-primary"
                        : "bg-card",
                      compact ? "py-2.5" : "py-3",
                    )}
                  >
                    {column.render
                      ? column.render(item)
                      : formatDefaultCellValue(column.key, (item as Record<string, unknown>)[column.key])}
                  </td>
                ))}

                {actions && actions.length > 0 && (
                  <td
                    className={cn(
                      "align-top border-t border-border/70 px-4 text-right",
                      rowExpanded
                        ? "bg-primary/[0.05] first:border-l-2 first:border-l-primary"
                        : "bg-card",
                      compact ? "py-2.5" : "py-3",
                    )}
                  >
                    <div className="flex flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap">
                      {actions.map((action, actionIndex) => {
                        const Icon = actionIcons[action.icon];
                        const isDestructive = action.variant === "destructive";
                        return (
                          <Button
                            key={actionIndex}
                            type="button"
                            variant={isDestructive ? "ghost" : action.variant || "ghost"}
                            size="icon-sm"
                            className={cn(
                              "transition-colors duration-200",
                              isDestructive
                                ? "text-danger-foreground/80 hover:bg-danger/40 hover:text-danger-foreground"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                            onClick={(event) => {
                              event.stopPropagation();
                              action.onClick(item);
                            }}
                            title={action.label}
                            aria-label={action.label}
                          >
                            <Icon className="size-4" />
                          </Button>
                        );
                      })}
                    </div>
                  </td>
                )}
                </tr>,
                rowExpanded && renderExpandedRow ? (
                  <tr key={`${rowKey}-expanded`}>
                    <td
                      colSpan={cellsCount}
                      className="border-t border-border/60 bg-primary/[0.03] px-4 pb-4 pt-0"
                    >
                      {renderExpandedRow(item)}
                    </td>
                  </tr>
                ) : null,
              ].filter(Boolean);
            })}
          </tbody>
        </table>
        </div>
      </div>

      {showFooterControls && (pagination || canSortByDate) ? (
        <PaginationControls
          page={footerPagination.page}
          pageSize={footerPagination.pageSize}
          totalItems={footerPagination.totalItems}
          totalPages={footerPagination.totalPages}
          startIndex={footerPagination.startIndex}
          endIndex={footerPagination.endIndex}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
          pageSizeOptions={pageSizeOptions}
          label={paginationLabel}
          sortOrder={sortOrder}
          onSortOrderChange={
            canSortByDate
              ? (nextSortOrder) => {
                  setSortOrder(nextSortOrder);
                  setPage(1);
                }
              : undefined
          }
          showPageSize={pagination}
          showNavigation={pagination}
        />
      ) : null}
    </div>
  );
}
