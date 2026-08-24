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
  recipeYieldKg?: number;
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
  showRecipeYieldKg?: boolean;
  recipeYieldPlaceholderKg?: number;
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
  showRecipeYieldKg = false,
  recipeYieldPlaceholderKg,
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

      <div className={`grid gap-4 ${showWeightKg || showRecipeYieldKg ? "md:grid-cols-2" : ""}`}>
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
            <Label htmlFor="ingredient-profile-weight-kg">Peso padrão da unidade (Kg)</Label>
            <Input
              id="ingredient-profile-weight-kg"
              type="number"
              step="0.001"
              min="0"
              value={weightLocked ? 1 : (profile.weightKg ?? "")}
              disabled={disabled || weightLocked}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                onChange({
                  weightKg: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Usado quando a receita pede este item em Un, Dz ou outra unidade discreta. Ex.: 1 Un
              de pão de ló = 0,170 kg — nunca assumir 1 kg.
            </p>
          </div>
        ) : null}

        {showRecipeYieldKg ? (
          <div className="grid gap-2">
            <Label htmlFor="ingredient-profile-recipe-yield-kg">Rendimento da Receita (Kg)</Label>
            <Input
              id="ingredient-profile-recipe-yield-kg"
              type="number"
              step="0.001"
              min="0"
              value={profile.recipeYieldKg ?? ""}
              disabled={disabled}
              placeholder={
                recipeYieldPlaceholderKg != null && recipeYieldPlaceholderKg > 0
                  ? recipeYieldPlaceholderKg.toFixed(3)
                  : "Ex: 0.293"
              }
              onChange={(event) => {
                const parsed = Number(event.target.value);
                onChange({
                  recipeYieldKg: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Peso real que esta MPI rende por batelada. Quando ela for usada em outra receita, as
              quantidades e o custo são proporcionais a este rendimento — não a 1 kg fixo.
              {recipeYieldPlaceholderKg != null && recipeYieldPlaceholderKg > 0
                ? ` Deixe em branco para usar o rendimento calculado (${recipeYieldPlaceholderKg.toFixed(3)} kg).`
                : ""}
            </p>
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
