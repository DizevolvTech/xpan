"use client";

import { weightDisplayUnitShortLabels, type WeightDisplayUnit } from "@/lib/weight-display";

type WeightUnitToggleProps = {
  value: WeightDisplayUnit;
  onChange: (next: WeightDisplayUnit) => void;
  className?: string;
  disabled?: boolean;
};

const OPTIONS: WeightDisplayUnit[] = ["kg", "g"];

/**
 * Escolha "Quilos (Kg) / Gramas (g)" no momento de ver ou emitir a OP. Só muda a APRESENTAÇÃO:
 * o cadastro e o banco seguem em Kg. Dois botões em vez de <select> porque são só duas opções e
 * o operador de chão precisa ver o estado atual sem abrir nada.
 */
export function WeightUnitToggle({ value, onChange, className, disabled }: WeightUnitToggleProps) {
  return (
    <div
      role="group"
      aria-label="Unidade de peso da OP"
      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-muted-foreground ${className ?? ""}`}
    >
      <span className="font-semibold uppercase tracking-[0.06em]">Peso em</span>
      <div className="inline-flex shrink-0 overflow-hidden rounded-md border border-border-strong/40">
        {OPTIONS.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={
                active
                  ? "cursor-pointer bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                  : "cursor-pointer bg-surface px-3 py-1 text-xs font-semibold text-foreground hover:bg-secondary"
              }
            >
              {weightDisplayUnitShortLabels[option]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
