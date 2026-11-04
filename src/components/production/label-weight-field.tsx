"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatLabelWeight,
  labelWeightDraftFromKg,
  parseLabelWeight,
  sanitizeLabelWeightInput,
} from "@/lib/product-form-logic";

type LabelWeightFieldProps = {
  valueKg: number | null | undefined;
  onChange: (valueKg: number | null) => void;
};

/**
 * Peso da etiqueta (Inmetro): campo livre enquanto digita (aceita "0,4", ",4", "0.4"; apagar
 * deixa vazio) e só ao sair formata "0,400 kg".
 */
export function LabelWeightField({ valueKg, onChange }: LabelWeightFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="grid gap-2">
      <Label htmlFor="product-label-weight">Peso da etiqueta</Label>
      <Input
        id="product-label-weight"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,000 kg"
        value={draft ?? formatLabelWeight(valueKg)}
        onFocus={(event) => {
          setDraft(labelWeightDraftFromKg(valueKg));
          event.currentTarget.select();
        }}
        onChange={(event) => {
          const text = sanitizeLabelWeightInput(event.target.value);
          setDraft(text);
          onChange(parseLabelWeight(text));
        }}
        onBlur={() => setDraft(null)}
      />
      <p className="text-xs text-muted-foreground">
        Peso do rótulo (Inmetro). Não é o peso de produção e não entra no rendimento.
      </p>
    </div>
  );
}
