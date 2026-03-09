import type {
  ProductionLine,
  ProductionProduct,
  ProductionSector,
  ProductionWeekDay,
  WeeklyProductionSchedule,
} from "@/lib/production-planning";

export function getLinesBySectorFromData(
  sectorId: string,
  lines: ProductionLine[],
) {
  return lines.filter((line) => line.sectorId === sectorId);
}

export function getProductsByLineFromData(
  lineId: string,
  products: ProductionProduct[],
) {
  return products.filter((product) => product.lineId === lineId);
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
  const relevantProducts = getProductsByLineFromData(lineId, products);

  return relevantProducts.reduce<Partial<Record<ProductionWeekDay, number>>>((acc, product) => {
    product.productionDays.forEach((day) => {
      acc[day] = (acc[day] ?? 0) + product.minimumProductionKg;
    });
    return acc;
  }, {});
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
