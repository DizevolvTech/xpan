import type {
  ProductLabTest,
  ProductionProduct,
  ProductUnitProfile,
} from "@/lib/production-planning";

/**
 * Cálculos da ficha amarela (S1).
 *
 * O usuário NÃO digita quebra nem rendimento. Ele lança medições de laboratório;
 * o sistema deriva os parâmetros — iguais às planilhas (Pão de Fubá / OP Pães Chama / panetone)
 * e à notação de padaria:
 *
 *   quebra     = 1 − (kg_assados_efetivos / massa_crua)
 *   rendimento = kg_assados_efetivos / massa_crua
 *   unidade_assada = kg_assados_efetivos / unidades
 *
 * Baker's % = 100 × (ingrediente / principal `isMain`). True % = 100 × (ingrediente / total).
 * O motor de OP usa kg unitário, nunca as porcentagens.
 */

export function round6(value: number) {
  return Number(value.toFixed(6));
}

export function emptyLabTest(): ProductLabTest {
  return {
    rawUnitWeightKg: null,
    rawDoughKg: null,
    bakedKg: null,
    leftoverBakedKg: null,
    unitCount: null,
    labelWeightKg: null,
  };
}

function optionalFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric;
}

function optionalNonNegativeNumber(value: unknown): number | null {
  const numeric = optionalFiniteNumber(value);
  if (numeric == null || numeric < 0) {
    return null;
  }
  return numeric;
}

export function normalizeLabTest(value: unknown): ProductLabTest | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== "object") {
    return emptyLabTest();
  }
  const raw = value as Record<string, unknown>;
  return {
    rawUnitWeightKg: optionalNonNegativeNumber(raw.rawUnitWeightKg),
    rawDoughKg: optionalNonNegativeNumber(raw.rawDoughKg),
    bakedKg: optionalNonNegativeNumber(raw.bakedKg),
    leftoverBakedKg: optionalNonNegativeNumber(raw.leftoverBakedKg),
    unitCount: optionalNonNegativeNumber(raw.unitCount),
    labelWeightKg: optionalNonNegativeNumber(raw.labelWeightKg),
  };
}

export interface LabTestComputation {
  complete: boolean;
  rawDoughKg: number;
  usedRecipeSumAsRawDough: boolean;
  leftoverBakedKg: number;
  effectiveBakedKg: number;
  breakKg: number;
  breakPercent: number;
  yieldPercent: number;
  unitCount: number;
  bakedUnitKg: number;
  bakedUnitGrams: number;
  labelWeightKg: number | null;
}

export function computeLabTest(input: {
  recipeTotalKg: number;
  labTest?: ProductLabTest | null;
}): LabTestComputation | null {
  const lab = input.labTest;
  if (!lab) {
    return null;
  }

  const recipeTotalKg =
    Number.isFinite(input.recipeTotalKg) && input.recipeTotalKg > 0 ? input.recipeTotalKg : 0;
  const measuredRaw = lab.rawDoughKg != null && lab.rawDoughKg > 0 ? lab.rawDoughKg : null;
  const rawDoughKg = measuredRaw ?? recipeTotalKg;
  const usedRecipeSumAsRawDough = measuredRaw == null;
  const leftoverBakedKg = lab.leftoverBakedKg != null && lab.leftoverBakedKg > 0 ? lab.leftoverBakedKg : 0;
  const bakedKg = lab.bakedKg != null && lab.bakedKg > 0 ? lab.bakedKg : 0;
  const unitCount = lab.unitCount != null && lab.unitCount > 0 ? lab.unitCount : 0;
  const effectiveBakedKg = bakedKg - leftoverBakedKg;
  const complete = rawDoughKg > 0 && effectiveBakedKg > 0 && unitCount > 0 && effectiveBakedKg <= rawDoughKg;

  if (!complete) {
    return {
      complete: false,
      rawDoughKg,
      usedRecipeSumAsRawDough,
      leftoverBakedKg,
      effectiveBakedKg: Math.max(0, effectiveBakedKg),
      breakKg: 0,
      breakPercent: 0,
      yieldPercent: 0,
      unitCount,
      bakedUnitKg: 0,
      bakedUnitGrams: 0,
      labelWeightKg: lab.labelWeightKg,
    };
  }

  const breakKg = rawDoughKg - effectiveBakedKg;
  const yieldRatio = effectiveBakedKg / rawDoughKg;
  const bakedUnitKg = effectiveBakedKg / unitCount;

  return {
    complete: true,
    rawDoughKg,
    usedRecipeSumAsRawDough,
    leftoverBakedKg,
    effectiveBakedKg,
    breakKg,
    breakPercent: (1 - yieldRatio) * 100,
    yieldPercent: yieldRatio * 100,
    unitCount,
    bakedUnitKg,
    bakedUnitGrams: bakedUnitKg * 1000,
    labelWeightKg: lab.labelWeightKg,
  };
}

/** kg do insumo por 1 unidade apurada no teste — 6 casas, como na OP Pães Chama. */
export function ingredientKgPerFinishedUnit(ingredientKg: number, unitCount: number) {
  if (!Number.isFinite(ingredientKg) || !Number.isFinite(unitCount) || unitCount <= 0) {
    return null;
  }
  return round6(ingredientKg / unitCount);
}

/** Demanda da OP: unitário × unidades a produzir. */
export function scaleIngredientForUnits(
  ingredientKg: number,
  labUnitCount: number,
  produceUnits: number,
) {
  const unitario = ingredientKgPerFinishedUnit(ingredientKg, labUnitCount);
  if (unitario == null || !Number.isFinite(produceUnits) || produceUnits < 0) {
    return null;
  }
  return round6(unitario * produceUnits);
}

export interface BakerPercentages {
  overMain: number | null;
  overTotal: number | null;
}

export function bakerPercents(
  ingredientKg: number,
  mainKg: number,
  totalKg: number,
): BakerPercentages {
  return {
    overMain: mainKg > 0 && Number.isFinite(ingredientKg) ? (100 * ingredientKg) / mainKg : null,
    overTotal: totalKg > 0 && Number.isFinite(ingredientKg) ? (100 * ingredientKg) / totalKg : null,
  };
}

export interface RecipeBakerPercentRow {
  id: string;
  kg: number;
  isMain?: boolean;
  sourceType?: string;
  sourceId?: string;
  label?: string;
}

export function computeRecipeBakerPercents(rows: RecipeBakerPercentRow[]): Map<string, BakerPercentages> {
  const totalKg = rows.reduce((sum, row) => sum + (Number.isFinite(row.kg) ? row.kg : 0), 0);
  const mainRow = rows.find((row) => row.isMain);
  const mainKg = mainRow
    ? rows
        .filter((row) =>
          mainRow.sourceId
            ? row.sourceId === mainRow.sourceId && row.sourceType === mainRow.sourceType
            : row.id === mainRow.id,
        )
        .reduce((sum, row) => sum + (Number.isFinite(row.kg) ? row.kg : 0), 0)
    : 0;

  return new Map(rows.map((row) => [row.id, bakerPercents(row.kg, mainKg, totalKg)]));
}

/** Checagem visual/legal — não entra no motor. Sal ≤ 2% baker's; propionato ≤ 0,4%. */
export function bakerPercentLegalHint(label: string | undefined, overMain: number | null): string | null {
  if (overMain == null || !label) {
    return null;
  }
  const normalized = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\bsal\b/.test(normalized) && overMain > 2) {
    return "Sal acima de 2% sobre o principal (limite visual da ficha).";
  }
  if (/propionato/.test(normalized) && overMain > 0.4) {
    return "Propionato acima de 0,4% sobre o principal (limite visual da ficha).";
  }
  return null;
}

function isDiscreteWeightUnit(unit: ProductUnitProfile["unit"]) {
  return unit !== "Kg" && unit !== "L";
}

function withBakedUnitWeight(profile: ProductUnitProfile, bakedUnitKg: number): ProductUnitProfile {
  if (!isDiscreteWeightUnit(profile.unit)) {
    return profile;
  }
  return {
    ...profile,
    weightKg: round6(bakedUnitKg),
  };
}

/**
 * Aplica o teste completo ao produto: quebra derivada + peso de produção/venda em Un
 * = unidade assada (nunca o peso da etiqueta).
 */
export function applyLabTestToProduct(
  product: ProductionProduct,
  recipeTotalKg: number,
): ProductionProduct {
  const computation = computeLabTest({ recipeTotalKg, labTest: product.labTest });
  if (!computation?.complete) {
    return product;
  }

  return {
    ...product,
    breakPercent: Number(computation.breakPercent.toFixed(6)),
    unitProfiles: {
      sales: withBakedUnitWeight(product.unitProfiles.sales, computation.bakedUnitKg),
      production: withBakedUnitWeight(product.unitProfiles.production, computation.bakedUnitKg),
      expedition: product.unitProfiles.expedition,
    },
  };
}
