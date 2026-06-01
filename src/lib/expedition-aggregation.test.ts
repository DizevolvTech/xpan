import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateExpeditionItems,
  getAggregatedExpeditionItemKey,
} from "@/lib/expedition-aggregation";
import type { ExpeditionItem } from "@/lib/order-planning";

function makeExpeditionItem(overrides: Partial<ExpeditionItem> = {}): ExpeditionItem {
  return {
    itemId: "item-1",
    productId: "prod-1",
    productCode: "P001",
    productName: "Pão Francês",
    requestedQuantity: 10,
    requestedUnit: "Kg",
    internalKg: 10,
    expeditionQuantityRaw: 10,
    expeditionQuantity: 10,
    expeditionUnit: "Kg",
    productionDate: "2026-06-01",
    saleDate: "2026-06-02",
    workflowProgress: 0,
    ...overrides,
  };
}

test("getAggregatedExpeditionItemKey builds a key from productId and requestedUnit", () => {
  assert.equal(
    getAggregatedExpeditionItemKey({
      productId: "prod-1",
      requestedUnit: "Kg",
      expeditionUnit: "Un",
    }),
    "prod-1|Kg",
  );
});

test("getAggregatedExpeditionItemKey ignores expeditionUnit so the key stays stable when expeditionUnit changes", () => {
  const keyA = getAggregatedExpeditionItemKey({
    productId: "prod-1",
    requestedUnit: "Kg",
    expeditionUnit: "Un",
  });
  const keyB = getAggregatedExpeditionItemKey({
    productId: "prod-1",
    requestedUnit: "Kg",
    expeditionUnit: "Caixa",
  });

  assert.equal(keyA, keyB);
});

test("getAggregatedExpeditionItemKey differs when productId or requestedUnit differ", () => {
  const base = getAggregatedExpeditionItemKey({
    productId: "prod-1",
    requestedUnit: "Kg",
    expeditionUnit: "Un",
  });

  assert.notEqual(
    base,
    getAggregatedExpeditionItemKey({
      productId: "prod-2",
      requestedUnit: "Kg",
      expeditionUnit: "Un",
    }),
  );
  assert.notEqual(
    base,
    getAggregatedExpeditionItemKey({
      productId: "prod-1",
      requestedUnit: "Un",
      expeditionUnit: "Un",
    }),
  );
});

test("aggregateExpeditionItems aggregates items sharing productId + requestedUnit regardless of expeditionUnit", () => {
  const items: ExpeditionItem[] = [
    makeExpeditionItem({
      itemId: "a",
      requestedQuantity: 4,
      internalKg: 4,
      expeditionQuantity: 4,
      expeditionUnit: "Un",
    }),
    makeExpeditionItem({
      itemId: "b",
      requestedQuantity: 6,
      internalKg: 6,
      expeditionQuantity: 6,
      // expeditionUnit changed (e.g. product config edited) — must NOT split the row
      expeditionUnit: "Caixa",
    }),
  ];

  const result = aggregateExpeditionItems(items);

  assert.equal(result.length, 1);
  assert.equal(result[0].requestedQuantity, 10);
  assert.equal(result[0].internalKg, 10);
  assert.equal(result[0].expeditionQuantity, 10);
  assert.equal(result[0].sourceItemsCount, 2);
  // expeditionUnit is still surfaced on the row for display (first item wins)
  assert.equal(result[0].expeditionUnit, "Un");
});

test("aggregateExpeditionItems produces a row whose checklist key does not depend on expeditionUnit", () => {
  const item = makeExpeditionItem({ expeditionUnit: "Un" });
  const [row] = aggregateExpeditionItems([item]);

  const keyWithCurrentUnit = getAggregatedExpeditionItemKey({
    productId: row.productId,
    requestedUnit: row.requestedUnit,
    expeditionUnit: row.expeditionUnit,
  });
  const keyAfterUnitEdit = getAggregatedExpeditionItemKey({
    productId: row.productId,
    requestedUnit: row.requestedUnit,
    expeditionUnit: "Caixa",
  });

  assert.equal(keyWithCurrentUnit, keyAfterUnitEdit);
  assert.equal(keyWithCurrentUnit, `${row.productId}|${row.requestedUnit}`);
});

test("aggregateExpeditionItems keeps separate rows when requestedUnit differs", () => {
  const items: ExpeditionItem[] = [
    makeExpeditionItem({ itemId: "a", requestedUnit: "Kg" }),
    makeExpeditionItem({ itemId: "b", requestedUnit: "Un" }),
  ];

  assert.equal(aggregateExpeditionItems(items).length, 2);
});
