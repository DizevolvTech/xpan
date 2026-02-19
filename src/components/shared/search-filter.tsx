"use client";

import { Filter, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchFilterProps {
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  searchValue?: string;
  filters?: {
    key: string;
    label: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
    value?: string;
  }[];
  showFilters?: boolean;
  className?: string;
}

export function SearchFilter({
  searchPlaceholder = "Buscar...",
  onSearch,
  searchValue,
  filters = [],
  showFilters = true,
  className,
}: SearchFilterProps) {
  return (
    <div className={className}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            className="pl-9"
            value={searchValue}
            onChange={(e) => onSearch?.(e.target.value)}
          />
        </div>

        {showFilters && filters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <Filter className="size-3.5" />
              Filtros
            </div>
            {filters.map((filter) => (
              <Select key={filter.key} onValueChange={filter.onChange} value={filter.value}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
