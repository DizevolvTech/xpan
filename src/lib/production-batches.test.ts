import assert from "node:assert/strict";
import test from "node:test";

import { planBatches, deriveBatchStatus, computePreWeighBatchSplit } from "@/lib/production-batches";

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

test("computePreWeighBatchSplit — 256 un (cap 100): 2 cheias + parcial 56", () => {
  const split = computePreWeighBatchSplit({ totalKg: 28.16, capacityPerBatch: 100, salesToKgFactor: 0.11, salesUnit: "Un" });
  assert.equal(split.batched, true);
  assert.equal(split.fullBatchCount, 2);
  assert.equal(split.fullBatchUnits, 100);
  assert.equal(split.partialUnits, 56);
  assert.ok(Math.abs(split.fullBatchKg - 11) < 1e-9);
});

test("computePreWeighBatchSplit — multiplo exato 300 un (cap 100): sem parcial", () => {
  const split = computePreWeighBatchSplit({ totalKg: 33, capacityPerBatch: 100, salesToKgFactor: 0.11, salesUnit: "Un" });
  assert.equal(split.fullBatchCount, 3);
  assert.equal(split.partialUnits, 0);
  assert.ok(Math.abs(split.partialKg - 0) < 1e-9);
});

test("computePreWeighBatchSplit — sub-capacidade 60 un (cap 100): so parcial", () => {
  const split = computePreWeighBatchSplit({ totalKg: 6.6, capacityPerBatch: 100, salesToKgFactor: 0.11, salesUnit: "Un" });
  assert.equal(split.fullBatchCount, 0);
  assert.equal(split.partialUnits, 60);
});

test("computePreWeighBatchSplit — nao batido (capacityPerBatch null)", () => {
  const split = computePreWeighBatchSplit({ totalKg: 50.16, capacityPerBatch: null, salesToKgFactor: 0.11, salesUnit: "Un" });
  assert.equal(split.batched, false);
  assert.equal(split.partialUnits, split.totalUnits);
});

test("deriveBatchStatus — 0/parcial/completo", () => {
  assert.equal(deriveBatchStatus(0, 5), "nao_iniciado");
  assert.equal(deriveBatchStatus(2, 5), "em_producao");
  assert.equal(deriveBatchStatus(5, 5), "concluido");
  assert.equal(deriveBatchStatus(7, 5), "concluido"); // clamp
});
