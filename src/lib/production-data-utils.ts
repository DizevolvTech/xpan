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
import { roundQuantityForUnit } from "@/lib/factory-planning/units";
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

function convertKnownUnitToKg(quantity: number, unit: UnitCode): number {
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
  item: RecipeIngredientReference,
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

function getRecipeReferenceWeightKgFromData(
  item: RecipeIngredientReference,
  ingredientsById: Map<string, ProductionIngredient>,
  productsById: Map<string, ProductionProduct>,
) {
  if (item.sourceType === "ingrediente") {
    const ingredient = ingredientsById.get(item.sourceId);
    if (!ingredient) {
      return convertKnownUnitToKg(item.quantity, item.unit);
    }

    const normalized = convertIngredientQuantityToConsumptionUnit(item, ingredient);

    if (ingredient.unit === "Kg" || ingredient.unit === "L") {
      return convertKnownUnitToKg(normalized.quantity, normalized.unit);
    }

    return convertKnownUnitToKg(normalized.quantity, ingredient.unit);
  }

  const product = productsById.get(item.sourceId);
  if (!product) {
    return convertKnownUnitToKg(item.quantity, item.unit);
  }

  return item.unit === "Kg"
    ? item.quantity
    : item.quantity * (product.ingredientProfile?.weightKg ?? product.unitProfiles.sales.weightKg);
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

  return {
    totalIngredientsKg,
    outputAfterBreakKg,
    fractionUnitWeightKg: unitWeightKg,
    finalFractionsQuantity,
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
