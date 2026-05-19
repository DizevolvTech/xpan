"use client";

import { Fragment, useMemo, useState } from "react";
import { AlertCircle, ArrowUpDown, ArrowUpRight, ChevronDown, ChevronUp, Eye, LucideIcon, Pencil, Plus, Printer, Trash2, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTableSkeleton, Skeleton } from "@/components/shared/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { paginateArray } from "@/lib/pagination";
import {
  applyColumnSort,
  toggleColumnSort,
  type ColumnSortState,
} from "@/lib/data-table-sort";
import {
  hasTemporalSortValue,
  sortItemsByTemporalValue,
  type TemporalSortOrder,
} from "@/lib/temporal-table-sort";
import { readClientAccessContext } from "@/lib/client-access-context";
import { cn, formatKgValue } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (item: T) => unknown;
  sortComparator?: (left: T, right: T) => number;
}

interface Action<T> {
  icon: "view" | "edit" | "delete" | "print" | "add" | "user" | "alert" | "launch";
  label: string;
  onClick: (item: T) => void;
  variant?: "default" | "destructive" | "outline";
  allowInReadOnly?: boolean;
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
    allowInReadOnly?: boolean;
  };
}

function blocksReadOnlyAction(label: string) {
  return /editar|excluir|inativ|ativar|delegar|perfil|senha|criar|novo|cadastrar|liberar|cancelar|adicionar|salvar|confirmar/i.test(
    label,
  );
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

function isPrimitiveSortValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/* -------------------------------------------------------------------------------------------------
 * UX-0001 — DataTable responsivo (abordagem C, breakpoint `sm`/640px nativo do Tailwind).
 * ≥ sm: o <table><thead><th> de hoje, BYTE-EQUIVALENTE (recorte 1:1 só envolvido por
 * `hidden sm:block`). < sm: uma lista de cards IRMÃ (`sm:hidden`), gerada do MESMO
 * `visibleData`/`columns`/`actions` — cada coluna vira um par <dt>(header)/<dd>(render),
 * ações no rodapé do card (ícone + label, hit-target ≥44px), sort em chips no topo, expand
 * dentro do card. Alternância 100% CSS (hidden/sm:hidden) — zero matchMedia, zero useState de
 * viewport → sem mismatch SSR/CSR, sem flash. Custo aceito: DOM duplicado de ≤pageSize linhas
 * em <sm (o ramo `hidden` não pinta). Loading (UX-0003) e empty (UX-0007) já no arquivo —
 * loading vira 2 ramos (skeleton tabular ≥sm + skeleton de cards <sm, reusando `Skeleton`);
 * empty é intocado (EmptyState já é não-tabular/responsivo). Cor só token + --opacity-*,
 * espaçamento via *-rhythm-*. Ajuste fino da matriz densa `administrador/usuarios`
 * (min-w internos em column.render) é delegado a UX-0016 (Onda 2) — UX-0001 entrega só o
 * comportamento-base. Espelha a gramática de shared/skeleton.tsx / shared/empty-state.tsx.
 * -----------------------------------------------------------------------------------------------*/
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
  const isReadOnlyTenantView = readClientAccessContext().accessMode === "read-only-tenant";
  const actionIcons: Record<string, LucideIcon> = {
    view: Eye,
    edit: Pencil,
    delete: Trash2,
    print: Printer,
    add: Plus,
    user: UserRound,
    alert: AlertCircle,
    launch: ArrowUpRight,
  };
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortOrder, setSortOrder] = useState<TemporalSortOrder>("recent_first");
  const [columnSort, setColumnSort] = useState<ColumnSortState | null>(null);
  const canSortByDate = useMemo(
    () => hasTemporalSortValue(data, temporalSortKeys),
    [data, temporalSortKeys],
  );
  const sortableColumns = useMemo(
    () =>
      new Set(
        columns
          .filter((column) => {
            if (column.sortable === false) {
              return false;
            }
            if (column.sortable === true || column.sortValue || column.sortComparator) {
              return true;
            }

            const sampleValue =
              data.length > 0 ? (data[0] as Record<string, unknown>)[column.key] : undefined;
            return isPrimitiveSortValue(sampleValue);
          })
          .map((column) => column.key),
      ),
    [columns, data],
  );
  const sortResolvers = useMemo(
    () =>
      Object.fromEntries(
        columns.map((column) => [
          column.key,
          column.sortValue ?? ((item: T) => (item as Record<string, unknown>)[column.key]),
        ]),
      ) as Record<string, (item: T) => unknown>,
    [columns],
  );
  const columnSortedData = useMemo(() => {
    if (!columnSort) {
      return null;
    }

    const activeColumn = columns.find((column) => column.key === columnSort.key);
    if (!activeColumn || !sortableColumns.has(columnSort.key)) {
      return data;
    }

    if (activeColumn.sortComparator) {
      const sorted = [...data].sort((left, right) => activeColumn.sortComparator!(left, right));
      return columnSort.direction === "asc" ? sorted : sorted.reverse();
    }

    return applyColumnSort(data, columnSort, sortResolvers);
  }, [columnSort, columns, data, sortResolvers, sortableColumns]);
  const sortedData = useMemo(
    () =>
      columnSort
        ? (columnSortedData ?? data)
        : canSortByDate
          ? sortItemsByTemporalValue(data, sortOrder, temporalSortKeys)
          : data,
    [canSortByDate, columnSort, columnSortedData, data, sortOrder, temporalSortKeys],
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
    const hasActions = Boolean(actions && actions.length > 0);
    return (
      <>
        {/* ≥ sm — skeleton tabular (UX-0003), byte-equivalente: só envolvido pelo wrapper. */}
        <div className="hidden sm:block">
          <DataTableSkeleton
            columns={columns.length}
            hasActions={hasActions}
            compact={compact}
          />
        </div>

        {/* < sm — skeleton de cards (UX-0001), reusa o primitivo Skeleton (UX-0003), sem primitivo novo. */}
        <div
          role="status"
          aria-busy
          aria-label="Carregando registros"
          className="space-y-rhythm-sm sm:hidden"
        >
          <span className="sr-only">Carregando registros</span>
          {Array.from({ length: 3 }).map((_, cardIndex) => (
            <div
              key={cardIndex}
              data-slot="data-card-skeleton"
              aria-hidden
              className="rounded-lg border border-border/[var(--opacity-strong)] bg-card p-rhythm-sm shadow-[var(--shadow-card)]"
            >
              <div className="space-y-rhythm-2xs">
                {Array.from({ length: Math.min(columns.length, 4) }).map(
                  (__, lineIndex) => (
                    <Skeleton key={lineIndex} variant="text" className="h-4" />
                  ),
                )}
              </div>
              {hasActions ? (
                <div className="mt-rhythm-sm flex flex-wrap gap-rhythm-2xs border-t border-border/[var(--opacity-divider)] pt-rhythm-sm">
                  {Array.from({ length: 2 }).map((__, btnIndex) => (
                    <Skeleton
                      key={btnIndex}
                      className="h-11 w-24"
                      rounded="md"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        description={emptyMessage}
        action={
          emptyStateAction
            ? {
                label: emptyStateAction.label,
                onClick: emptyStateAction.onClick,
                icon: emptyStateAction.icon,
                allowInReadOnly: emptyStateAction.allowInReadOnly,
                // Read-only paridade EXATA: reproduz bit-a-bit o `disabled` do
                // bloco anterior (`isReadOnlyTenantView && !allowInReadOnly`).
                // O <Button> outline NÃO auto-bloqueia (UX-0004 só trava
                // default/destructive/submit) → a trava efetiva continua aqui,
                // no consumidor que conhece o contexto de acesso. Afordância
                // desabilitada, NÃO removida (guard-rail R3).
                disabled: isReadOnlyTenantView && !emptyStateAction.allowInReadOnly,
              }
            : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* ≥ sm — DESKTOP, BYTE-EQUIVALENTE: recorte 1:1 do bloco atual, apenas
          envolvido por `hidden sm:block` (UX-0001, abordagem C). Zero classe/
          atributo/lógica alterada dentro do <table>/<thead>/<tbody>. */}
      <div className="hidden sm:block">
      <div className="overflow-hidden rounded-xl border border-border/65 bg-card shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto overscroll-x-contain">
        <table
          className={cn(
            "w-full min-w-[640px] border-collapse bg-card xl:min-w-full",
            tableClassName,
          )}
        >
          <thead
            className={cn(
              "border-b border-border bg-panel/70 backdrop-blur-sm",
              stickyHeader && "sticky top-0 z-10",
            )}
          >
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  aria-sort={
                    columnSort?.key === column.key
                      ? columnSort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className={cn(
                    "whitespace-nowrap px-4 text-left text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground",
                    compact ? "py-2.5" : "py-3.5",
                  )}
                >
                  {sortableColumns.has(column.key) ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                      onClick={() => {
                        setColumnSort((current) => toggleColumnSort(current, column.key));
                        setPage(1);
                      }}
                    >
                      <span>{column.header}</span>
                      {columnSort?.key === column.key ? (
                        columnSort.direction === "asc" ? (
                          <ChevronUp className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-60" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
              {actions && actions.length > 0 && (
                <th
                  className={cn(
                    "w-px whitespace-nowrap px-4 text-right text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground",
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
                    "group/row transition-colors duration-150 hover:bg-accent/[0.05]",
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
                      "align-top border-t border-border/55 px-4 text-sm text-foreground transition-colors duration-150",
                      rowExpanded
                        ? "bg-primary/[0.05] first:border-l-2 first:border-l-primary"
                        : "bg-card group-hover/row:bg-transparent",
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
                      "align-top border-t border-border/55 px-4 text-right transition-colors duration-150",
                      rowExpanded
                        ? "bg-primary/[0.05] first:border-l-2 first:border-l-primary"
                        : "bg-card group-hover/row:bg-transparent",
                      compact ? "py-2.5" : "py-3",
                    )}
                  >
                    <div className="flex flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap">
                      {actions.map((action, actionIndex) => {
                        const Icon = actionIcons[action.icon];
                        const isDestructive = action.variant === "destructive";
                        const isBlockedInReadOnly =
                          isReadOnlyTenantView &&
                          !action.allowInReadOnly &&
                          blocksReadOnlyAction(action.label);
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
                            disabled={isBlockedInReadOnly}
                            allowInReadOnly={action.allowInReadOnly}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (isBlockedInReadOnly) {
                                return;
                              }
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
      </div>

      {/* < sm — CARD empilhado, ADITIVO: mesma fonte (visibleData/columns/
          actions), mesma lógica de sort/ações/expand/read-only. Alternância
          100% CSS (sm:hidden), zero JS de viewport (UX-0001, abordagem C). */}
      <div className="sm:hidden">
        {sortableColumns.size > 0 ? (
          <div
            className="mb-rhythm-sm -mx-1 flex items-center gap-rhythm-2xs overflow-x-auto px-1 pb-1"
            role="group"
            aria-label="Ordenar registros"
          >
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Ordenar
            </span>
            {columns
              .filter((column) => sortableColumns.has(column.key))
              .map((column) => {
                const isActive = columnSort?.key === column.key;
                return (
                  <button
                    key={column.key}
                    type="button"
                    aria-pressed={isActive}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 outline-none focus-visible:border-ring focus-visible:ring-ring/45 focus-visible:ring-[3px]",
                      isActive
                        ? "border-primary/[var(--opacity-strong)] bg-primary/[var(--opacity-faint)] text-foreground"
                        : "border-border/[var(--opacity-strong)] bg-card text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => {
                      setColumnSort((current) => toggleColumnSort(current, column.key));
                      setPage(1);
                    }}
                  >
                    <span>{column.header}</span>
                    {isActive ? (
                      columnSort?.direction === "asc" ? (
                        <ChevronUp className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3.5 opacity-60" />
                    )}
                  </button>
                );
              })}
          </div>
        ) : null}

        <ul
          role="list"
          className="space-y-rhythm-sm"
          aria-label={paginationLabel}
        >
          {visibleData.map((item) => {
            const rowClickable = onRowClick ? (isRowClickable?.(item) ?? true) : false;
            const rowExpanded = isRowExpanded?.(item) ?? false;
            const rowKey = String(item[keyField]);
            const handleCardActivate = () => {
              onRowClick?.(item);
            };
            const isInteractiveTarget = (target: EventTarget | null) =>
              Boolean(
                (target as HTMLElement | null)?.closest(
                  "button, a, input, select, textarea, [role='button'], [data-stop-row-click='true']",
                ),
              );

            return (
              <li key={rowKey}>
                <article
                  data-slot="data-card"
                  className={cn(
                    "rounded-lg border border-border/[var(--opacity-strong)] bg-card p-rhythm-sm shadow-[var(--shadow-card)] transition-colors duration-150",
                    rowExpanded &&
                      "border-l-2 border-l-primary bg-primary/[var(--opacity-faint)]",
                    rowClickable &&
                      "cursor-pointer outline-none focus-visible:border-ring focus-visible:ring-ring/45 focus-visible:ring-[3px]",
                    rowClassName?.(item),
                  )}
                  onClick={
                    rowClickable
                      ? (event) => {
                          if (isInteractiveTarget(event.target)) {
                            return;
                          }
                          handleCardActivate();
                        }
                      : undefined
                  }
                  {...(rowClickable
                    ? {
                        role: "button",
                        tabIndex: 0,
                        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
                          if (event.key !== "Enter" && event.key !== " ") {
                            return;
                          }
                          if (isInteractiveTarget(event.target)) {
                            return;
                          }
                          event.preventDefault();
                          handleCardActivate();
                        },
                      }
                    : {})}
                >
                  <dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-rhythm-sm gap-y-rhythm-2xs">
                    {columns.map((column) => (
                      <Fragment key={column.key}>
                        <dt className="self-start text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {column.header}
                        </dt>
                        <dd className="min-w-0 break-words text-sm text-foreground">
                          {column.render
                            ? column.render(item)
                            : formatDefaultCellValue(
                                column.key,
                                (item as Record<string, unknown>)[column.key],
                              )}
                        </dd>
                      </Fragment>
                    ))}
                  </dl>

                  {actions && actions.length > 0 ? (
                    <div className="mt-rhythm-sm flex flex-wrap items-center gap-rhythm-2xs border-t border-border/[var(--opacity-divider)] pt-rhythm-sm">
                      {actions.map((action, actionIndex) => {
                        const Icon = actionIcons[action.icon];
                        const isDestructive = action.variant === "destructive";
                        const isBlockedInReadOnly =
                          isReadOnlyTenantView &&
                          !action.allowInReadOnly &&
                          blocksReadOnlyAction(action.label);
                        return (
                          <Button
                            key={actionIndex}
                            type="button"
                            variant={isDestructive ? "ghost" : action.variant || "ghost"}
                            size="lg"
                            className={cn(
                              "transition-colors duration-200",
                              isDestructive
                                ? "text-danger-foreground/80 hover:bg-danger/40 hover:text-danger-foreground"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                            disabled={isBlockedInReadOnly}
                            allowInReadOnly={action.allowInReadOnly}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (isBlockedInReadOnly) {
                                return;
                              }
                              action.onClick(item);
                            }}
                            title={action.label}
                            aria-label={action.label}
                          >
                            <Icon className="size-4" />
                            <span>{action.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  ) : null}

                  {rowExpanded && renderExpandedRow ? (
                    <div className="mt-rhythm-sm border-t border-border/[var(--opacity-divider)] pt-rhythm-sm">
                      {renderExpandedRow(item)}
                    </div>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ul>
      </div>

      {showFooterControls && (pagination || (canSortByDate && !columnSort)) ? (
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
            canSortByDate && !columnSort
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
