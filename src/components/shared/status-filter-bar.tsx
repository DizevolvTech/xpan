"use client";

import { Button } from "@/components/ui/button";
import type { ListStatusFilterControl } from "@/lib/use-list-status-filter";
import { cn } from "@/lib/utils";

/**
 * Barra de status das listas: chips de multi-seleção + "Ver histórico" + "Salvar como padrão".
 * Sem nada marcado, a lista mostra só as pendências (finalizados ficam no histórico).
 */
export function StatusFilterBar({
  control,
  options,
  onChange,
  className,
}: {
  control: ListStatusFilterControl;
  options: Array<{ value: string; label: string }>;
  onChange?: () => void;
  className?: string;
}) {
  const { state } = control;
  const hasSelection = state.selected.length > 0;
  return (
    <div className={cn("rounded-xl border border-border/70 bg-panel/55 p-3 sm:p-4", className)}>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por status">
        <span className="text-xs font-medium text-muted-foreground">Status:</span>
        {options.map((option) => {
          const active = state.selected.includes(option.value);
          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              onClick={() => {
                control.toggleStatus(option.value);
                onChange?.();
              }}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/65 pt-3 text-xs">
        <Button
          type="button"
          size="sm"
          variant={state.showHistory ? "default" : "outline"}
          aria-pressed={state.showHistory}
          disabled={hasSelection}
          title={hasSelection ? "Com status escolhidos, só eles aparecem" : "Mostrar também as finalizadas"}
          onClick={() => {
            control.setShowHistory(!state.showHistory);
            onChange?.();
          }}
        >
          Ver histórico
        </Button>
        <span className="text-muted-foreground">
          {hasSelection
            ? "Mostrando só os status escolhidos."
            : state.showHistory
              ? "Mostrando tudo, inclusive finalizadas."
              : "Mostrando só as pendências."}
        </span>
        <span className="flex-1" />
        <Button type="button" size="sm" variant="ghost" onClick={control.saveAsDefault}>
          Salvar como padrão desta página
        </Button>
        {control.hasSavedDefault ? (
          <Button type="button" size="sm" variant="ghost" onClick={control.clearSavedDefault}>
            Remover padrão salvo
          </Button>
        ) : null}
      </div>
    </div>
  );
}
