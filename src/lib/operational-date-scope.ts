import type { FactoryPlanningData } from "@/lib/order-planning";
import type { StoreOrderSummary } from "@/lib/store-order-types";

export type OperationalDateScopeMode = "all" | "day" | "range";

export type OperationalDateScope = {
  mode: OperationalDateScopeMode;
  date: string;
  startDate: string;
  endDate: string;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateKey(value: string | null | undefined): value is string {
  return typeof value === "string" && DATE_KEY_PATTERN.test(value);
}

function normalizeRange(startDate: string, endDate: string) {
  if (startDate <= endDate) {
    return { startDate, endDate };
  }

  return {
    startDate: endDate,
    endDate: startDate,
  };
}

export function createDefaultOperationalDateScope(today: string): OperationalDateScope {
  return {
    mode: "all",
    date: today,
    startDate: today,
    endDate: today,
  };
}

export function normalizeOperationalDateScope(
  value: Partial<OperationalDateScope> | null | undefined,
  today: string,
): OperationalDateScope {
  const fallback = createDefaultOperationalDateScope(today);
  const date = isValidDateKey(value?.date) ? value.date : fallback.date;
  const startCandidate = isValidDateKey(value?.startDate) ? value.startDate : date;
  const endCandidate = isValidDateKey(value?.endDate) ? value.endDate : date;
  const { startDate, endDate } = normalizeRange(startCandidate, endCandidate);
  const mode: OperationalDateScopeMode =
    value?.mode === "day" || value?.mode === "range" || value?.mode === "all"
      ? value.mode
      : fallback.mode;

  return {
    mode,
    date,
    startDate,
    endDate,
  };
}

export function parseOperationalDateScopeFromSearchParams(searchParams: URLSearchParams, today: string) {
  const mode = searchParams.get("scope");

  if (mode !== "all" && mode !== "day" && mode !== "range") {
    return null;
  }

  return normalizeOperationalDateScope(
    {
      mode,
      date: searchParams.get("date") ?? undefined,
      startDate: searchParams.get("start") ?? undefined,
      endDate: searchParams.get("end") ?? undefined,
    },
    today,
  );
}

export function resolveOperationalScopeAnchorDate(scope: OperationalDateScope, today: string) {
  if (scope.mode === "day") {
    return scope.date;
  }

  if (scope.mode === "range") {
    return scope.endDate;
  }

  return today;
}

export function matchesDateKeyInOperationalScope(dateKey: string | null | undefined, scope: OperationalDateScope) {
  if (!isValidDateKey(dateKey)) {
    return false;
  }

  if (scope.mode === "all") {
    return true;
  }

  if (scope.mode === "day") {
    return dateKey === scope.date;
  }

  return dateKey >= scope.startDate && dateKey <= scope.endDate;
}

export function formatOperationalDateScopeSummary(scope: OperationalDateScope) {
  if (scope.mode === "all") {
    return "Todo o período operacional";
  }

  if (scope.mode === "day") {
    return `Somente ${scope.date}`;
  }

  return `${scope.startDate} até ${scope.endDate}`;
}

function orderItemMatchesScope(
  item: FactoryPlanningData["orderItems"][number],
  scope: OperationalDateScope,
) {
  return (
    matchesDateKeyInOperationalScope(item.productionDate, scope) ||
    matchesDateKeyInOperationalScope(item.deliveryDate, scope) ||
    matchesDateKeyInOperationalScope(item.saleDate, scope)
  );
}

export function filterFactoryPlanningDataByOperationalScope(
  planningData: FactoryPlanningData,
  scope: OperationalDateScope,
): FactoryPlanningData {
  if (scope.mode === "all") {
    return planningData;
  }

  const scopedOrderItems = planningData.orderItems.filter((item) => orderItemMatchesScope(item, scope));
  const orderIdsFromItems = new Set(scopedOrderItems.map((item) => item.orderId));
  const orders = planningData.orders.filter((order) =>
    orderIdsFromItems.has(order.id) ||
    matchesDateKeyInOperationalScope(order.orderedAtKey, scope) ||
    matchesDateKeyInOperationalScope(order.deliveryDate, scope),
  );
  const orderIds = new Set(orders.map((order) => order.id));
  const orderItems = planningData.orderItems.filter((item) => orderIds.has(item.orderId) || orderItemMatchesScope(item, scope));
  const productionOrders = planningData.productionOrders.filter(
    (order) =>
      matchesDateKeyInOperationalScope(order.productionDate, scope) ||
      order.sourceItems.some((item) => orderIds.has(item.orderId)),
  );
  const expedition = planningData.expedition.filter(
    (row) => matchesDateKeyInOperationalScope(row.deliveryDate, scope) || orderIds.has(row.orderId),
  );
  const expeditionIds = new Set(expedition.map((row) => row.id));
  const expeditionItems = planningData.expeditionItems.filter((item) =>
    expeditionIds.has(item.expeditionId) || orderIds.has(item.orderId),
  );

  return {
    ...planningData,
    orders,
    orderItems,
    productionOrders,
    expedition,
    expeditionItems,
    productionDates: Array.from(new Set(productionOrders.map((order) => order.productionDate))).sort((a, b) =>
      a.localeCompare(b),
    ),
    deliveryDates: Array.from(new Set(orders.map((order) => order.deliveryDate))).sort((a, b) =>
      a.localeCompare(b),
    ),
  };
}

export function filterStoreOrderSummariesByOperationalScope(
  orders: StoreOrderSummary[],
  scope: OperationalDateScope,
) {
  if (scope.mode === "all") {
    return orders;
  }

  return orders.filter((order) =>
    matchesDateKeyInOperationalScope(order.orderedAtKey, scope) ||
    matchesDateKeyInOperationalScope(order.deliveryDateKey, scope),
  );
}
