import assert from "node:assert/strict";
import test from "node:test";

import {
  batchCoversSlot,
  batchSlotKey,
  deriveBatchSlots,
  pendingBatchSlots,
} from "@/lib/order-batch-plan";

test("deriveBatchSlots — dedupe de (loja × data) do plano do cronograma", () => {
  const slots = deriveBatchSlots([
    { storeId: "store-01", deliveryDate: "2026-07-27" },
    { storeId: "store-02", deliveryDate: "2026-07-27" },
    { storeId: "store-01", deliveryDate: "2026-07-27" }, // duplicado
    { storeId: "store-01", deliveryDate: "2026-07-29" },
  ]);
  assert.deepEqual(slots, [
    { storeId: "store-01", deliveryDate: "2026-07-27" },
    { storeId: "store-02", deliveryDate: "2026-07-27" },
    { storeId: "store-01", deliveryDate: "2026-07-29" },
  ]);
});

test("batchCoversSlot — gate: só cobre pares (loja × data) que existem no lote", () => {
  const slots = [
    { storeId: "store-01", deliveryDate: "2026-07-27" },
    { storeId: "store-02", deliveryDate: "2026-07-29" },
  ];
  assert.equal(batchCoversSlot(slots, "store-01", "2026-07-27"), true);
  assert.equal(batchCoversSlot(slots, "store-02", "2026-07-29"), true);
  // loja certa, data errada → não cobre
  assert.equal(batchCoversSlot(slots, "store-01", "2026-07-29"), false);
  // data certa, loja errada → não cobre (não é produto cartesiano)
  assert.equal(batchCoversSlot(slots, "store-03", "2026-07-27"), false);
  assert.equal(batchCoversSlot([], "store-01", "2026-07-27"), false);
});

test("pendingBatchSlots — remove os slots que já viraram pedido real (base do X/Y)", () => {
  const slots = [
    { storeId: "store-01", deliveryDate: "2026-07-27" },
    { storeId: "store-02", deliveryDate: "2026-07-27" },
    { storeId: "store-01", deliveryDate: "2026-07-29" },
  ];
  const ordered = [batchSlotKey("store-01", "2026-07-27")];
  assert.deepEqual(pendingBatchSlots(slots, ordered), [
    { storeId: "store-02", deliveryDate: "2026-07-27" },
    { storeId: "store-01", deliveryDate: "2026-07-29" },
  ]);
  // nenhum pedido criado → todos pendentes
  assert.equal(pendingBatchSlots(slots, []).length, 3);
  // todos criados → nenhum pendente
  assert.equal(
    pendingBatchSlots(slots, slots.map((s) => batchSlotKey(s.storeId, s.deliveryDate))).length,
    0,
  );
});
