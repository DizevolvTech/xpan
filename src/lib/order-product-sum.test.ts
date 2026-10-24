import assert from "node:assert/strict";
import test from "node:test";

import { sumOrderItemsByProduct } from "./order-product-sum";

const base = { productCode: "P", requestedUnit: "un", internalKg: 1 };

test("soma por produto e unidade, conta lojas, ignora receita e cronograma", () => {
  const rows = sumOrderItemsByProduct([
    { ...base, productId: "pao", productName: "Pão", requestedQuantity: 0.1, storeId: "a" },
    { ...base, productId: "pao", productName: "Pão", requestedQuantity: 0.2, storeId: "b" },
    { ...base, productId: "pao", productName: "Pão", requestedQuantity: 2, storeId: "b", requestedUnit: "kg" },
    { ...base, productId: "mpi", productName: "Massa", requestedQuantity: 9, storeId: "a", isIntermediate: true },
    { ...base, productId: "bolo", productName: "Bolo", requestedQuantity: 0, storeId: "a", demandSource: "cronograma" },
  ]);
  assert.deepEqual(
    rows.map((row) => [row.productId, row.unit, row.quantity, row.stores, row.kg]),
    [
      ["pao", "un", 0.3, 2, 2],
      ["pao", "kg", 2, 1, 1],
    ],
  );
});
