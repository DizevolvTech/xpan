import {
  defaultProductPreparationStages,
  formatDateBr,
  getEnabledOrderingDays,
  getEnabledReceivingDays,
  type OperationalSettings,
  type ProductionIngredient,
  type ProductionLine,
  type ProductionProduct,
  type ProductionSector,
  type ProductionWeekDay,
  type WeeklyProductionSchedule,
  type WeeklyScheduleItem,
} from "@/lib/production-planning";
import type {
  ExpeditionItem,
  ExpeditionRow,
  ExpeditionSeparationRow,
  FactoryPlanningData,
  OrderStatus,
  PlannedOrderItem,
  PlannedOrderRow,
  ProductionItemStatus,
  ProductionOrderItem,
  ProductionOrderRow,
  ProductionOrderSourceItem,
  StoreOrder,
  StoreProfile,
} from "@/lib/factory-planning/types";
import { getScheduleItemDayPriority } from "@/lib/production-data-utils";
import { round2, roundQuantityForUnit } from "@/lib/factory-planning/units";
import { getProductionStatusProgress, normalizeProductPreparationStages } from "@/lib/production-workflow";
import { expandRecipeIntoItems } from "@/lib/factory-planning/recipe-expansion";

export interface FactoryPlanningInput {
  stores: StoreProfile[];
  storeOrders: StoreOrder[];
  settings: OperationalSettings;
  sectors: ProductionSector[];
  lines: ProductionLine[];
  products: ProductionProduct[];
  schedules: WeeklyProductionSchedule[];
  /**
   * Opcional. Consumido apenas pela expansão MPI (atrás da flag
   * EXPAND_MPI_INTO_OPS) para escalar receitas com ingredientes em
   * unidades não-Kg. Pode ficar undefined em call sites legados sem
   * regressão — `getRecipeReferenceWeightKgFromData` faz fallback.
   */
  ingredients?: ProductionIngredient[];
}

interface ResolvedPlanningSource {
  settings: OperationalSettings;
  sectorsById: Map<string, ProductionSector>;
  linesById: Map<string, ProductionLine>;
  productsById: Map<string, ProductionProduct>;
  products: ProductionProduct[];
  ingredients: ProductionIngredient[];
  schedules: WeeklyProductionSchedule[];
}

const weekdayByIndex: ProductionWeekDay[] = [
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
];

export const productionStageProgress: Record<ProductionItemStatus, number> = {
  nao_iniciado: 0,
  em_preparacao: getProductionStatusProgress("em_preparacao", defaultProductPreparationStages),
  em_producao: getProductionStatusProgress("em_producao", defaultProductPreparationStages),
  em_forno: getProductionStatusProgress("em_forno", defaultProductPreparationStages),
  embalando: getProductionStatusProgress("embalando", defaultProductPreparationStages),
  concluido: 100,
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`);
}

function addDays(dateKey: string, days: number): string {
  const date = fromDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function compareDateKeys(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

export function getWeekDayKey(dateKey: string): ProductionWeekDay {
  const date = fromDateKey(dateKey);
  return weekdayByIndex[date.getDay()];
}

export function getTodayDateKey(): string {
  return toDateKey(new Date());
}

export function formatDateKeyBr(dateKey: string) {
  return formatDateBr(dateKey);
}

function formatDateTimeBr(dateTimeIso: string): string {
  const date = new Date(dateTimeIso);
  return `${new Intl.DateTimeFormat("pt-BR").format(date)} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

export function getBaseDateByCutoff(orderedAt: string, cutoffTime: string): string {
  const dateTime = new Date(orderedAt);
  const [cutoffHour, cutoffMinute] = cutoffTime.split(":").map((part) => Number(part));
  const baseDate = new Date(dateTime);
  baseDate.setHours(0, 0, 0, 0);

  const afterCutoff =
    dateTime.getHours() > cutoffHour ||
    (dateTime.getHours() === cutoffHour && dateTime.getMinutes() > cutoffMinute);

  if (afterCutoff) {
    baseDate.setDate(baseDate.getDate() + 1);
  }

  return toDateKey(baseDate);
}

export function moveToNextAllowedWeekday(dateKey: string, allowedDays: ProductionWeekDay[]): string {
  if (allowedDays.length === 0) {
    return dateKey;
  }

  let cursor = dateKey;
  for (let i = 0; i < 7; i += 1) {
    if (allowedDays.includes(getWeekDayKey(cursor))) {
      return cursor;
    }
    cursor = addDays(cursor, 1);
  }

  return dateKey;
}

export function getDeliveryDateByStoreRule(
  baseDate: string,
  store: StoreProfile,
  settings: OperationalSettings,
): string {
  const calculatedDate = addDays(baseDate, settings.expeditionLeadDays);
  return moveToNextAllowedWeekday(calculatedDate, getEnabledReceivingDays(store));
}

export function getOperationalBaseDateByStoreRule(
  orderedAt: string,
  store: Pick<StoreProfile, "orderingDays" | "orderingBlockedDays">,
  settings: Pick<OperationalSettings, "orderCutoffTime">,
): string {
  const baseDate = getBaseDateByCutoff(orderedAt, settings.orderCutoffTime);
  return moveToNextAllowedWeekday(baseDate, getEnabledOrderingDays(store));
}

export function getOperationalOrderWindow(
  orderedAt: string,
  store: StoreProfile,
  settings: OperationalSettings,
) {
  const baseDate = getOperationalBaseDateByStoreRule(orderedAt, store, settings);
  const deliveryDate = getDeliveryDateByStoreRule(baseDate, store, settings);

  return { baseDate, deliveryDate };
}

export interface OperationalAvailabilityResult {
  baseDate: string;
  deliveryDate: string;
  deliveryWeekDay: ProductionWeekDay;
  productionDate: string | null;
  available: boolean;
  delayed: boolean;
  blockedReason: string | null;
  matchingDays: ProductionWeekDay[];
  scheduleItemId: string | null;
}

function normalizeSaleLeadDays(saleLeadDays: number | undefined) {
  return Number.isFinite(saleLeadDays) && Number(saleLeadDays) > 0 ? Number(saleLeadDays) : 1;
}

function getMatchingProductionDays(
  productDays: ProductionWeekDay[],
  scheduleItemDays: ProductionWeekDay[] | null,
) {
  const uniqueProductDays = Array.from(new Set(productDays));
  const uniqueScheduleDays = scheduleItemDays ? Array.from(new Set(scheduleItemDays)) : null;

  if (!uniqueScheduleDays) {
    return uniqueProductDays;
  }

  return uniqueProductDays.filter((day) => uniqueScheduleDays.includes(day));
}

export function resolveScheduledProductAvailability(
  orderedAt: string,
  store: StoreProfile,
  settings: OperationalSettings,
  options: {
    productProductionDays: ProductionWeekDay[];
    productExpeditionLeadDays: number;
    scheduleItem?: Pick<WeeklyScheduleItem, "id" | "productionDays"> | null;
  },
): OperationalAvailabilityResult {
  const { baseDate, deliveryDate } = getOperationalOrderWindow(orderedAt, store, settings);
  const deliveryWeekDay = getWeekDayKey(deliveryDate);

  if (!options.scheduleItem) {
    return {
      baseDate,
      deliveryDate,
      deliveryWeekDay,
      productionDate: null,
      available: false,
      delayed: false,
      blockedReason: "Produto fora da linha de produção ativa.",
      matchingDays: [],
      scheduleItemId: null,
    };
  }

  const matchingDays = getMatchingProductionDays(
    options.productProductionDays,
    options.scheduleItem.productionDays,
  );

  if (matchingDays.length === 0) {
    return {
      baseDate,
      deliveryDate,
      deliveryWeekDay,
      productionDate: null,
      available: false,
      delayed: false,
      blockedReason: "Dias da ficha do produto não coincidem com a linha de produção ativa.",
      matchingDays,
      scheduleItemId: options.scheduleItem.id,
    };
  }

  const receivingDays = getEnabledReceivingDays(store);
  const productionWindow = resolveProductionDateInWindow(
    baseDate,
    deliveryDate,
    matchingDays,
    options.productExpeditionLeadDays,
    receivingDays,
  );

  if (!productionWindow.date) {
    return {
      baseDate,
      deliveryDate,
      deliveryWeekDay,
      productionDate: null,
      available: false,
      delayed: productionWindow.delayed,
      blockedReason: `Sem data de produção compatível: o produto exige ${options.productExpeditionLeadDays} dia(s) entre produção e entrega, mas nenhum dia da ficha resulta em entrega ${formatDateKeyBr(deliveryDate)}.`,
      matchingDays,
      scheduleItemId: options.scheduleItem.id,
    };
  }

  if (productionWindow.delayed) {
    return {
      baseDate,
      deliveryDate,
      deliveryWeekDay,
      productionDate: productionWindow.date,
      available: false,
      delayed: true,
      blockedReason: `Produção em ${formatDateKeyBr(productionWindow.date)} + ${options.productExpeditionLeadDays} dia(s) cai após a entrega prevista (${formatDateKeyBr(deliveryDate)}).`,
      matchingDays,
      scheduleItemId: options.scheduleItem.id,
    };
  }

  return {
    baseDate,
    deliveryDate,
    deliveryWeekDay,
    productionDate: productionWindow.date,
    available: true,
    delayed: productionWindow.delayed,
    blockedReason: null,
    matchingDays,
    scheduleItemId: options.scheduleItem.id,
  };
}

export function getOperationalTimeline(
  orderedAt: string,
  store: StoreProfile,
  settings: OperationalSettings,
  productionDays: ProductionWeekDay[],
  saleLeadDays = 0,
  productExpeditionLeadDays = 1,
) {
  const availability = resolveScheduledProductAvailability(orderedAt, store, settings, {
    productProductionDays: productionDays,
    productExpeditionLeadDays,
    scheduleItem: {
      id: "virtual-schedule-item",
      productionDays,
    },
  });

  return {
    baseDate: availability.baseDate,
    deliveryDate: availability.deliveryDate,
    saleDate: addDays(availability.deliveryDate, normalizeSaleLeadDays(saleLeadDays)),
    productionDate: availability.productionDate,
    delayed: availability.delayed,
  };
}

export function resolveProductionDateInWindow(
  baseDate: string,
  deliveryDate: string,
  productionDays: ProductionWeekDay[],
  productExpeditionLeadDays: number,
  receivingDays: ProductionWeekDay[],
) {
  if (productionDays.length === 0) {
    return { date: null as string | null, delayed: false };
  }

  // Busca regressiva: dia de produção tal que produção + gap (após ajuste de domingo) = entrega
  let cursor = deliveryDate;
  while (compareDateKeys(cursor, baseDate) >= 0) {
    if (productionDays.includes(getWeekDayKey(cursor))) {
      const candidateDelivery = receivingDays.length > 0
        ? moveToNextAllowedWeekday(addDays(cursor, productExpeditionLeadDays), receivingDays)
        : addDays(cursor, productExpeditionLeadDays);
      if (candidateDelivery === deliveryDate) {
        return { date: cursor, delayed: false };
      }
    }
    cursor = addDays(cursor, -1);
  }

  // Não encontrou — busca delayed no futuro até 14 dias
  let futureCursor = addDays(deliveryDate, 1);
  for (let i = 0; i < 14; i += 1) {
    if (productionDays.includes(getWeekDayKey(futureCursor))) {
      return { date: futureCursor, delayed: true };
    }
    futureCursor = addDays(futureCursor, 1);
  }

  return { date: null as string | null, delayed: true };
}

function sanitizeFactor(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function buildActiveScheduleByLine(schedules: WeeklyProductionSchedule[]): Map<string, WeeklyProductionSchedule> {
  const map = new Map<string, WeeklyProductionSchedule>();

  // Defensivo: se houver mais de um cronograma ativo por linha (não deveria, mas pode em race conditions),
  // pega sempre o mais recente — mesmo critério de `buildLatestScheduleByLineId` em store-order-catalog.
  schedules
    .filter((schedule) => schedule.status === "ativo")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .forEach((schedule) => {
      if (!map.has(schedule.lineId)) {
        map.set(schedule.lineId, schedule);
      }
    });

  return map;
}

/**
 * Feature flag para expansão automática de MPI em OPs separadas (AJ-0008).
 *
 * **Default: ON** desde 2026-05-20 — comportamento que o cliente Daniel pediu
 * na Call 2026-05-13 (Bloco 4). Para desligar em emergência sem novo deploy,
 * defina `EXPAND_MPI_INTO_OPS=false` no ambiente (escape hatch).
 *
 * Ver Docs/decisoes/ADR_expansao_mpi_em_op.md.
 */
function isMpiExpansionEnabled() {
  return process.env.EXPAND_MPI_INTO_OPS !== "false";
}

function resolvePlanningSource(input: FactoryPlanningInput): ResolvedPlanningSource {
  return {
    settings: input.settings,
    sectorsById: new Map(input.sectors.map((sector) => [sector.id, sector])),
    linesById: new Map(input.lines.map((line) => [line.id, line])),
    productsById: new Map(input.products.map((product) => [product.id, product])),
    products: input.products,
    ingredients: input.ingredients ?? [],
    schedules: input.schedules,
  };
}

function getPotentialItemStatus(productionDate: string | null, canPlan: boolean, referenceDate: string): OrderStatus {
  if (!canPlan || !productionDate) {
    return "em_espera";
  }
  if (productionDate === referenceDate) {
    return "em_producao";
  }
  return compareDateKeys(productionDate, referenceDate) > 0 ? "agendado" : "em_espera";
}

function getProductionItemKey(item: Pick<PlannedOrderItem, "productionDate" | "lineId" | "scheduleId" | "productId">) {
  if (!item.productionDate) {
    return null;
  }
  return [item.productionDate, item.lineId, item.scheduleId ?? "sem-linha", item.productId].join("|");
}

function getPlanningKey(item: Pick<PlannedOrderItem, "productionDate" | "sectorId" | "lineId" | "scheduleId">) {
  if (!item.productionDate) {
    return null;
  }
  return [item.productionDate, item.sectorId, item.lineId, item.scheduleId ?? "sem-linha"].join("|");
}

function sortOrderItems(items: PlannedOrderItem[]) {
  return [...items].sort((a, b) => {
    const byDelivery = compareDateKeys(a.deliveryDate, b.deliveryDate);
    if (byDelivery !== 0) {
      return byDelivery;
    }
    const byOrder = a.orderCode.localeCompare(b.orderCode);
    if (byOrder !== 0) {
      return byOrder;
    }
    return a.productCode.localeCompare(b.productCode);
  });
}

function groupOrderItemsByOrderId(items: PlannedOrderItem[]) {
  const map = new Map<string, PlannedOrderItem[]>();

  items.forEach((item) => {
    if (!map.has(item.orderId)) {
      map.set(item.orderId, []);
    }
    map.get(item.orderId)!.push(item);
  });

  return map;
}

function buildOrderProductionDateLabel(items: PlannedOrderItem[]): string {
  const dates = Array.from(
    new Set(items.map((item) => item.productionDate).filter((value): value is string => Boolean(value))),
  ).sort(compareDateKeys);

  if (dates.length === 0) {
    return "Sem agenda";
  }
  if (dates.length === 1) {
    return formatDateBr(dates[0]);
  }
  return `${formatDateBr(dates[0])} a ${formatDateBr(dates[dates.length - 1])}`;
}

function buildOrderOpsLabel(opCodes: string[]) {
  if (opCodes.length === 0) {
    return "-";
  }
  if (opCodes.length === 1) {
    return opCodes[0];
  }
  return `${opCodes[0]} +${opCodes.length - 1}`;
}

function getOrderStatusFromItems(items: PlannedOrderItem[]): OrderStatus {
  if (items.length === 0) {
    return "em_espera";
  }
  if (items.every((item) => item.status === "aguardando_expedicao")) {
    return "aguardando_expedicao";
  }
  if (items.some((item) => item.status === "em_producao")) {
    return "em_producao";
  }
  if (items.some((item) => item.status === "agendado")) {
    return "agendado";
  }
  return "em_espera";
}

function getAverageProgress(items: Array<{ workflowProgress: number }>) {
  if (items.length === 0) {
    return 0;
  }
  return Number((items.reduce((sum, item) => sum + item.workflowProgress, 0) / items.length).toFixed(1));
}

function getLatestDate(items: Array<{ deliveryDate: string }>, fallbackDate: string) {
  return items.reduce(
    (latest, item) => (compareDateKeys(item.deliveryDate, latest) > 0 ? item.deliveryDate : latest),
    fallbackDate,
  );
}

function buildPlannedItems(
  input: {
    storeOrders: StoreOrder[];
    storeById: Map<string, StoreProfile>;
    scheduleByLineId: Map<string, WeeklyProductionSchedule>;
    source: ResolvedPlanningSource;
  },
  referenceDate: string,
): PlannedOrderItem[] {
  const items = input.storeOrders
    .flatMap((order) => {
      const store = input.storeById.get(order.storeId);
      if (!store) {
        return [];
      }

      return order.items.flatMap<PlannedOrderItem>((orderItem) => {
        const product = input.source.productsById.get(orderItem.productId);
        const line = product?.operationalLineId
          ? input.source.linesById.get(product.operationalLineId)
          : undefined;
        const sector = line ? input.source.sectorsById.get(line.sectorId) : undefined;
        const schedule = line ? input.scheduleByLineId.get(line.id) : undefined;
        const scheduleItem = schedule?.items.find((item) => item.productId === product?.id) ?? null;

        if (!product || !line || !sector) {
          return [];
        }

        const availability = resolveScheduledProductAvailability(
          order.orderedAt,
          store,
          input.source.settings,
          {
            productProductionDays: product.productionDays,
            productExpeditionLeadDays: product.expeditionLeadDays,
            scheduleItem,
          },
        );
        const salesFactor = sanitizeFactor(product.salesToKgFactor);
        const expeditionFactor = sanitizeFactor(product.expeditionToKgFactor);
        const internalKg = round2(orderItem.quantity * salesFactor);
        const expeditionQuantityRaw =
          product.expeditionUnit === "Kg" ? internalKg : round2(internalKg / expeditionFactor);
        const expeditionQuantity =
          product.expeditionUnit === "Kg"
            ? round2(internalKg)
            : roundQuantityForUnit(expeditionQuantityRaw, product.expeditionUnit);

        const canPlan = Boolean(schedule && availability.available && availability.productionDate);
        const scheduleDayPriority =
          canPlan && scheduleItem && availability.productionDate
            ? getScheduleItemDayPriority(scheduleItem, getWeekDayKey(availability.productionDate))
            : null;
        const productionItemKey = canPlan
          ? getProductionItemKey({
              productionDate: availability.productionDate,
              lineId: line.id,
              scheduleId: schedule?.id ?? null,
              productId: product.id,
            })
          : null;

        return [
          {
          id: orderItem.id,
          orderId: order.id,
          orderCode: order.code,
          storeId: store.id,
          storeName: store.name,
          orderedAt: formatDateTimeBr(order.orderedAt),
          baseDate: availability.baseDate,
          deliveryDate: availability.deliveryDate,
          saleDate: addDays(availability.deliveryDate, normalizeSaleLeadDays(input.source.settings.saleLeadDays)),
          productionDate: availability.productionDate,
          delayed: availability.delayed,
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          lineId: line.id,
          lineName: line.name,
          sectorId: sector.id,
          sectorName: sector.name,
          scheduleId: schedule?.id ?? null,
          scheduleCode: schedule?.code ?? null,
          scheduleName: schedule?.name ?? null,
          requestedQuantity: orderItem.quantity,
          requestedUnit: orderItem.unit,
          internalKg,
          expeditionUnit: product.expeditionUnit,
          expeditionQuantityRaw,
          expeditionQuantity,
          canPlan,
          scheduleDayPriority,
          availableForRelease: canPlan,
          releasedToProduction: false,
          productionItemKey,
          productionItemStatus: canPlan ? "nao_iniciado" : null,
          preparationStages: normalizeProductPreparationStages(product.preparationStages),
          workflowProgress: 0,
          opCode: null,
          status: getPotentialItemStatus(availability.productionDate, canPlan, referenceDate),
          } satisfies PlannedOrderItem,
        ];
      });
    })

  return sortOrderItems(items);
}

export function buildProductionOrdersFromPlannedItems(
  plannedItems: PlannedOrderItem[],
  referenceDate: string,
): {
  productionOrders: ProductionOrderRow[];
  opsByOrderId: Map<string, Set<string>>;
  opCodeByPlanningKey: Map<string, string>;
} {
  const opGroupMap = new Map<
    string,
    {
      planningKey: string;
      productionDate: string;
      sectorId: string;
      sectorName: string;
      lineId: string;
      lineName: string;
      scheduleId: string;
      scheduleCode: string;
      scheduleName: string;
      orderCodes: Set<string>;
      orderIds: Set<string>;
      items: Map<string, ProductionOrderItem>;
      sourceItems: ProductionOrderSourceItem[];
      totalKg: number;
      releasedToProduction: boolean;
    }
  >();

  plannedItems
    .filter((item) => item.canPlan && item.productionDate)
    .forEach((item) => {
      const planningKey = getPlanningKey(item);
      if (!planningKey) {
        return;
      }

      if (!opGroupMap.has(planningKey)) {
        opGroupMap.set(planningKey, {
          planningKey,
          productionDate: item.productionDate!,
          sectorId: item.sectorId,
          sectorName: item.sectorName,
          lineId: item.lineId,
          lineName: item.lineName,
          scheduleId: item.scheduleId ?? "sem-linha",
          scheduleCode: item.scheduleCode ?? "-",
          scheduleName: item.scheduleName ?? "Sem linha",
          orderCodes: new Set<string>(),
          orderIds: new Set<string>(),
          items: new Map<string, ProductionOrderItem>(),
          sourceItems: [],
          totalKg: 0,
          releasedToProduction: false,
        });
      }

      const group = opGroupMap.get(planningKey)!;
      group.orderCodes.add(item.orderCode);
      group.orderIds.add(item.orderId);
      group.totalKg = round2(group.totalKg + item.internalKg);
      group.releasedToProduction = group.releasedToProduction || item.releasedToProduction;

      if (!group.items.has(item.productId)) {
        group.items.set(item.productId, {
          productId: item.productId,
          productCode: item.productCode,
          productName: item.productName,
          productionItemKey: item.productionItemKey ?? `${planningKey}|${item.productId}`,
          totalKg: 0,
          productionSequence: item.scheduleDayPriority,
          progress: item.workflowProgress,
          status: item.productionItemStatus ?? "nao_iniciado",
          preparationStages: item.preparationStages,
          sourceItemsCount: 0,
        });
      }

      const aggregated = group.items.get(item.productId)!;
      aggregated.totalKg = round2(aggregated.totalKg + item.internalKg);
      aggregated.productionSequence = aggregated.productionSequence ?? item.scheduleDayPriority;
      aggregated.progress = Math.max(aggregated.progress, item.workflowProgress);
      aggregated.status =
        aggregated.progress > item.workflowProgress ? aggregated.status : item.productionItemStatus ?? aggregated.status;
      aggregated.sourceItemsCount += 1;

      group.sourceItems.push({
        id: item.id,
        orderId: item.orderId,
        orderCode: item.orderCode,
        storeName: item.storeName,
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        requestedQuantity: item.requestedQuantity,
        requestedUnit: item.requestedUnit,
        internalKg: item.internalKg,
        deliveryDate: item.deliveryDate,
        deliveryDateLabel: formatDateBr(item.deliveryDate),
        saleDate: item.saleDate,
        saleDateLabel: formatDateBr(item.saleDate),
        expeditionUnit: item.expeditionUnit,
        expeditionQuantity: item.expeditionQuantity,
        productionItemKey: item.productionItemKey ?? `${planningKey}|${item.productId}`,
        productionSequence: item.scheduleDayPriority,
        releasedToProduction: item.releasedToProduction,
        productionItemStatus: item.productionItemStatus ?? "nao_iniciado",
        workflowProgress: item.workflowProgress,
      });
    });

  const groupedOps = Array.from(opGroupMap.values()).sort((a, b) => {
    const byDate = compareDateKeys(a.productionDate, b.productionDate);
    if (byDate !== 0) {
      return byDate;
    }
    const bySector = a.sectorName.localeCompare(b.sectorName);
    if (bySector !== 0) {
      return bySector;
    }
    return a.lineName.localeCompare(b.lineName);
  });

  const opCodeByPlanningKey = new Map<string, string>();
  const productionOrders: ProductionOrderRow[] = groupedOps.map((group, index) => {
    const code = `OP-${group.productionDate.replaceAll("-", "").slice(2)}-${String(index + 1).padStart(3, "0")}`;
    opCodeByPlanningKey.set(group.planningKey, code);

    const progress = getAverageProgress(group.sourceItems);
    const status: OrderStatus =
      progress >= 100
        ? "aguardando_expedicao"
        : progress > 0
          ? "em_producao"
          : compareDateKeys(group.productionDate, referenceDate) >= 0
            ? "agendado"
            : "em_espera";

    return {
      id: `op-${index + 1}`,
      code,
      productionDate: group.productionDate,
      productionDateLabel: formatDateBr(group.productionDate),
      sectorId: group.sectorId,
      sectorName: group.sectorName,
      lineId: group.lineId,
      lineName: group.lineName,
      scheduleId: group.scheduleId,
      scheduleCode: group.scheduleCode,
      scheduleName: group.scheduleName,
      itemsCount: group.sourceItems.length,
      ordersCount: group.orderIds.size,
      totalKg: round2(group.totalKg),
      releasedToProduction: group.releasedToProduction,
      progress,
      status,
      orderCodes: Array.from(group.orderCodes).sort((a, b) => a.localeCompare(b)),
      items: Array.from(group.items.values()).sort((a, b) => {
        const bySequence =
          (a.productionSequence ?? Number.MAX_SAFE_INTEGER) -
          (b.productionSequence ?? Number.MAX_SAFE_INTEGER);
        if (bySequence !== 0) {
          return bySequence;
        }
        return a.productCode.localeCompare(b.productCode);
      }),
      sourceItems: group.sourceItems.sort((a, b) => {
        const bySequence =
          (a.productionSequence ?? Number.MAX_SAFE_INTEGER) -
          (b.productionSequence ?? Number.MAX_SAFE_INTEGER);
        if (bySequence !== 0) {
          return bySequence;
        }
        const byOrder = a.orderCode.localeCompare(b.orderCode);
        if (byOrder !== 0) {
          return byOrder;
        }
        return a.productCode.localeCompare(b.productCode);
      }),
    };
  });

  const opsByOrderId = new Map<string, Set<string>>();
  productionOrders.forEach((op) => {
    op.sourceItems.forEach((item) => {
      if (!opsByOrderId.has(item.orderId)) {
        opsByOrderId.set(item.orderId, new Set<string>());
      }
      opsByOrderId.get(item.orderId)!.add(op.code);
    });
  });

  return { productionOrders, opsByOrderId, opCodeByPlanningKey };
}

function buildOrders(
  storeOrders: StoreOrder[],
  orderItemsByOrderId: Map<string, PlannedOrderItem[]>,
  storeById: Map<string, StoreProfile>,
  opsByOrderId: Map<string, Set<string>>,
  settings: OperationalSettings,
): PlannedOrderRow[] {
  return storeOrders
    .map<PlannedOrderRow | null>((order) => {
      const store = storeById.get(order.storeId);
      if (!store) {
        return null;
      }

      const items = orderItemsByOrderId.get(order.id) ?? [];
      const opCodes = Array.from(opsByOrderId.get(order.id) ?? []).sort((a, b) => a.localeCompare(b));
      const { deliveryDate: fallbackDeliveryDate } = getOperationalOrderWindow(order.orderedAt, store, settings);
      const deliveryDate = items.length > 0 ? getLatestDate(items, fallbackDeliveryDate) : fallbackDeliveryDate;

      return {
        id: order.id,
        code: order.code,
        storeId: store.id,
        storeName: store.name,
        orderedAt: formatDateTimeBr(order.orderedAt),
        orderedAtKey: order.orderedAt.slice(0, 10),
        dPlusLabel: `D+${settings.expeditionLeadDays}`,
        deliveryDate,
        deliveryDateLabel: formatDateBr(deliveryDate),
        productionDateLabel: buildOrderProductionDateLabel(items),
        itemsCount: items.length,
        totalKg: round2(items.reduce((sum, item) => sum + item.internalKg, 0)),
        opsLabel: buildOrderOpsLabel(opCodes),
        releasedToProduction: items.some((item) => item.releasedToProduction),
        availableForRelease: items.every((item) => item.availableForRelease),
        workflowProgress: getAverageProgress(items),
        status: getOrderStatusFromItems(items),
      } satisfies PlannedOrderRow;
    })
    .filter((row): row is PlannedOrderRow => Boolean(row))
    .sort((a, b) => {
      const byDelivery = compareDateKeys(a.deliveryDate, b.deliveryDate);
      if (byDelivery !== 0) {
        return byDelivery;
      }
      return a.code.localeCompare(b.code);
    });
}

function buildExpeditionRows(
  storeOrders: StoreOrder[],
  orderItemsByOrderId: Map<string, PlannedOrderItem[]>,
  storeById: Map<string, StoreProfile>,
  orderByCode: Map<string, PlannedOrderRow>,
  settings: OperationalSettings,
): ExpeditionRow[] {
  return storeOrders
    .map((order) => {
      const store = storeById.get(order.storeId);
      if (!store) {
        return null;
      }

      const items = (orderItemsByOrderId.get(order.id) ?? []).slice().sort((a, b) => a.productCode.localeCompare(b.productCode));
      const { deliveryDate: fallbackDeliveryDate } = getOperationalOrderWindow(order.orderedAt, store, settings);
      const deliveryDate = items.length > 0 ? getLatestDate(items, fallbackDeliveryDate) : fallbackDeliveryDate;
      const orderSummary = orderByCode.get(order.code);

      const expeditionItems: ExpeditionItem[] = items.map((item) => ({
        itemId: item.id,
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        requestedQuantity: item.requestedQuantity,
        requestedUnit: item.requestedUnit,
        internalKg: item.internalKg,
        expeditionQuantityRaw: item.expeditionQuantityRaw,
        expeditionQuantity: item.expeditionQuantity,
        expeditionUnit: item.expeditionUnit,
        productionDate: item.productionDate,
        saleDate: item.saleDate,
        workflowProgress: item.workflowProgress,
      }));

      return {
        id: `exp-${order.id}`,
        orderId: order.id,
        orderCode: order.code,
        storeId: store.id,
        storeName: store.name,
        deliveryDate,
        deliveryDateLabel: formatDateBr(deliveryDate),
        totalKg: round2(expeditionItems.reduce((sum, item) => sum + item.internalKg, 0)),
        itemsCount: expeditionItems.length,
        itemsSummary: expeditionItems
          .map((item) => `${item.productCode}: ${item.requestedQuantity} ${item.requestedUnit}`)
          .join(" | "),
        releasedToProduction: orderSummary?.releasedToProduction ?? false,
        workflowProgress: orderSummary?.workflowProgress ?? 0,
        status: orderSummary?.status ?? "em_espera",
        items: expeditionItems,
      };
    })
    .filter((row): row is ExpeditionRow => Boolean(row))
    .sort((a, b) => {
      const byDelivery = compareDateKeys(a.deliveryDate, b.deliveryDate);
      if (byDelivery !== 0) {
        return byDelivery;
      }
      return a.orderCode.localeCompare(b.orderCode);
    });
}

function buildExpeditionItems(expeditionRows: ExpeditionRow[]): ExpeditionSeparationRow[] {
  return expeditionRows.flatMap((row) =>
    row.items.map((item) => ({
      id: `${row.id}-${item.itemId}`,
      expeditionId: row.id,
      orderId: row.orderId,
      orderCode: row.orderCode,
      storeId: row.storeId,
      storeName: row.storeName,
      deliveryDate: row.deliveryDate,
      deliveryDateLabel: row.deliveryDateLabel,
      status: row.status,
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      requestedQuantity: item.requestedQuantity,
      requestedUnit: item.requestedUnit,
      internalKg: item.internalKg,
      expeditionQuantityRaw: item.expeditionQuantityRaw,
      expeditionQuantity: item.expeditionQuantity,
      expeditionUnit: item.expeditionUnit,
    })),
  );
}

export function buildFactoryPlanningData(
  referenceDate: string,
  input: FactoryPlanningInput,
): FactoryPlanningData {
  const source = resolvePlanningSource(input);
  const storeById = new Map(input.stores.map((store) => [store.id, store]));
  const scheduleByLineId = buildActiveScheduleByLine(source.schedules);
  const orderItems = buildPlannedItems(
    {
      storeOrders: input.storeOrders,
      storeById,
      scheduleByLineId,
      source,
    },
    referenceDate,
  );

  // Expansão de sub-receita produto-MPI em itens planejados (AJ-0008).
  // Ver Docs/decisoes/ADR_expansao_mpi_em_op.md. Default off: comportamento
  // legado preservado até validação do cliente em dev.
  const expandedItems = isMpiExpansionEnabled()
    ? expandRecipeIntoItems(orderItems, source.productsById, source.ingredients, source.products, {
        // AJ-A4: fase 2 — passa os maps para que o MPI rode na linha/setor nativos.
        linesById: source.linesById,
        sectorsById: source.sectorsById,
      })
    : orderItems;

  const { productionOrders, opsByOrderId, opCodeByPlanningKey } = buildProductionOrdersFromPlannedItems(expandedItems, referenceDate);
  const orderItemsWithOpCodes = orderItems.map((item) => {
    const planningKey = getPlanningKey(item);
    return {
      ...item,
      opCode: planningKey ? opCodeByPlanningKey.get(planningKey) ?? null : null,
    };
  });

  const orderItemsByOrderId = groupOrderItemsByOrderId(orderItemsWithOpCodes);
  const orders = buildOrders(input.storeOrders, orderItemsByOrderId, storeById, opsByOrderId, source.settings);
  const orderByCode = new Map(orders.map((order) => [order.code, order]));
  const expedition = buildExpeditionRows(input.storeOrders, orderItemsByOrderId, storeById, orderByCode, source.settings);
  const expeditionItems = buildExpeditionItems(expedition);

  return {
    referenceDate,
    orders,
    orderItems: orderItemsWithOpCodes,
    productionOrders,
    expedition,
    expeditionItems,
    productionDates: Array.from(
      new Set(orderItemsWithOpCodes.map((item) => item.productionDate).filter((value): value is string => Boolean(value))),
    ).sort(compareDateKeys),
    deliveryDates: Array.from(new Set(orders.map((order) => order.deliveryDate))).sort(compareDateKeys),
  };
}

export function getProductById(productId: string, products: ProductionProduct[]): ProductionProduct | undefined {
  return products.find((product) => product.id === productId);
}
