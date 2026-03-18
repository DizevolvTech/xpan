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
import { productionWeekDays } from "@/lib/production-planning";

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

    if (ingredient.unit === "Kg" || ingredient.unit === "L") {
      return convertKnownUnitToKg(item.quantity, item.unit);
    }

    return convertKnownUnitToKg(item.quantity, ingredient.unit);
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

  return {
    totalIngredientsKg,
    outputAfterBreakKg,
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
