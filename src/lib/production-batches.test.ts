import assert from "node:assert/strict";
import test from "node:test";

import { planBatches, deriveBatchStatus, computePreWeighBatchSplit, deriveCapacityPerBatchFromMainIngredient, deriveCapacityFromProductRecipe } from "@/lib/production-batches";

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

// XPAN-8 — capacidade por batida derivada do ingrediente principal.

test("XPAN-8: deriveCapacityPerBatchFromMainIngredient — 50kg de trigo, receita usa 10kg e rende 100un → 500un/batida", () => {
  assert.equal(
    deriveCapacityPerBatchFromMainIngredient({
      mainIngredientKgInRecipe: 10,
      recipeYieldUnits: 100,
      mainIngredientLimitKg: 50,
    }),
    500,
  );
});

test("XPAN-8: deriveCapacityPerBatchFromMainIngredient — arredonda para baixo (rende fracionário)", () => {
  // 50kg × 33un / 7kg = 235,7 → 235
  assert.equal(
    deriveCapacityPerBatchFromMainIngredient({
      mainIngredientKgInRecipe: 7,
      recipeYieldUnits: 33,
      mainIngredientLimitKg: 50,
    }),
    235,
  );
});

test("XPAN-8: deriveCapacityPerBatchFromMainIngredient — null quando limite pequeno demais (< 1 un/batida)", () => {
  assert.equal(
    deriveCapacityPerBatchFromMainIngredient({
      mainIngredientKgInRecipe: 100,
      recipeYieldUnits: 1,
      mainIngredientLimitKg: 0.5,
    }),
    null,
  );
});

test("XPAN-8: deriveCapacityPerBatchFromMainIngredient — null para insumos inválidos (zero/negativo)", () => {
  assert.equal(
    deriveCapacityPerBatchFromMainIngredient({ mainIngredientKgInRecipe: 0, recipeYieldUnits: 10, mainIngredientLimitKg: 50 }),
    null,
  );
  assert.equal(
    deriveCapacityPerBatchFromMainIngredient({ mainIngredientKgInRecipe: 10, recipeYieldUnits: 0, mainIngredientLimitKg: 50 }),
    null,
  );
  assert.equal(
    deriveCapacityPerBatchFromMainIngredient({ mainIngredientKgInRecipe: 10, recipeYieldUnits: 10, mainIngredientLimitKg: 0 }),
    null,
  );
});

// XPAN-8 — orquestração a partir da receita do produto.

test("XPAN-8: deriveCapacityFromProductRecipe — principal em Kg (10kg/receita, rende 100un), limite 50kg → 500un", () => {
  assert.equal(
    deriveCapacityFromProductRecipe({
      recipe: [
        { unit: "Kg", quantity: 10, isMain: true },
        { unit: "Kg", quantity: 2 },
      ],
      recipeYieldUnits: 100,
      mainIngredientLimitKg: 50,
    }),
    500,
  );
});

test("XPAN-8: deriveCapacityFromProductRecipe — sem ingrediente principal → null", () => {
  assert.equal(
    deriveCapacityFromProductRecipe({
      recipe: [{ unit: "Kg", quantity: 10 }],
      recipeYieldUnits: 100,
      mainIngredientLimitKg: 50,
    }),
    null,
  );
});

test("XPAN-8: deriveCapacityFromProductRecipe — principal fora de Kg → null (sem conversão automática)", () => {
  assert.equal(
    deriveCapacityFromProductRecipe({
      recipe: [{ unit: "Un", quantity: 10, isMain: true }],
      recipeYieldUnits: 100,
      mainIngredientLimitKg: 50,
    }),
    null,
  );
});

test("XPAN-8: deriveCapacityFromProductRecipe — limite não definido → null", () => {
  assert.equal(
    deriveCapacityFromProductRecipe({
      recipe: [{ unit: "Kg", quantity: 10, isMain: true }],
      recipeYieldUnits: 100,
      mainIngredientLimitKg: null,
    }),
    null,
  );
  assert.equal(
    deriveCapacityFromProductRecipe({
      recipe: [{ unit: "Kg", quantity: 10, isMain: true }],
      recipeYieldUnits: 100,
      mainIngredientLimitKg: undefined,
    }),
    null,
  );
});

test("etapa na receita: deriveCapacityFromProductRecipe SOMA todas as linhas do ingrediente principal", () => {
  // Farinha na esponja (2 kg) + farinha na massa (8 kg) = 10 kg por receita.
  // Considerar só a linha marcada (8 kg) superestimaria a batida (625 un).
  assert.equal(
    deriveCapacityFromProductRecipe({
      recipe: [
        { sourceType: "ingrediente", sourceId: "ing-farinha", unit: "Kg", quantity: 2 },
        { sourceType: "ingrediente", sourceId: "ing-farinha", unit: "Kg", quantity: 8, isMain: true },
        { sourceType: "ingrediente", sourceId: "ing-sal", unit: "Kg", quantity: 1 },
      ],
      recipeYieldUnits: 100,
      mainIngredientLimitKg: 50,
    }),
    500,
  );
});

test("etapa na receita: só soma linhas da MESMA fonte e em Kg (sem conversão automática)", () => {
  // A linha em `g` do mesmo ingrediente é ignorada (mesma regra do principal fora de Kg)
  // e a linha de outra fonte não entra na soma.
  assert.equal(
    deriveCapacityFromProductRecipe({
      recipe: [
        { sourceType: "ingrediente", sourceId: "ing-farinha", unit: "Kg", quantity: 10, isMain: true },
        { sourceType: "ingrediente", sourceId: "ing-farinha", unit: "g", quantity: 500 },
        { sourceType: "produto", sourceId: "ing-farinha", unit: "Kg", quantity: 5 },
      ],
      recipeYieldUnits: 100,
      mainIngredientLimitKg: 50,
    }),
    500,
  );
});

test("etapa na receita: sem sourceId (chamador legado) usa só a linha marcada", () => {
  assert.equal(
    deriveCapacityFromProductRecipe({
      recipe: [
        { unit: "Kg", quantity: 10, isMain: true },
        { unit: "Kg", quantity: 10 },
      ],
      recipeYieldUnits: 100,
      mainIngredientLimitKg: 50,
    }),
    500,
  );
});
