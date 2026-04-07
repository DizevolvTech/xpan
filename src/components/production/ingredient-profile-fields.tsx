"use client";

import type { UnitCode } from "@/lib/factory-planning/units";
import { getOperationalUnitLabel } from "@/lib/operational-units";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type IngredientProfileLike = {
  unit: UnitCode;
  weightKg?: number;
  purchaseUnit?: UnitCode;
  purchaseToConsumptionFactor?: number;
  metadata: string;
  observation: string;
};

interface IngredientProfileFieldsProps {
  profile: IngredientProfileLike;
  unitOptions: readonly UnitCode[];
  onChange: (patch: Partial<IngredientProfileLike>) => void;
  title?: string;
  description?: string;
  metadataLabel?: string;
  metadataPlaceholder?: string;
  showPurchaseFields?: boolean;
  purchaseUnitOptions?: readonly UnitCode[];
  purchaseUnitLabel?: string;
  purchaseFactorLabel?: string;
  purchaseHelperText?: string;
  showWeightKg?: boolean;
  disabled?: boolean;
}

export function IngredientProfileFields({
  profile,
  unitOptions,
  onChange,
  title,
  description,
  metadataLabel = "Lembretes",
  metadataPlaceholder = "Notas rápidas sobre este ingrediente",
  showPurchaseFields = false,
  purchaseUnitOptions,
  purchaseUnitLabel = "Unidade de compra",
  purchaseFactorLabel = "Fator de conversão (compra → consumo)",
  purchaseHelperText,
  showWeightKg = true,
  disabled = false,
}: IngredientProfileFieldsProps) {
  const weightLocked = profile.unit === "Kg";
  const normalizedPurchaseUnitOptions = purchaseUnitOptions ?? unitOptions;

  return (
    <section className="space-y-4 rounded-xl border border-border/80 p-4">
      {(title || description) && (
        <div>
          {title ? <h3 className="text-sm font-semibold text-foreground">{title}</h3> : null}
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
      )}

      <div className={`grid gap-4 ${showWeightKg ? "md:grid-cols-2" : ""}`}>
        {!showPurchaseFields ? (
          <div className="grid gap-2">
            <Label>Unidade</Label>
            <Select
              value={profile.unit}
              onValueChange={(value) => onChange({ unit: value as UnitCode, weightKg: value === "Kg" ? 1 : profile.weightKg })}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {getOperationalUnitLabel(unit)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {showWeightKg ? (
          <div className="grid gap-2">
            <Label>Peso padrão (Kg)</Label>
            <Input
              type="number"
              step="0.001"
              value={weightLocked ? 1 : profile.weightKg ?? ""}
              disabled={disabled || weightLocked}
              onChange={(event) => onChange({ weightKg: Number(event.target.value) })}
            />
          </div>
        ) : null}

        {showPurchaseFields ? (
          <div className="grid gap-2">
            <Label>{purchaseUnitLabel}</Label>
            <Select
              value={profile.purchaseUnit ?? profile.unit}
              onValueChange={(value) => onChange({ purchaseUnit: value as UnitCode })}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {normalizedPurchaseUnitOptions.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {getOperationalUnitLabel(unit)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {showPurchaseFields ? (
          <div className="grid gap-2">
            <Label>{purchaseFactorLabel}</Label>
            <Input
              type="number"
              step="0.001"
              value={profile.purchaseToConsumptionFactor ?? 1}
              disabled={disabled}
              onChange={(event) => onChange({ purchaseToConsumptionFactor: Number(event.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              {purchaseHelperText
                ?? `1 ${getOperationalUnitLabel(profile.purchaseUnit ?? profile.unit)} = ${profile.purchaseToConsumptionFactor ?? 1} ${getOperationalUnitLabel(profile.unit)}. Ex: ovos — 1 Dz = 600g; óleo — 1 Un(900ml) = 0.810 Kg.`}
            </p>
          </div>
        ) : null}

        <div className="grid gap-2 md:col-span-2">
          <Label>{metadataLabel}</Label>
          <Textarea
            value={profile.metadata}
            disabled={disabled}
            onChange={(event) => onChange({ metadata: event.target.value })}
            className="min-h-[72px]"
            placeholder={metadataPlaceholder}
          />
          <p className="text-xs text-muted-foreground">
            Use este campo para lembretes gerais sobre o ingrediente. Instruções de uso na receita devem ser registradas no campo de observação de cada item da receita.
          </p>
        </div>
      </div>
    </section>
  );
}
