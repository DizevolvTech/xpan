import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBatchGroups,
  findMissingBatchDates,
  hoursUntilDeadline,
  isBatchFinished,
  isDeadlinePassed,
  slotOrderDeadline,
  type BatchOrderInput,
} from "./order-batch-progress";

const settings = { leadDays: 4, cutoffTime: "18:00" };

test("prazo do slot = entrega − antecedência, no horário de corte", () => {
  assert.deepEqual(slotOrderDeadline("2026-10-30", 4, "18:00"), { dateKey: "2026-10-26", time: "18:00" });
  const deadline = slotOrderDeadline("2026-10-30", 4, "18:00");
  assert.equal(isDeadlinePassed(deadline, { dateKey: "2026-10-26", time: "17:59" }), false);
  assert.equal(isDeadlinePassed(deadline, { dateKey: "2026-10-26", time: "18:00" }), true);
  assert.equal(isDeadlinePassed(deadline, { dateKey: "2026-10-27", time: "08:00" }), true);
  assert.equal(isDeadlinePassed(deadline, { dateKey: "2026-10-25", time: "23:00" }), false);
  assert.equal(hoursUntilDeadline(deadline, { dateKey: "2026-10-26", time: "10:00" }), 8);
});

function order(partial: Partial<BatchOrderInput> & { storeId: string }): BatchOrderInput {
  return {
    orderId: `o-${partial.storeId}`,
    orderCode: `PD-${partial.storeId}`,
    deliveryDate: "2026-10-30",
    batchId: "b1",
    released: false,
    cancelled: false,
    ...partial,
  };
}

const batch = {
  id: "b1",
  slots: [
    { storeId: "a", deliveryDate: "2026-10-30" },
    { storeId: "b", deliveryDate: "2026-10-30" },
    { storeId: "c", deliveryDate: "2026-10-30" },
  ],
};

test("lote aguarda as lojas antes do prazo; fica pronto quando todas pedem", () => {
  const before = { dateKey: "2026-10-25", time: "10:00" };
  const [partial] = buildBatchGroups([batch], [order({ storeId: "a" }), order({ storeId: "b" })], settings, before);
  assert.equal(partial.state, "aguardando_lojas");
  assert.equal(partial.percent, 67);
  assert.deepEqual(partial.missingStoreIds, ["c"]);
  const [full] = buildBatchGroups(
    [batch],
    [order({ storeId: "a" }), order({ storeId: "b" }), order({ storeId: "c" })],
    settings,
    before,
  );
  assert.equal(full.state, "pronto_para_liberar");
  assert.equal(full.pendingOrderIds.length, 3);
});

test("prazo encerrado libera o lote mesmo sem todas as lojas; liberado sai", () => {
  const after = { dateKey: "2026-10-26", time: "18:30" };
  const [ready] = buildBatchGroups([batch], [order({ storeId: "a" })], settings, after);
  assert.equal(ready.state, "pronto_para_liberar");
  const groups = buildBatchGroups([batch], [order({ storeId: "a", released: true })], settings, after);
  assert.equal(groups[0].state, "liberado");
  assert.equal(isBatchFinished(groups, "b1"), true);
});

test("cancelado não conta como pedido feito; pedido de outro lote não conta", () => {
  const now = { dateKey: "2026-10-25", time: "10:00" };
  const [group] = buildBatchGroups(
    [batch],
    [order({ storeId: "a", cancelled: true }), order({ storeId: "b", batchId: "outro" })],
    settings,
    now,
  );
  assert.equal(group.orderedStores, 0);
  assert.equal(group.state, "aguardando_lojas");
  assert.equal(isBatchFinished([group], "b1"), false);
});

test("aviso de lote esquecido: só datas sem lote e com prazo nas próximas horas", () => {
  const now = { dateKey: "2026-10-25", time: "10:00" };
  const missing = findMissingBatchDates(
    [
      { storeId: "a", deliveryDate: "2026-10-30" },
      { storeId: "b", deliveryDate: "2026-10-30" },
      { storeId: "a", deliveryDate: "2026-10-29" },
      { storeId: "a", deliveryDate: "2026-11-15" },
      { storeId: "a", deliveryDate: "2026-10-27" },
    ],
    [{ storeId: "a", deliveryDate: "2026-10-29" }],
    settings,
    now,
  );
  assert.deepEqual(
    missing.map((item) => [item.deliveryDate, item.storeIds]),
    [["2026-10-30", ["a", "b"]]],
  );
});

test("entrega liberada sem todas as lojas antes do prazo fecha (cartão sai)", () => {
  const before = { dateKey: "2026-10-25", time: "10:00" };
  const groups = buildBatchGroups([batch], [order({ storeId: "a", released: true })], settings, before);
  assert.equal(groups[0].state, "liberado");
  assert.equal(isBatchFinished(groups, "b1"), true);
});
