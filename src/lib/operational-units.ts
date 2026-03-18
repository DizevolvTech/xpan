import type { UnitCode } from "@/lib/factory-planning/units";

export const preferredOperationalUnits = ["Kg", "L", "Un"] as const satisfies readonly UnitCode[];

export function getOperationalUnitOptions(...currentValues: Array<UnitCode | null | undefined>) {
  const legacyValues = currentValues.filter(
    (value): value is UnitCode =>
      Boolean(value) && !preferredOperationalUnits.includes(value as (typeof preferredOperationalUnits)[number]),
  );

  return [...new Set<UnitCode>([...preferredOperationalUnits, ...legacyValues])];
}

export function getOperationalUnitLabel(unit: UnitCode) {
  if (preferredOperationalUnits.includes(unit as (typeof preferredOperationalUnits)[number])) {
    return unit;
  }

  return `${unit} (legado)`;
}
