import assert from "node:assert/strict";
import test from "node:test";

import { planBatches, deriveBatchStatus } from "@/lib/production-batches";

test("planBatches — enche e sobra na ultima (456 un, cap 100)", () => {
  const plan = planBatches({ totalKg: 50.16, capacityPerBatch: 100, salesToKgFactor: 0.11, salesUnit: "Un" });
  assert.equal(plan.batchCount, 5);
  assert.deepEqual(plan.batchSizes, [100, 100, 100, 100, 56]);
  assert.equal(plan.unitLabel, "Un");
});

test("planBatches — divisao exata (300 un, cap 100)", () => {
  const plan = planBatches({ totalKg: 33, capacityPerBatch: 100, salesToKgFactor: 0.11, salesUnit: "Un" });
  assert.equal(plan.batchCount, 3);
  assert.deepEqual(plan.batchSizes, [100, 100, 100]);
});

test("planBatches — demanda abaixo da capacidade = 1 batida", () => {
  const plan = planBatches({ totalKg: 6.6, capacityPerBatch: 100, salesToKgFactor: 0.11, salesUnit: "Un" });
  assert.equal(plan.batchCount, 1);
  assert.deepEqual(plan.batchSizes, [60]);
});

test("planBatches — sem capacidade = 1 batida com o total", () => {
  const plan = planBatches({ totalKg: 50.16, capacityPerBatch: null, salesToKgFactor: 0.11, salesUnit: "Un" });
  assert.equal(plan.batchCount, 1);
  assert.deepEqual(plan.batchSizes, [456]);
});

test("planBatches — produto em kg (fator 1)", () => {
  const plan = planBatches({ totalKg: 250, capacityPerBatch: 100, salesToKgFactor: 1, salesUnit: "Kg" });
  assert.equal(plan.batchCount, 3);
  assert.deepEqual(plan.batchSizes, [100, 100, 50]);
  assert.equal(plan.unitLabel, "Kg");
});

test("deriveBatchStatus — 0/parcial/completo", () => {
  assert.equal(deriveBatchStatus(0, 5), "nao_iniciado");
  assert.equal(deriveBatchStatus(2, 5), "em_producao");
  assert.equal(deriveBatchStatus(5, 5), "concluido");
  assert.equal(deriveBatchStatus(7, 5), "concluido"); // clamp
});
