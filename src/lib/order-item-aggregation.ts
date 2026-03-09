import type { OrderStatus, PlannedOrderItem } from "@/lib/order-planning";

export type AggregatedOrderItem = {
  aggregationKey: string;
  productId: string;
  productCode: string;
  productName: string;
  requestedQuantity: number;
  requestedUnit: string;
  internalKg: number;
  expeditionQuantity: number;
  expeditionUnit: string;
  sectorName: string;
  lineName: string;
  scheduleName: string;
  productionDate: string | null;
  deliveryDate: string;
  opCode: string | null;
  status: OrderStatus;
  workflowProgress: number;
  sourceItemsCount: number;
};

function round2(value: number) {
  return Number(value.toFixed(2));
}

function getOrderItemAggregationKey(item: PlannedOrderItem) {
  return [
    item.productId,
    item.requestedUnit,
    item.expeditionUnit,
    item.sectorId,
    item.lineId,
    item.scheduleId ?? "sem-sublinha",
    item.productionDate ?? "sem-agenda",
    item.deliveryDate,
    item.opCode ?? "sem-op",
  ].join("|");
}

export function aggregateOrderItems(items: PlannedOrderItem[]): AggregatedOrderItem[] {
  const map = new Map<string, AggregatedOrderItem>();

  items.forEach((item) => {
    const aggregationKey = getOrderItemAggregationKey(item);

    if (!map.has(aggregationKey)) {
      map.set(aggregationKey, {
        aggregationKey,
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        requestedQuantity: 0,
        requestedUnit: item.requestedUnit,
        internalKg: 0,
        expeditionQuantity: 0,
        expeditionUnit: item.expeditionUnit,
        sectorName: item.sectorName,
        lineName: item.lineName,
        scheduleName: item.scheduleName ?? "Sem linha ativa",
        productionDate: item.productionDate,
        deliveryDate: item.deliveryDate,
        opCode: item.opCode,
        status: item.status,
        workflowProgress: item.workflowProgress,
        sourceItemsCount: 0,
      });
    }

    const row = map.get(aggregationKey);
    if (!row) {
      return;
    }

    row.requestedQuantity = round2(row.requestedQuantity + item.requestedQuantity);
    row.internalKg = round2(row.internalKg + item.internalKg);
    row.expeditionQuantity = round2(row.expeditionQuantity + item.expeditionQuantity);
    if (item.workflowProgress >= row.workflowProgress) {
      row.workflowProgress = item.workflowProgress;
      row.status = item.status;
    }
    row.sourceItemsCount += 1;
  });

  return Array.from(map.values()).sort((a, b) => {
    const byProduct = a.productCode.localeCompare(b.productCode);
    if (byProduct !== 0) {
      return byProduct;
    }
    const byDelivery = a.deliveryDate.localeCompare(b.deliveryDate);
    if (byDelivery !== 0) {
      return byDelivery;
    }
    const byProduction = (a.productionDate ?? "").localeCompare(b.productionDate ?? "");
    if (byProduction !== 0) {
      return byProduction;
    }
    return a.lineName.localeCompare(b.lineName);
  });
}
