"use client";

import { cn } from "@/lib/utils";
import { LucideIcon, Eye, Pencil, Trash2, Printer, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  stickyHeader?: boolean;
  compact?: boolean;
  emptyStateAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
}

export function DataTable<T extends object>({
  data,
  columns,
  actions,
  keyField,
  emptyMessage = "Nenhum registro encontrado",
  isLoading,
  rowClassName,
  stickyHeader = false,
  compact = false,
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
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-[var(--shadow-soft)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse bg-card">
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
                    "px-4 text-left text-xs font-semibold text-muted-foreground/95",
                    compact ? "py-2.5" : "py-3.5",
                  )}
                >
                  {column.header}
                </th>
              ))}
              {actions && actions.length > 0 && (
                <th
                  className={cn(
                    "px-4 text-right text-xs font-semibold text-muted-foreground/95",
                    compact ? "py-2.5" : "py-3.5",
                  )}
                >
                  Ações
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {data.map((item) => (
              <tr
                key={String(item[keyField])}
                className={cn(
                  "transition-colors duration-200 hover:bg-panel/45",
                  rowClassName?.(item),
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "border-t border-border/70 bg-card px-4 text-sm text-foreground",
                      compact ? "py-2.5" : "py-3",
                    )}
                  >
                    {column.render
                      ? column.render(item)
                      : String((item as Record<string, unknown>)[column.key] ?? "-")}
                  </td>
                ))}

                {actions && actions.length > 0 && (
                  <td
                    className={cn(
                      "border-t border-border/70 bg-card px-4 text-right",
                      compact ? "py-2.5" : "py-3",
                    )}
                  >
                    <div className="flex items-center justify-end gap-1.5">
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
                            onClick={() => action.onClick(item)}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
