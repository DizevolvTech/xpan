import type {
  ProductionIngredient,
  ProductionLine,
  ProductionProduct,
  RecipeIngredientReference,
  ProductionSector,
  ProductionWeekDay,
  WeeklyProductionSchedule,
} from "@/lib/production-planning";
import type { UnitCode } from "@/lib/factory-planning/units";
import { isMassOrVolumeUnit, roundQuantityForUnit } from "@/lib/factory-planning/units";
import { productionWeekDays, sortProductionDays } from "@/lib/production-planning";

export function getLinesBySectorFromData(
  sectorId: string,
  lines: ProductionLine[],
) {
  return lines.filter((line) => line.sectorId === sectorId);
}

export function getProductsByMasterLineFromData<T extends ProductionProduct>(
  lineId: string,
  products: T[],
) {
  return products.filter((product) => (product.masterLineId ?? product.lineId) === lineId);
}

export function getProductsByLineFromData<T extends ProductionProduct>(
  lineId: string,
  products: T[],
) {
  return products.filter((product) => product.operationalLineId === lineId);
}

export function getProductOperationalStatusLabel(
  product: Pick<ProductionProduct, "operationalLineId">,
) {
  return product.operationalLineId ? "No cronograma ativo" : "Fora do cronograma ativo";
}

export function getScheduleItemDayPriority(
  item: Pick<WeeklyProductionSchedule["items"][number], "dayPriorities">,
  day: ProductionWeekDay,
) {
  const rawPriority = item.dayPriorities?.[day];
  return Number.isFinite(rawPriority) && Number(rawPriority) > 0
    ? Math.trunc(Number(rawPriority))
    : Number.MAX_SAFE_INTEGER;
}

export function buildDefaultScheduleDayPriorities<T extends { productionDays: ProductionWeekDay[] }>(
  items: T[],
) {
  const dayCounters = new Map<ProductionWeekDay, number>();

  return items.map((item) =>
    sortProductionDays(item.productionDays).reduce<Partial<Record<ProductionWeekDay, number>>>(
      (acc, day) => {
        const nextPriority = (dayCounters.get(day) ?? 0) + 1;
        dayCounters.set(day, nextPriority);
        acc[day] = nextPriority;
        return acc;
      },
      {},
    ),
  );
}

const VALID_PRODUCTION_WEEK_DAYS = new Set<ProductionWeekDay>(
  productionWeekDays.map((entry) => entry.key),
);

/**
 * Derives the canonical (deduplicated + sorted) list of production days from a
 * `dayPriorities` payload. The keys of the payload identify which days the
 * caller wants the item to produce on; the numeric values represent priority
 * order within each day.
 *
 * Returns `{ days, invalidKeys }` so callers can decide how to surface
 * validation errors. `days` is always sorted by `sortProductionDays` (canonical
 * weekday order). Falsy/non-numeric priority values are still treated as a
 * "day is selected" signal — the payload contract is "key presence == include
 * this day", priority normalization happens later via
 * `normalizeScheduleDayPriorities`.
 */
export function deriveProductionDaysFromDayPriorities(
  dayPriorities: Partial<Record<ProductionWeekDay, number>> | null | undefined,
): { days: ProductionWeekDay[]; invalidKeys: string[] } {
  if (!dayPriorities || typeof dayPriorities !== "object") {
    return { days: [], invalidKeys: [] };
  }

  const seen = new Set<ProductionWeekDay>();
  const invalidKeys: string[] = [];

  for (const key of Object.keys(dayPriorities)) {
    if (VALID_PRODUCTION_WEEK_DAYS.has(key as ProductionWeekDay)) {
      seen.add(key as ProductionWeekDay);
    } else {
      invalidKeys.push(key);
    }
  }

  return {
    days: sortProductionDays(Array.from(seen)),
    invalidKeys,
  };
}

export function normalizeScheduleDayPriorities(
  dayPriorities: Partial<Record<ProductionWeekDay, number>> | null | undefined,
  productionDays: ProductionWeekDay[],
  fallbackPriorities: Partial<Record<ProductionWeekDay, number>> = {},
) {
  return sortProductionDays(productionDays).reduce<Partial<Record<ProductionWeekDay, number>>>(
    (acc, day) => {
      const rawPriority = dayPriorities?.[day];
      const fallbackPriority = fallbackPriorities[day];
      const normalizedPriority =
        Number.isFinite(rawPriority) && Number(rawPriority) > 0
          ? Math.trunc(Number(rawPriority))
          : Number.isFinite(fallbackPriority) && Number(fallbackPriority) > 0
            ? Math.trunc(Number(fallbackPriority))
            : undefined;

      if (normalizedPriority) {
        acc[day] = normalizedPriority;
      }

      return acc;
    },
    {},
  );
}

export function sortScheduleEntriesForDay<
  T extends {
    code: string;
    name: string;
    dayPriorities?: Partial<Record<ProductionWeekDay, number>>;
  },
>(items: T[], day: ProductionWeekDay) {
  return [...items].sort((left, right) => {
    const byPriority =
      getScheduleItemDayPriority(left, day) - getScheduleItemDayPriority(right, day);

    if (byPriority !== 0) {
      return byPriority;
    }

    return `${left.code} ${left.name}`.localeCompare(`${right.code} ${right.name}`, "pt-BR");
  });
}

export function getSchedulesByLineFromData(
  lineId: string,
  schedules: WeeklyProductionSchedule[],
) {
  return schedules.filter((schedule) => schedule.lineId === lineId);
}

export function getMinimumProductionTotalFromSchedule(
  schedule: WeeklyProductionSchedule,
) {
  return schedule.items.reduce((total, item) => total + item.minimumProduction, 0);
}

export function getPlannedDaysCountFromSchedule(
  schedule: WeeklyProductionSchedule,
) {
  const days = new Set<ProductionWeekDay>();
  schedule.items.forEach((item) => {
    item.productionDays.forEach((day) => days.add(day));
  });
  return days.size;
}

export function getLinePlannedKgPerDayFromData(
  lineId: string,
  products: ProductionProduct[],
) {
  const relevantProducts = getProductsByLineFromData(lineId, products).filter((product) => product.active);

  return relevantProducts.reduce<Partial<Record<ProductionWeekDay, number>>>((acc, product) => {
    product.productionDays.forEach((day) => {
      acc[day] = (acc[day] ?? 0) + product.minimumProductionKg;
    });
    return acc;
  }, {});
}

export type LineDaySummary = {
  day: ProductionWeekDay;
  shortLabel: string;
  label: string;
  productsCount: number;
  plannedKg: number;
};

export function buildLineDaySummariesFromData(
  lineId: string,
  products: ProductionProduct[],
) {
  const relevantProducts = getProductsByLineFromData(lineId, products).filter((product) => product.active);

  return productionWeekDays.map<LineDaySummary>((day) => {
    const productsForDay = relevantProducts.filter((product) => product.productionDays.includes(day.key));
    return {
      day: day.key,
      shortLabel: day.shortLabel,
      label: day.label,
      productsCount: productsForDay.length,
      plannedKg: Number(
        productsForDay.reduce((total, product) => total + product.minimumProductionKg, 0).toFixed(2),
      ),
    };
  });
}

function getPositiveNumber(value: number | undefined | null): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function convertKnownUnitToKg(quantity: number, unit: UnitCode): number {
  switch (unit) {
    case "Kg":
      return quantity;
    case "g":
      return quantity / 1000;
    case "L":
      return quantity;
    case "ml":
      return quantity / 1000;
    default:
      return quantity;
  }
}

function matchingDiscreteWeightKg(
  profileUnit: UnitCode | undefined,
  profileWeightKg: number | undefined | null,
  itemUnit: UnitCode,
): number | null {
  if (!profileUnit || profileUnit !== itemUnit || isMassOrVolumeUnit(profileUnit)) {
    return null;
  }
  return getPositiveNumber(profileWeightKg);
}

/**
 * Peso de 1 unidade discreta de um produto (MPI). Nunca usa o 1 kg travado da
 * venda/perfil em Kg quando a receita pediu Un (ou outra unidade discreta).
 *
 * Caso Chama: MPI "Pão de ló" vendida em Kg, com 0,170 kg no peso da embalagem/
 * unidade — 1 Un na receita tem que virar 0,170 kg, não 1 kg.
 */
export function resolveProductDiscreteUnitWeightKg(
  product: ProductionProduct,
  itemUnit: UnitCode,
): number {
  const profile = product.ingredientProfile;
  const sales = product.unitProfiles.sales;
  const production = product.unitProfiles.production;
  const expedition = product.unitProfiles.expedition;
  const packaging = product.packagingProfile;

  const profileUnitWeightWhenUsedAsDiscrete =
    !isMassOrVolumeUnit(itemUnit) && getPositiveNumber(profile?.weightKg) != null && profile?.weightKg !== 1
      ? getPositiveNumber(profile?.weightKg)
      : null;

  const registeredWeights = [
    matchingDiscreteWeightKg(sales.unit, sales.weightKg, itemUnit),
    matchingDiscreteWeightKg(packaging?.unit, packaging?.weightKg, itemUnit),
    matchingDiscreteWeightKg(profile?.unit, profile?.weightKg, itemUnit),
    profileUnitWeightWhenUsedAsDiscrete,
    matchingDiscreteWeightKg(production.unit, production.weightKg, itemUnit),
    matchingDiscreteWeightKg(expedition.unit, expedition.weightKg, itemUnit),
  ];

  const nonDefaultWeight = registeredWeights.find((weight) => weight != null && weight !== 1);
  if (nonDefaultWeight != null) {
    return nonDefaultWeight;
  }

  const anyRegisteredWeight = registeredWeights.find((weight) => weight != null);
  if (anyRegisteredWeight != null) {
    return anyRegisteredWeight;
  }

  if (sales.unit === itemUnit && !isMassOrVolumeUnit(sales.unit)) {
    const factor = getPositiveNumber(product.salesToKgFactor);
    if (factor != null && factor !== 1) {
      return factor;
    }
  }

  const declaredYield = getPositiveNumber(profile?.recipeYieldKg);
  if (declaredYield != null) {
    return declaredYield;
  }

  if (!isMassOrVolumeUnit(sales.unit)) {
    const salesWeight = getPositiveNumber(sales.weightKg);
    if (salesWeight != null && salesWeight !== 1) {
      return salesWeight;
    }
  }

  // Último recurso: sem peso discreto cadastrado. Não herdar o 1 kg do perfil em Kg.
  return 1;
}

export function resolveProductRecipeYieldKg(
  product: ProductionProduct,
  computedOutputKg: number,
): number {
  return getPositiveNumber(product.ingredientProfile?.recipeYieldKg) ?? computedOutputKg;
}

function normalizeIngredientPurchaseUnit(ingredient: ProductionIngredient) {
  return ingredient.purchaseUnit ?? ingredient.unit;
}

function normalizeIngredientPurchaseFactor(ingredient: ProductionIngredient) {
  return Number.isFinite(ingredient.purchaseToConsumptionFactor) &&
    Number(ingredient.purchaseToConsumptionFactor) > 0
    ? Number(ingredient.purchaseToConsumptionFactor)
    : 1;
}

function convertIngredientQuantityToConsumptionUnit(
  item: Pick<RecipeIngredientReference, "quantity" | "unit">,
  ingredient: ProductionIngredient,
) {
  const purchaseUnit = normalizeIngredientPurchaseUnit(ingredient);
  if (item.unit === ingredient.unit) {
    return {
      quantity: item.quantity,
      unit: ingredient.unit,
    };
  }

  if (item.unit === purchaseUnit) {
    return {
      quantity: item.quantity * normalizeIngredientPurchaseFactor(ingredient),
      unit: ingredient.unit,
    };
  }

  return {
    quantity: item.quantity,
    unit: item.unit,
  };
}

export function getRecipeReferenceWeightKgFromData(
  item: Pick<RecipeIngredientReference, "quantity" | "unit" | "sourceType" | "sourceId">,
  ingredientsById: Map<string, ProductionIngredient>,
  productsById: Map<string, ProductionProduct>,
) {
  if (item.sourceType === "ingrediente") {
    const ingredient = ingredientsById.get(item.sourceId);
    if (!ingredient) {
      return convertKnownUnitToKg(item.quantity, item.unit);
    }

    const normalized = convertIngredientQuantityToConsumptionUnit(item, ingredient);

    if (isMassOrVolumeUnit(normalized.unit)) {
      return convertKnownUnitToKg(normalized.quantity, normalized.unit);
    }

    const unitWeightKg =
      getPositiveNumber(ingredient.weightKg) ?? getPositiveNumber(ingredient.recipeYieldKg);
    if (unitWeightKg != null) {
      return normalized.quantity * unitWeightKg;
    }

    return convertKnownUnitToKg(normalized.quantity, normalized.unit);
  }

  const product = productsById.get(item.sourceId);
  if (!product) {
    return convertKnownUnitToKg(item.quantity, item.unit);
  }

  if (isMassOrVolumeUnit(item.unit)) {
    return convertKnownUnitToKg(item.quantity, item.unit);
  }

  return item.quantity * resolveProductDiscreteUnitWeightKg(product, item.unit);
}

export function getProductRecipeTotalsFromData(
  product: ProductionProduct,
  ingredients: ProductionIngredient[],
  products: ProductionProduct[],
) {
  const ingredientsById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const productsById = new Map(products.map((entry) => [entry.id, entry]));
  const totalIngredientsKg = Number(
    product.recipe
      .reduce(
        (sum, item) => sum + getRecipeReferenceWeightKgFromData(item, ingredientsById, productsById),
        0,
      )
      .toFixed(3),
  );
  const outputAfterBreakKg = Number((totalIngredientsKg * (1 - product.breakPercent / 100)).toFixed(3));
  const salesUnit = product.unitProfiles.sales.unit;
  const unitWeightKg =
    salesUnit === "Kg" || salesUnit === "L"
      ? 1
      : product.unitProfiles.sales.weightKg > 0
        ? product.unitProfiles.sales.weightKg
        : 1;
  const finalOutputQuantity =
    salesUnit === "Kg" || salesUnit === "L"
      ? Number(outputAfterBreakKg.toFixed(3))
      : roundQuantityForUnit(outputAfterBreakKg / unitWeightKg, salesUnit);
  const finalFractionsQuantity = roundQuantityForUnit(outputAfterBreakKg / unitWeightKg, salesUnit);
  // AJ-0004.1: fração final PRECISA (sem arredondar para unidade discreta nem para 2 casas).
  // É a fonte única do "rendimento preciso" — propaga a jusante (demanda, OP, pré-pesagem) e
  // para a exibição; `finalFractionsQuantity` segue arredondado p/ unidade inteira (ordenável).
  const finalFractionsQuantityPrecise =
    Number.isFinite(unitWeightKg) && unitWeightKg > 0 ? outputAfterBreakKg / unitWeightKg : 0;

  return {
    totalIngredientsKg,
    outputAfterBreakKg,
    fractionUnitWeightKg: unitWeightKg,
    finalFractionsQuantity,
    finalFractionsQuantityPrecise,
    finalOutputQuantity,
    finalOutputUnit: salesUnit,
  };
}

export function buildSectorNameById(sectors: ProductionSector[]) {
  return new Map(sectors.map((sector) => [sector.id, sector.name]));
}

export function buildLineById(lines: ProductionLine[]) {
  return new Map(lines.map((line) => [line.id, line]));
}

export function buildProductById(products: ProductionProduct[]) {
  return new Map(products.map((product) => [product.id, product]));
}
