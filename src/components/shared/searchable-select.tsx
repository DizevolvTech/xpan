"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
  description?: string;
  keywords?: string[];
};

type SearchableSelectProps = {
  id?: string;
  ariaInvalid?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  title?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
};

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function SearchableSelect({
  id,
  ariaInvalid = false,
  value,
  onValueChange,
  options,
  placeholder = "Selecione uma opção",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum resultado encontrado.",
  title = "Selecionar opção",
  description,
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );
  const filteredOptions = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(searchTerm);
    if (!normalizedSearch) {
      return options;
    }

    return options.filter((option) => {
      const haystack = normalizeSearchValue(
        [option.label, option.description, ...(option.keywords ?? [])].filter(Boolean).join(" "),
      );
      return haystack.includes(normalizedSearch);
    });
  }, [options, searchTerm]);

  return (
    <>
      <Button
        id={id}
        type="button"
        variant="outline"
        aria-invalid={ariaInvalid}
        className={cn(
          "w-full justify-between bg-background font-normal",
          !selectedOption && "text-muted-foreground",
          className,
        )}
        disabled={disabled}
        onClick={() => {
          setSearchTerm("");
          setOpen(true);
        }}
      >
        <span className="truncate">{selectedOption?.label ?? placeholder}</span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 text-muted-foreground" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg" className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>

          <div className="space-y-3 py-1">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
            />

            <div className="max-h-80 overflow-y-auto rounded-xl border border-border/80 bg-card">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">{emptyMessage}</div>
              ) : (
                <div className="divide-y divide-border/70">
                  {filteredOptions.map((option) => {
                    const isSelected = option.value === value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-panel/50"
                        onClick={() => {
                          onValueChange(option.value);
                          setOpen(false);
                        }}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {option.label}
                          </p>
                          {option.description ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {option.description}
                            </p>
                          ) : null}
                        </div>
                        <Check
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            isSelected ? "text-primary" : "text-transparent",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
