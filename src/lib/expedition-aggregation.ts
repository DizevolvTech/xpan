import type { ExpeditionItem } from "@/lib/order-planning";

export type AggregatedExpeditionItem = {
  productId: string;
  productCode: string;
  productName: string;
  requestedQuantity: number;
  requestedUnit: string;
  internalKg: number;
  expeditionQuantity: number;
  expeditionUnit: string;
  sourceItemsCount: number;
};

function round2(value: number) {
  return Number(value.toFixed(2));
}

export function getAggregatedExpeditionItemKey(input: {
  productId: string;
  requestedUnit: string;
  // expeditionUnit is intentionally accepted but ignored: it is read live from the
  // product config and is therefore volatile. Including it in the checklist key made
  // saved check marks go orphan whenever the product's expedition unit was edited.
  // The key must stay stable, so it is derived only from the stable productId + requestedUnit.
  expeditionUnit?: string;
}) {
  return `${input.productId}|${input.requestedUnit}`;
}

export function aggregateExpeditionItems(items: ExpeditionItem[]): AggregatedExpeditionItem[] {
  const map = new Map<string, AggregatedExpeditionItem>();

  items.forEach((item) => {
    const key = getAggregatedExpeditionItemKey({
      productId: item.productId,
      requestedUnit: item.requestedUnit,
      expeditionUnit: item.expeditionUnit,
    });
    if (!map.has(key)) {
      map.set(key, {
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        requestedQuantity: 0,
        requestedUnit: item.requestedUnit,
        internalKg: 0,
        expeditionQuantity: 0,
        expeditionUnit: item.expeditionUnit,
        sourceItemsCount: 0,
      });
    }

    const row = map.get(key);
    if (!row) {
      return;
    }

    row.requestedQuantity = round2(row.requestedQuantity + item.requestedQuantity);
    row.internalKg = round2(row.internalKg + item.internalKg);
    row.expeditionQuantity = round2(row.expeditionQuantity + item.expeditionQuantity);
    row.sourceItemsCount += 1;
  });

  return Array.from(map.values()).sort((a, b) => a.productCode.localeCompare(b.productCode));
}
