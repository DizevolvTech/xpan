import type {
  ProductLabTest,
  ProductionProduct,
  ProductUnitProfile,
} from "@/lib/production-planning";

/**
 * Cálculos da ficha amarela (S1) — Quadro #231.
 *
 * O usuário lança SÓ 3 valores: kg assados das unidades padrão, nº de unidades padrão e sobra
 * assada (kg). A massa crua é a soma dos insumos que participam da cocção (Quadro #232) e todo o
 * resto é calculado:
 *
 *   unidade_assada      = kg_assados / unidades_padrão
 *   assado_total        = kg_assados + sobra_assada
 *   unidades_efetivas   = assado_total / unidade_assada
 *   quebra              = (massa_crua − assado_total) / massa_crua
 *   rendimento          = assado_total / massa_crua
 *   unidade_crua        = massa_crua / unidades_efetivas   (uso interno na OP)
 *
 * A sobra assada SOMA ao total: tudo o que a receita gerou cru precisa ser contado assado,
 * senão a quebra sai inflada (cliente, 07/10/2026).
 *
  * Baker's % = 100 × (ingrediente / principal `isMain`). True % = 100 × (ingrediente / total).
 * O motor de OP usa kg unitário, nunca as porcentagens.
 */

export function round6(value: number) {
  return Number(value.toFixed(6));
}

export function emptyLabTest(): ProductLabTest {
  return {
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
    bakedKg: optionalNonNegativeNumber(raw.bakedKg),
    leftoverBakedKg: optionalNonNegativeNumber(raw.leftoverBakedKg),
    unitCount: optionalNonNegativeNumber(raw.unitCount),
    labelWeightKg: optionalNonNegativeNumber(raw.labelWeightKg),
  };
}

export interface LabTestComputation {
  complete: boolean;
  /** Massa crua = soma dos insumos que participam da cocção. */
  rawDoughKg: number;
  leftoverBakedKg: number;
  /** Assado total = kg assados das unidades padrão + sobra assada. */
  effectiveBakedKg: number;
  breakKg: number;
  breakPercent: number;
  yieldPercent: number;
  /** Nº de unidades padrão lançado no teste. */
  unitCount: number;
  /** Unidades efetivas = assado total / peso da unidade assada (ex.: 175,32). */
  effectiveUnitCount: number;
  bakedUnitKg: number;
  bakedUnitGrams: number;
  /** Peso da unidade crua (kg) = massa crua / unidades efetivas. Uso interno na OP. */
  rawUnitWeightKg: number;
  labelWeightKg: number | null;
}

export function computeLabTest(input: {
  /** Soma dos insumos que participam da cocção (massa crua). */
  recipeTotalKg: number;
  labTest?: ProductLabTest | null;
}): LabTestComputation | null {
  const lab = input.labTest;
  if (!lab) {
    return null;
  }

  const rawDoughKg =
    Number.isFinite(input.recipeTotalKg) && input.recipeTotalKg > 0 ? input.recipeTotalKg : 0;
  const leftoverBakedKg = lab.leftoverBakedKg != null && lab.leftoverBakedKg > 0 ? lab.leftoverBakedKg : 0;
  const bakedKg = lab.bakedKg != null && lab.bakedKg > 0 ? lab.bakedKg : 0;
  const unitCount = lab.unitCount != null && lab.unitCount > 0 ? lab.unitCount : 0;
  // Sobra assada soma ao assado padrão. Sobra sozinha não é medição: exige kg assados > 0.
  const effectiveBakedKg = bakedKg + leftoverBakedKg;
  const complete =
    rawDoughKg > 0 && bakedKg > 0 && unitCount > 0 && effectiveBakedKg <= rawDoughKg;

  if (!complete) {
    return {
      complete: false,
      rawDoughKg,
      leftoverBakedKg,
      effectiveBakedKg: Math.max(0, effectiveBakedKg),
      breakKg: 0,
      breakPercent: 0,
      yieldPercent: 0,
      unitCount,
      effectiveUnitCount: 0,
      bakedUnitKg: 0,
      bakedUnitGrams: 0,
      rawUnitWeightKg: 0,
      labelWeightKg: lab.labelWeightKg,
    };
  }

  const breakKg = rawDoughKg - effectiveBakedKg;
  const yieldRatio = effectiveBakedKg / rawDoughKg;
  const bakedUnitKg = bakedKg / unitCount;
  const effectiveUnitCount = effectiveBakedKg / bakedUnitKg;

  return {
    complete: true,
    rawDoughKg,
    leftoverBakedKg,
    effectiveBakedKg,
    breakKg,
    breakPercent: (1 - yieldRatio) * 100,
    yieldPercent: yieldRatio * 100,
    unitCount,
    effectiveUnitCount,
    bakedUnitKg,
    bakedUnitGrams: bakedUnitKg * 1000,
    rawUnitWeightKg: rawDoughKg / effectiveUnitCount,
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
