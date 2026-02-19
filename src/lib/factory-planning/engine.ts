import {
  formatDateBr,
  linesById,
  productsById,
  sectorsById,
  weeklySchedules,
  type ProductionWeekDay,
  type WeeklyProductionSchedule,
} from "@/lib/production-planning";
import { buildMockFactoryInput } from "@/lib/factory-planning/mock-source";
import type {
  ExpeditionItem,
  ExpeditionRow,
  ExpeditionSeparationRow,
  FactoryPlanningData,
  OrderStatus,
  PlannedOrderItem,
  PlannedOrderRow,
  ProductionOrderItem,
  ProductionOrderRow,
  ProductionOrderSourceItem,
  StoreOrder,
  StoreProfile,
} from "@/lib/factory-planning/types";
import { round2, roundQuantityForUnit } from "@/lib/factory-planning/units";

const weekdayByIndex: ProductionWeekDay[] = [
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
];

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

function getWeekDayKey(dateKey: string): ProductionWeekDay {
  const date = fromDateKey(dateKey);
  return weekdayByIndex[date.getDay()];
}

export function getTodayDateKey(): string {
  return toDateKey(new Date());
}

function formatDateTimeBr(dateTimeIso: string): string {
  const date = new Date(dateTimeIso);
  return `${new Intl.DateTimeFormat("pt-BR").format(date)} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function getBaseDateByCutoff(orderedAt: string, cutoffTime: string): string {
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

function adjustDeliveryDateBySundayRule(deliveryDate: string, receivesSunday: boolean): string {
  if (receivesSunday || getWeekDayKey(deliveryDate) !== "domingo") {
    return deliveryDate;
  }

  return addDays(deliveryDate, 1);
}

function getDeliveryDateByStoreRule(baseDate: string, dPlusDays: number, receivesSunday: boolean): string {
  const calculatedDate = addDays(baseDate, dPlusDays);
  return adjustDeliveryDateBySundayRule(calculatedDate, receivesSunday);
}

function findProductionDate(baseDate: string, deliveryDate: string, productionDays: ProductionWeekDay[]) {
  if (productionDays.length === 0) {
    return { date: null as string | null, delayed: false };
  }

  let cursor = deliveryDate;
  while (compareDateKeys(cursor, baseDate) >= 0) {
    if (productionDays.includes(getWeekDayKey(cursor))) {
      return { date: cursor, delayed: false };
    }
    cursor = addDays(cursor, -1);
  }

  let futureCursor = addDays(deliveryDate, 1);
  for (let i = 0; i < 7; i += 1) {
    if (productionDays.includes(getWeekDayKey(futureCursor))) {
      return { date: futureCursor, delayed: true };
    }
    futureCursor = addDays(futureCursor, 1);
  }

  return { date: null as string | null, delayed: true };
}

function buildActiveScheduleByLine(): Map<string, WeeklyProductionSchedule> {
  const map = new Map<string, WeeklyProductionSchedule>();
  weeklySchedules
    .filter((schedule) => schedule.status === "ativo")
    .forEach((schedule) => {
      if (!map.has(schedule.lineId)) {
        map.set(schedule.lineId, schedule);
      }
    });
  return map;
}

function sanitizeFactor(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function getPlannedItemStatus(
  productionDate: string | null,
  deliveryDate: string,
  canPlan: boolean,
  referenceDate: string,
): OrderStatus {
  if (!canPlan || !productionDate) {
    return "em_espera";
  }
  if (productionDate === referenceDate) {
    return "em_producao";
  }
  if (compareDateKeys(productionDate, referenceDate) > 0) {
    return "agendado";
  }
  if (compareDateKeys(deliveryDate, referenceDate) > 0) {
    return "em_espera";
  }
  return "rota_entrega";
}

const orderStatusPriority: Record<OrderStatus, number> = {
  rota_entrega: 1,
  agendado: 2,
  em_producao: 3,
  em_espera: 4,
};

function getOrderStatus(items: PlannedOrderItem[]): OrderStatus {
  if (items.length === 0) {
    return "em_espera";
  }
  return items.reduce(
    (highest, item) => (orderStatusPriority[item.status] > orderStatusPriority[highest] ? item.status : highest),
    "rota_entrega" as OrderStatus,
  );
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

function buildOrderOpsLabel(opCodes: string[]): string {
  if (opCodes.length === 0) {
    return "-";
  }
  if (opCodes.length === 1) {
    return opCodes[0];
  }
  return `${opCodes[0]} +${opCodes.length - 1}`;
}

function sortOrderItems(items: PlannedOrderItem[]): PlannedOrderItem[] {
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

function groupOrderItemsByOrderId(items: PlannedOrderItem[]): Map<string, PlannedOrderItem[]> {
  const map = new Map<string, PlannedOrderItem[]>();

  items.forEach((item) => {
    if (!map.has(item.orderId)) {
      map.set(item.orderId, []);
    }
    map.get(item.orderId)!.push(item);
  });

  return map;
}

function buildProductionOrders(
  plannedItems: PlannedOrderItem[],
  referenceDate: string,
): {
  productionOrders: ProductionOrderRow[];
  opCodeByPlanningKey: Map<string, string>;
  opsByOrderId: Map<string, Set<string>>;
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
    }
  >();

  plannedItems
    .filter((item) => item.canPlan && item.productionDate)
    .forEach((item) => {
      const planningKey = `${item.productionDate}|${item.sectorId}|${item.lineId}`;
      if (!opGroupMap.has(planningKey)) {
        opGroupMap.set(planningKey, {
          planningKey,
          productionDate: item.productionDate!,
          sectorId: item.sectorId,
          sectorName: item.sectorName,
          lineId: item.lineId,
          lineName: item.lineName,
          scheduleId: item.scheduleId ?? "sem-sublinha",
          scheduleCode: item.scheduleCode ?? "-",
          scheduleName: item.scheduleName ?? "Sem sublinha",
          orderCodes: new Set<string>(),
          orderIds: new Set<string>(),
          items: new Map<string, ProductionOrderItem>(),
          sourceItems: [],
          totalKg: 0,
        });
      }

      const group = opGroupMap.get(planningKey)!;
      group.orderCodes.add(item.orderCode);
      group.orderIds.add(item.orderId);
      group.totalKg = round2(group.totalKg + item.internalKg);

      if (!group.items.has(item.productId)) {
        group.items.set(item.productId, {
          productId: item.productId,
          productCode: item.productCode,
          productName: item.productName,
          totalKg: 0,
        });
      }
      const aggregated = group.items.get(item.productId)!;
      aggregated.totalKg = round2(aggregated.totalKg + item.internalKg);

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
        expeditionUnit: item.expeditionUnit,
        expeditionQuantity: item.expeditionQuantity,
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
    const byLine = a.lineName.localeCompare(b.lineName);
    if (byLine !== 0) {
      return byLine;
    }
    return a.scheduleName.localeCompare(b.scheduleName);
  });

  const opCodeByPlanningKey = new Map<string, string>();
  const productionOrders: ProductionOrderRow[] = groupedOps.map((group, index) => {
    const code = `OP-${group.productionDate.replaceAll("-", "").slice(2)}-${String(index + 1).padStart(3, "0")}`;
    opCodeByPlanningKey.set(group.planningKey, code);

    const status: OrderStatus =
      group.productionDate === referenceDate
        ? "em_producao"
        : compareDateKeys(group.productionDate, referenceDate) > 0
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
      status,
      orderCodes: Array.from(group.orderCodes).sort((a, b) => a.localeCompare(b)),
      items: Array.from(group.items.values())
        .map((item) => ({ ...item, totalKg: round2(item.totalKg) }))
        .sort((a, b) => a.productCode.localeCompare(b.productCode)),
      sourceItems: group.sourceItems.sort((a, b) => {
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

  return { productionOrders, opCodeByPlanningKey, opsByOrderId };
}

function buildOrders(
  storeOrders: StoreOrder[],
  orderItemsByOrderId: Map<string, PlannedOrderItem[]>,
  storeById: Map<string, StoreProfile>,
  opsByOrderId: Map<string, Set<string>>,
): PlannedOrderRow[] {
  return storeOrders
    .map((order) => {
      const store = storeById.get(order.storeId);
      if (!store) {
        return null;
      }

      const items = orderItemsByOrderId.get(order.id) ?? [];
      const opCodes = Array.from(opsByOrderId.get(order.id) ?? []).sort((a, b) => a.localeCompare(b));
      const status = getOrderStatus(items);
      const baseDate = getBaseDateByCutoff(order.orderedAt, store.cutoffTime);
      const deliveryDate = getDeliveryDateByStoreRule(baseDate, store.dPlusDays, store.receivesSunday);

      return {
        id: order.id,
        code: order.code,
        storeId: store.id,
        storeName: store.name,
        orderedAt: formatDateTimeBr(order.orderedAt),
        dPlusLabel: `D+${store.dPlusDays}`,
        deliveryDate,
        deliveryDateLabel: formatDateBr(deliveryDate),
        productionDateLabel: buildOrderProductionDateLabel(items),
        itemsCount: items.length,
        totalKg: round2(items.reduce((sum, item) => sum + item.internalKg, 0)),
        opsLabel: buildOrderOpsLabel(opCodes),
        status,
      };
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
): ExpeditionRow[] {
  return storeOrders
    .map((order) => {
      const store = storeById.get(order.storeId);
      if (!store) {
        return null;
      }

      const items = (orderItemsByOrderId.get(order.id) ?? []).slice().sort((a, b) => a.productCode.localeCompare(b.productCode));

      const baseDate = getBaseDateByCutoff(order.orderedAt, store.cutoffTime);
      const deliveryDate = getDeliveryDateByStoreRule(baseDate, store.dPlusDays, store.receivesSunday);
      const orderStatus = orderByCode.get(order.code)?.status ?? getOrderStatus(items);

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
        status: orderStatus,
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

export function buildFactoryPlanningData(referenceDate: string = getTodayDateKey()): FactoryPlanningData {
  const simulationInput = buildMockFactoryInput(referenceDate);
  const storeById = new Map(simulationInput.stores.map((store) => [store.id, store]));
  const activeScheduleByLine = buildActiveScheduleByLine();
  const plannedItems: PlannedOrderItem[] = [];

  for (const order of simulationInput.storeOrders) {
    const store = storeById.get(order.storeId);
    if (!store) {
      continue;
    }

    const baseDate = getBaseDateByCutoff(order.orderedAt, store.cutoffTime);
    const deliveryDate = getDeliveryDateByStoreRule(baseDate, store.dPlusDays, store.receivesSunday);

    for (const item of order.items) {
      const product = productsById.get(item.productId);
      if (!product) {
        continue;
      }
      const line = linesById.get(product.lineId);
      if (!line) {
        continue;
      }
      const sector = sectorsById.get(line.sectorId);
      if (!sector) {
        continue;
      }

      const schedule = activeScheduleByLine.get(line.id);
      const scheduleItem = schedule?.items.find((scheduleEntry) => scheduleEntry.productId === product.id);
      const productionDecision = scheduleItem
        ? findProductionDate(baseDate, deliveryDate, scheduleItem.productionDays)
        : { date: null as string | null, delayed: false };

      const internalKg = round2(item.quantity * sanitizeFactor(product.salesToKgFactor));
      const expeditionFactor = sanitizeFactor(product.expeditionToKgFactor);
      const expeditionQuantityRaw = round2(internalKg / expeditionFactor);
      const expeditionQuantity = roundQuantityForUnit(expeditionQuantityRaw, product.expeditionUnit);

      const canPlan = Boolean(schedule && scheduleItem && productionDecision.date);

      plannedItems.push({
        id: item.id,
        orderId: order.id,
        orderCode: order.code,
        storeId: store.id,
        storeName: store.name,
        orderedAt: order.orderedAt,
        baseDate,
        deliveryDate,
        productionDate: productionDecision.date,
        delayed: productionDecision.delayed,
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
        requestedQuantity: item.quantity,
        requestedUnit: item.unit,
        internalKg,
        expeditionUnit: product.expeditionUnit,
        expeditionQuantityRaw,
        expeditionQuantity,
        canPlan,
        opCode: null,
        status: "agendado",
      });
    }
  }

  const { productionOrders, opCodeByPlanningKey, opsByOrderId } = buildProductionOrders(plannedItems, referenceDate);

  plannedItems.forEach((item) => {
    if (item.canPlan && item.productionDate) {
      const planningKey = `${item.productionDate}|${item.sectorId}|${item.lineId}`;
      item.opCode = opCodeByPlanningKey.get(planningKey) ?? null;
    }
    item.status = getPlannedItemStatus(item.productionDate, item.deliveryDate, item.canPlan, referenceDate);
  });

  const sortedItems = sortOrderItems(plannedItems);
  const orderItemsByOrderId = groupOrderItemsByOrderId(sortedItems);
  const orders = buildOrders(simulationInput.storeOrders, orderItemsByOrderId, storeById, opsByOrderId);
  const orderByCode = new Map(orders.map((order) => [order.code, order]));
  const expedition = buildExpeditionRows(simulationInput.storeOrders, orderItemsByOrderId, storeById, orderByCode);
  const expeditionItems = buildExpeditionItems(expedition).sort((a, b) => {
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

  const productionDates = Array.from(new Set(productionOrders.map((op) => op.productionDate))).sort(compareDateKeys);
  const deliveryDates = Array.from(new Set(expedition.map((row) => row.deliveryDate))).sort(compareDateKeys);

  return {
    referenceDate,
    orders,
    orderItems: sortedItems,
    productionOrders,
    expedition,
    expeditionItems,
    productionDates,
    deliveryDates,
  };
}

export function formatDateKeyBr(dateKey: string): string {
  return formatDateBr(dateKey);
}
