"use client";

import type { ReactNode } from "react";

import type { OpDayGroup, OpDayKind } from "@/lib/op-day-groups";
import { cn } from "@/lib/utils";

export interface OpDayTableColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
}

const KIND_STYLE: Record<OpDayKind, string> = {
  atrasada: "bg-danger/10 text-danger-foreground ring-danger/30",
  hoje: "bg-info/10 text-info-foreground ring-info/30",
  futura: "bg-panel text-muted-foreground ring-border/60",
  encerrada: "bg-panel text-muted-foreground ring-border/60",
};

function formatDay(date: string) {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
  return `${weekday.replace(".", "")} ${day}/${month}/${year}`;
}

function kindLabel(group: { kind: OpDayKind; daysLate: number }) {
  if (group.kind === "atrasada") return `Atrasada · ${group.daysLate} dia${group.daysLate === 1 ? "" : "s"}`;
  if (group.kind === "hoje") return "Produzir hoje";
  if (group.kind === "futura") return "Futura";
  return "Encerrada";
}

/**
 * Fila de OPs agrupada por dia de produção, com linhas compactas (cabem mais OPs na tela
 * pequena do chão). Atrasadas em vermelho; futuras só aparecem quando a tela pede.
 */
export function OpDayGroupsTable<T extends { id: string }>({
  groups,
  columns,
  onRowClick,
  isRowClickable,
  rowClassName,
  emptyMessage,
}: {
  groups: OpDayGroup<T>[];
  columns: OpDayTableColumn<T>[];
  onRowClick?: (item: T) => void;
  isRowClickable?: (item: T) => boolean;
  rowClassName?: (item: T) => string;
  emptyMessage: string;
}) {
  if (groups.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/80" data-testid="op-day-groups">
      <table className="w-full min-w-[640px] border-collapse">
        <thead className="sticky top-0 z-10 bg-panel">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground",
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.date} data-group-kind={group.kind}>
            <tr>
              <th
                colSpan={columns.length}
                className={cn(
                  "border-t border-border/70 px-2.5 py-1 text-left text-xs font-semibold ring-1 ring-inset",
                  KIND_STYLE[group.kind],
                )}
              >
                <span className="uppercase tracking-[0.06em]">Produzir {formatDay(group.date)}</span>
                <span className="ml-2 font-medium">
                  · {kindLabel(group)} · {group.ops.length} OP{group.ops.length === 1 ? "" : "s"}
                </span>
              </th>
            </tr>
            {group.ops.map((item) => {
              const clickable = onRowClick && (isRowClickable ? isRowClickable(item) : true);
              return (
                <tr
                  key={item.id}
                  onClick={clickable ? () => onRowClick(item) : undefined}
                  className={cn(
                    "border-t border-border/60 bg-card text-sm",
                    clickable && "cursor-pointer hover:bg-muted/40",
                    rowClassName?.(item),
                  )}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={cn("px-2.5 py-1 align-middle", column.className)}>
                      {column.render
                        ? column.render(item)
                        : String((item as Record<string, unknown>)[column.key] ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
