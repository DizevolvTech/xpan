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
  observationLabel?: string;
  metadataPlaceholder?: string;
  observationPlaceholder?: string;
  showWeightKg?: boolean;
  disabled?: boolean;
}

export function IngredientProfileFields({
  profile,
  unitOptions,
  onChange,
  title,
  description,
  metadataLabel = "Metadados",
  observationLabel = "Observação",
  metadataPlaceholder,
  observationPlaceholder,
  showWeightKg = true,
  disabled = false,
}: IngredientProfileFieldsProps) {
  const weightLocked = profile.unit === "Kg";

  return (
    <section className="space-y-4 rounded-xl border border-border/80 p-4">
      {(title || description) && (
        <div>
          {title ? <h3 className="text-sm font-semibold text-foreground">{title}</h3> : null}
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
      )}

      <div className={`grid gap-4 ${showWeightKg ? "md:grid-cols-2" : ""}`}>
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

        <div className="grid gap-2">
          <Label>{metadataLabel}</Label>
          <Input
            value={profile.metadata}
            disabled={disabled}
            onChange={(event) => onChange({ metadata: event.target.value })}
            placeholder={metadataPlaceholder}
          />
        </div>

        <div className="grid gap-2">
          <Label>{observationLabel}</Label>
          <Textarea
            value={profile.observation}
            disabled={disabled}
            onChange={(event) => onChange({ observation: event.target.value })}
            className="min-h-[88px]"
            placeholder={observationPlaceholder}
          />
        </div>
      </div>
    </section>
  );
}
