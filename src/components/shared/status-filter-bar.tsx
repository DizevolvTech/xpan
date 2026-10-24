"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ListStatusFilterControl } from "@/lib/use-list-status-filter";
import { cn } from "@/lib/utils";

/**
 * Barra de status das listas, compacta (uma faixa): chips de multi-seleção + "Ver histórico"
 * + padrão salvo no usuário. Sem nada marcado, a lista mostra só as pendências.
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
  const [justSaved, setJustSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => setJustSaved(null), 2500);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-xl border border-border/70 bg-panel/55 px-3 py-2",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por status">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Status:</span>
        {options.map((option) => {
          const active = state.selected.includes(option.value);
          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              className="h-7 px-2.5 text-xs"
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
        <Button
          type="button"
          size="sm"
          className="h-7 px-2.5 text-xs"
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
        {control.isCustom ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => {
              control.reset();
              onChange?.();
            }}
          >
            Limpar
          </Button>
        ) : null}
      </div>
      <span className="text-xs text-muted-foreground" aria-live="polite">
        {hasSelection
          ? "· só os status escolhidos"
          : state.showHistory
            ? "· tudo, inclusive finalizadas"
            : "· só as pendências"}
      </span>
      <span className="flex-1" />
      <div className="flex flex-wrap items-center gap-1 text-xs">
        {control.saveError ? <span className="text-destructive">{control.saveError}</span> : null}
        {justSaved ? <span className="text-emerald-700 dark:text-emerald-400">{justSaved}</span> : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          disabled={control.saving}
          title="Fica salvo no seu usuário e vale em qualquer computador"
          onClick={async () => {
            if (await control.saveAsDefault()) setJustSaved("Padrão salvo no seu usuário");
          }}
        >
          {control.saving ? "Salvando…" : "Salvar como meu padrão"}
        </Button>
        {control.hasSavedDefault ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={control.saving}
            onClick={async () => {
              if (await control.clearSavedDefault()) setJustSaved("Padrão removido");
            }}
          >
            Remover meu padrão
          </Button>
        ) : null}
      </div>
    </div>
  );
}
