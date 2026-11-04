"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatLabelWeight, parseLabelWeight } from "@/lib/product-form-logic";

type LabelWeightFieldProps = {
  valueKg: number | null | undefined;
  onChange: (valueKg: number | null) => void;
};

/** Peso da etiqueta (Inmetro): mostra "0,400 kg" fora da edição e aceita "0,4" ao digitar. */
export function LabelWeightField({ valueKg, onChange }: LabelWeightFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="grid gap-2">
      <Label htmlFor="product-label-weight">Peso da etiqueta</Label>
      <Input
        id="product-label-weight"
        inputMode="decimal"
        placeholder="0,000 kg"
        value={draft ?? formatLabelWeight(valueKg)}
        onFocus={() => setDraft(valueKg != null ? String(valueKg).replace(".", ",") : "")}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(parseLabelWeight(event.target.value));
        }}
        onBlur={() => setDraft(null)}
      />
      <p className="text-xs text-muted-foreground">
        Peso do rótulo (Inmetro). Não é o peso de produção e não entra no rendimento.
      </p>
    </div>
  );
}
