"use client";

import { Filter, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FilterOption = {
  value: string;
  label: string;
};

type FilterField = {
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
};

interface OperationFiltersCardProps {
  title?: string;
  summary?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  searchValue: string;
  onSearch: (value: string) => void;
  fields: FilterField[];
  activeFiltersCount: number;
  helperText?: string;
  onClear: () => void;
  clearLabel?: string;
  className?: string;
}

export function OperationFiltersCard({
  title = "Filtros",
  summary,
  searchLabel = "Busca",
  searchPlaceholder = "Buscar...",
  searchValue,
  onSearch,
  fields,
  activeFiltersCount,
  helperText = "Ajuste os filtros para reduzir o volume da fila.",
  onClear,
  clearLabel = "Limpar filtros",
  className,
}: OperationFiltersCardProps) {
  const gridClass =
    fields.length >= 4
      ? "xl:grid-cols-6"
      : fields.length === 3
        ? "xl:grid-cols-5"
        : fields.length === 2
          ? "xl:grid-cols-4"
          : "xl:grid-cols-3";

  return (
    <div className={cn("rounded-xl border border-border/70 bg-panel/55 p-3 sm:p-4", className)}>
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Filter className="size-3.5" />
          {title}
        </div>
        {summary ? <p className="text-xs text-muted-foreground">{summary}</p> : null}
      </div>

      <div className={cn("grid gap-3 md:grid-cols-2", gridClass)}>
        <div className="space-y-1.5 xl:col-span-2">
          <p className="text-xs font-medium text-muted-foreground">{searchLabel}</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="bg-background/80 pl-9"
            />
          </div>
        </div>

        {fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full bg-background/80">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {field.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-border/65 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-background px-2.5 py-1 font-semibold text-foreground">
            {activeFiltersCount} filtro(s) ativo(s)
          </span>
          <span className="text-muted-foreground">{helperText}</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClear} disabled={activeFiltersCount === 0}>
          {clearLabel}
        </Button>
      </div>
    </div>
  );
}
