"use client";

import { Lock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LabTestComputation } from "@/lib/lab-test";
import type { ProductLabTest } from "@/lib/production-planning";
import { formatLocaleNumber } from "@/lib/utils";

type RecipeTestYieldBlockProps = {
  labTest: ProductLabTest | null | undefined;
  computation: LabTestComputation | null;
  /** Soma dos insumos que participam da cocção (a massa crua do teste). */
  rawDoughKg: number;
  onChange: (patch: Partial<ProductLabTest>) => void;
};

function readOptionalNumber(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatFixed(value: number, digits: number, suffix = "") {
  return `${formatLocaleNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
}

function CalculatedField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="grid gap-1">
      <Label className="flex items-center gap-1 text-muted-foreground">
        <Lock className="size-3" aria-hidden="true" />
        {label}
      </Label>
      <Input readOnly disabled aria-label={label} value={value} className="cursor-not-allowed bg-muted font-medium" />
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Quadro #231: o usuário lança 3 valores; tudo o mais é calculado, bloqueado e fica neste bloco. */
export function RecipeTestYieldBlock({ labTest, computation, rawDoughKg, onChange }: RecipeTestYieldBlockProps) {
  const done = Boolean(computation?.complete);
  const pending = "—";

  return (
    <section className="space-y-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div>
        <h3 className="text-sm font-semibold text-amber-950">3. Rendimento · Teste da receita</h3>
        <p className="text-xs text-amber-900/80">
          Lance só os 3 campos brancos. Os campos bloqueados saem sozinhos do teste e da soma dos insumos que
          participam da cocção.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="test-baked-kg">Kg assado (unidades padrão)</Label>
          <Input
            id="test-baked-kg"
            type="number"
            min="0"
            step="0.001"
            className="border-stone-300 bg-white"
            value={labTest?.bakedKg ?? ""}
            onChange={(event) => onChange({ bakedKg: readOptionalNumber(event.target.value) })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="test-unit-count">Nº de unidades padrão</Label>
          <Input
            id="test-unit-count"
            type="number"
            min="0"
            step="1"
            className="border-stone-300 bg-white"
            value={labTest?.unitCount ?? ""}
            onChange={(event) => onChange({ unitCount: readOptionalNumber(event.target.value) })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="test-leftover-kg">Sobra assada (kg)</Label>
          <Input
            id="test-leftover-kg"
            type="number"
            min="0"
            step="0.001"
            className="border-stone-300 bg-white"
            value={labTest?.leftoverBakedKg ?? ""}
            onChange={(event) => onChange({ leftoverBakedKg: readOptionalNumber(event.target.value) })}
          />
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border border-stone-200 bg-white/60 p-3 sm:grid-cols-2 lg:grid-cols-3">
        <CalculatedField
          label="Massa crua (kg)"
          value={rawDoughKg > 0 ? formatFixed(rawDoughKg, 3, " kg") : pending}
          hint="Soma dos insumos que participam da cocção."
        />
        <CalculatedField
          label="Peso da unidade assada"
          value={done && computation ? formatFixed(computation.bakedUnitKg, 3, " kg") : pending}
          hint="Kg assado ÷ unidades padrão."
        />
        <CalculatedField
          label="Peso assado total"
          value={computation && computation.effectiveBakedKg > 0 ? formatFixed(computation.effectiveBakedKg, 3, " kg") : pending}
          hint="Kg assado + sobra assada."
        />
        <CalculatedField
          label="Nº de unidades efetivas"
          value={done && computation ? formatFixed(computation.effectiveUnitCount, 2) : pending}
          hint="Peso assado total ÷ peso da unidade assada."
        />
        <CalculatedField
          label="Quebra"
          value={done && computation ? formatFixed(computation.breakPercent, 2, "%") : pending}
          hint="(Massa crua − peso assado total) ÷ massa crua."
        />
        <CalculatedField
          label="Rendimento"
          value={done && computation ? formatFixed(computation.yieldPercent, 2, "%") : pending}
          hint="Peso assado total ÷ massa crua."
        />
        <CalculatedField
          label="Peso da unidade crua (uso interno na OP)"
          value={done && computation ? formatFixed(computation.rawUnitWeightKg, 4, " kg") : pending}
          hint="Massa crua ÷ unidades efetivas."
        />
      </div>
    </section>
  );
}
