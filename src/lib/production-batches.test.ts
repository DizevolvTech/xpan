import assert from "node:assert/strict";
import test from "node:test";

import { planBatches, deriveBatchStatus, computePreWeighBatchSplit, deriveCapacityPerBatchFromMainIngredient, deriveCapacityFromProductRecipe, formatBatchSplitPhrase, formatBatchSizesPhrase, deriveEconomicProductionKg, productSalesToKgFactor } from "@/lib/production-batches";

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

/* -------------------------------------------------------------------------------------------------
 * Dimensionamento da batida quando o ingrediente principal aparece em ETAPAS diferentes.
 *
 * O limite é físico: quanto do principal cabe num carregamento da masseira. O que dimensiona
 * a batida é o maior volume presente em UM recipiente por vez — nem o total da ficha, nem
 * uma linha isolada.
 * -----------------------------------------------------------------------------------------------*/

test("esponja + massa SOMAM: o pré-fermento entra inteiro na massa, então a masseira carrega as duas", () => {
  // 2 kg na esponja + 8 kg na massa = 10 kg na masseira final; limite 10 kg → 1 receita cabe.
  const capacity = deriveCapacityFromProductRecipe({
    recipe: [
      { unit: "Kg", quantity: 2, isMain: true, sourceType: "ingrediente", sourceId: "farinha", stage: "esponja" },
      { unit: "Kg", quantity: 8, sourceType: "ingrediente", sourceId: "farinha", stage: "massa" },
    ],
    recipeYieldUnits: 500,
    mainIngredientLimitKg: 10,
  });

  assert.equal(capacity, 500);
});

test("massa + cobertura NÃO somam: são tigelas separadas (cuca com farofa)", () => {
  // Caso real da call: farinha na massa (8 kg) e farinha na farofa da cobertura (2 kg).
  // A farofa é feita à parte — a masseira só vê os 8 kg da massa. Somar (10 kg) daria 500 un
  // e subdimensionaria a batida; o correto é o MAIOR recipiente.
  const capacity = deriveCapacityFromProductRecipe({
    recipe: [
      { unit: "Kg", quantity: 8, isMain: true, sourceType: "ingrediente", sourceId: "farinha", stage: "massa" },
      { unit: "Kg", quantity: 2, sourceType: "ingrediente", sourceId: "farinha", stage: "cobertura" },
    ],
    recipeYieldUnits: 500,
    mainIngredientLimitKg: 10,
  });

  assert.equal(capacity, 625);
});

test("o recipiente que manda é o MAIOR, mesmo quando não é o da linha marcada como principal", () => {
  // Principal marcado no recheio (3 kg), mas a massa concentra 9 kg: a masseira é o gargalo.
  const capacity = deriveCapacityFromProductRecipe({
    recipe: [
      { unit: "Kg", quantity: 3, isMain: true, sourceType: "ingrediente", sourceId: "farinha", stage: "recheio" },
      { unit: "Kg", quantity: 9, sourceType: "ingrediente", sourceId: "farinha", stage: "massa" },
    ],
    recipeYieldUnits: 600,
    mainIngredientLimitKg: 9,
  });

  assert.equal(capacity, 600);
});

test("receita legada (tudo em massa) mantém exatamente o resultado de antes", () => {
  const semEtapa = deriveCapacityFromProductRecipe({
    recipe: [
      { unit: "Kg", quantity: 4, isMain: true, sourceType: "ingrediente", sourceId: "farinha" },
      { unit: "Kg", quantity: 6, sourceType: "ingrediente", sourceId: "farinha" },
    ],
    recipeYieldUnits: 500,
    mainIngredientLimitKg: 10,
  });
  const comMassaExplicita = deriveCapacityFromProductRecipe({
    recipe: [
      { unit: "Kg", quantity: 4, isMain: true, sourceType: "ingrediente", sourceId: "farinha", stage: "massa" },
      { unit: "Kg", quantity: 6, sourceType: "ingrediente", sourceId: "farinha", stage: "massa" },
    ],
    recipeYieldUnits: 500,
    mainIngredientLimitKg: 10,
  });

  assert.equal(semEtapa, 500);
  assert.equal(comMassaExplicita, 500);
});

test("S1.5: óleo na mesa / chocolate no fim não entram na carga da masseira", () => {
  const capacity = deriveCapacityFromProductRecipe({
    recipe: [
      { unit: "Kg", quantity: 8, isMain: true, sourceType: "ingrediente", sourceId: "farinha", stage: "massa" },
      {
        unit: "Kg",
        quantity: 40,
        sourceType: "ingrediente",
        sourceId: "farinha",
        stage: "acabamento",
        countsTowardMixer: false,
      },
    ],
    recipeYieldUnits: 500,
    mainIngredientLimitKg: 10,
  });

  assert.equal(capacity, 625);
});

test("S2.2 planilha Chama: 3600 Un / cap 1200 = 3 cheias, sem parcial", () => {
  const plan = planBatches({
    totalKg: 3600 * 0.05,
    capacityPerBatch: 1200,
    salesToKgFactor: 0.05,
    salesUnit: "Un",
  });
  assert.deepEqual(plan.batchSizes, [1200, 1200, 1200]);
  assert.equal(formatBatchSizesPhrase(plan.batchSizes, "Un"), "3 cheias de 1200 Un");

  const split = computePreWeighBatchSplit({
    totalKg: 3600 * 0.05,
    capacityPerBatch: 1200,
    salesToKgFactor: 0.05,
    salesUnit: "Un",
  });
  assert.equal(split.fullBatchCount, 3);
  assert.equal(split.partialUnits, 0);
  assert.equal(formatBatchSplitPhrase(split), "3 cheias de 1200 Un");
  assert.equal(formatBatchSplitPhrase(split, "kg"), "3 cheias de 60 kg");
});

test("S2.2: 256 Un cap 100 = 2 cheias + 1 parcial de 56", () => {
  const split = computePreWeighBatchSplit({
    totalKg: 28.16,
    capacityPerBatch: 100,
    salesToKgFactor: 0.11,
    salesUnit: "Un",
  });
  assert.equal(formatBatchSplitPhrase(split), "2 cheias de 100 Un + 1 parcial de 56 Un");
  assert.equal(formatBatchSizesPhrase([100, 100, 56], "Un"), "2 cheias de 100 Un + 1 parcial de 56 Un");
});

test("S2.1: base econômica = capacidade × peso da Un", () => {
  assert.equal(deriveEconomicProductionKg(1200, 0.05), 60);
  assert.equal(deriveEconomicProductionKg(null, 0.05), 0);
});

test("S2.3: Un cadastrada 170 g vence salesToKgFactor default 1", () => {
  assert.equal(
    productSalesToKgFactor({
      salesUnit: "Un",
      salesToKgFactor: 1,
      unitProfiles: { sales: { unit: "Un", weightKg: 0.17 } },
    }),
    0.17,
  );
});

// ── Produto vendido em Kg: a batida é um PESO exato, não uma contagem inteira ─────────────────
const somaKg = (s: ReturnType<typeof computePreWeighBatchSplit>) =>
  Number((s.fullBatchCount * s.fullBatchKg + s.partialKg).toFixed(3));

test("Kg: 10,4 kg com batida de 4 kg = 4 + 4 + 2,4 e a soma das fichas é a carga da OP", () => {
  const input = { totalKg: 10.4, capacityPerBatch: 4, salesToKgFactor: 1, salesUnit: "Kg" };
  assert.deepEqual(planBatches(input).batchSizes, [4, 4, 2.4]);
  const s = computePreWeighBatchSplit(input);
  assert.equal(s.fullBatchCount, 2);
  assert.equal(s.partialUnits, 2.4);
  assert.equal(somaKg(s), 10.4);
});

test("Kg: pedido menor que a batida vira UMA parcial com o valor exato (antes virava ficha vazia)", () => {
  const input = { totalKg: 0.4, capacityPerBatch: 4, salesToKgFactor: 1, salesUnit: "Kg" };
  assert.deepEqual(planBatches(input).batchSizes, [0.4]);
  const s = computePreWeighBatchSplit(input);
  assert.equal(s.fullBatchCount, 0);
  assert.equal(s.partialKg, 0.4);
  assert.equal(somaKg(s), 0.4);
});

test("Kg: capacidade decimal (4,5 kg) é respeitada, não cortada para 4", () => {
  const input = { totalKg: 13.6, capacityPerBatch: 4.5, salesToKgFactor: 1, salesUnit: "Kg" };
  assert.deepEqual(planBatches(input).batchSizes, [4.5, 4.5, 4.5, 0.1]);
  const s = computePreWeighBatchSplit(input);
  assert.equal(s.fullBatchUnits, 4.5);
  assert.equal(somaKg(s), 13.6);
});

test("Kg: múltiplo exato não cria parcial e a divisão não deriva em ponto flutuante", () => {
  const input = { totalKg: 0.9, capacityPerBatch: 0.3, salesToKgFactor: 1, salesUnit: "Kg" };
  assert.deepEqual(planBatches(input).batchSizes, [0.3, 0.3, 0.3]);
  const s = computePreWeighBatchSplit(input);
  assert.equal(s.fullBatchCount, 3);
  assert.equal(s.partialUnits, 0);
});

test("Kg: soma das fichas = carga da OP em toda a faixa de pedidos (varredura)", () => {
  for (const cap of [0.5, 4, 4.5, 76, 1000]) {
    for (let milli = 1; milli <= 3000; milli += 37) {
      const totalKg = milli / 1000;
      const input = { totalKg, capacityPerBatch: cap, salesToKgFactor: 1, salesUnit: "Kg" };
      const sizes = planBatches(input).batchSizes;
      assert.ok(sizes.every((x) => x > 0), `ficha vazia em ${totalKg} kg / cap ${cap}`);
      assert.equal(Number(sizes.reduce((a, b) => a + b, 0).toFixed(3)), totalKg, `plano ${totalKg} kg / cap ${cap}`);
      assert.equal(somaKg(computePreWeighBatchSplit(input)), totalKg, `split ${totalKg} kg / cap ${cap}`);
    }
  }
});

test("Kg: capacidade abaixo de 1 grama é recusada com mensagem de peso", () => {
  const input = { totalKg: 1, capacityPerBatch: 0.0004, salesToKgFactor: 1, salesUnit: "Kg" };
  assert.throws(() => planBatches(input), /0,001 kg/);
  assert.throws(() => computePreWeighBatchSplit(input), /0,001 kg/);
});

test("Un: continua em unidades INTEIRAS (a correção não vaza para produto contado)", () => {
  const input = { totalKg: 125.2, capacityPerBatch: 100.9, salesToKgFactor: 0.5, salesUnit: "Un" };
  assert.deepEqual(planBatches(input).batchSizes, [100, 100, 50]);
  const s = computePreWeighBatchSplit(input);
  assert.equal(s.fullBatchUnits, 100);
  assert.equal(Number.isInteger(s.partialUnits), true);
  assert.throws(() => planBatches({ totalKg: 1, capacityPerBatch: 0.5, salesToKgFactor: 1, salesUnit: "Un" }), /unidade inteira/);
});

test("unidade escrita 'KG' ou com espaço também é peso", () => {
  const input = { totalKg: 10.4, capacityPerBatch: 4, salesToKgFactor: 1, salesUnit: " KG " };
  assert.deepEqual(planBatches(input).batchSizes, [4, 4, 2.4]);
});

// Cartão #42 — mínimo e máximo por batida (exemplos do cliente: bolo mín. 4, máx. 9).
const CLIENT_CASES: Array<[number, number[]]> = [
  [10, [6, 4]],
  [11, [7, 4]],
  [12, [8, 4]],
  [15, [9, 6]],
  [18, [9, 9]],
  [19, [9, 6, 4]],
  [20, [9, 7, 4]],
  [21, [9, 8, 4]],
  [22, [9, 9, 4]],
  [23, [9, 9, 5]],
  [28, [9, 9, 6, 4]],
];

for (const [total, expected] of CLIENT_CASES) {
  test(`planBatches mín. 4 / máx. 9 — ${total} un = ${expected.join(" + ")}`, () => {
    const plan = planBatches({ totalKg: total, capacityPerBatch: 9, salesToKgFactor: 1, salesUnit: "Un", minPerBatch: 4 });
    assert.deepEqual(plan.batchSizes, expected);
    assert.equal(plan.batchCount, expected.length);
    assert.equal(plan.belowMinimumPerBatch, false);
  });
}

test("planBatches mín./máx. — soma igual ao pedido, batidas no intervalo e mínimo de batidas (1 a 200 un)", () => {
  for (let total = 4; total <= 200; total += 1) {
    const plan = planBatches({ totalKg: total, capacityPerBatch: 9, salesToKgFactor: 1, salesUnit: "Un", minPerBatch: 4 });
    assert.equal(plan.batchSizes.reduce((a, b) => a + b, 0), total, `soma ${total}`);
    assert.equal(plan.batchCount, Math.ceil(total / 9), `nº de batidas ${total}`);
    for (const size of plan.batchSizes) {
      assert.ok(size >= 4 && size <= 9, `${total}: batida ${size} fora de 4..9`);
    }
    const sorted = [...plan.batchSizes].sort((a, b) => b - a);
    assert.deepEqual(plan.batchSizes, sorted, `maiores primeiro ${total}`);
  }
});

test("planBatches mín./máx. — pedido abaixo do mínimo: 1 batida com o total e aviso", () => {
  const plan = planBatches({ totalKg: 3, capacityPerBatch: 9, salesToKgFactor: 1, salesUnit: "Un", minPerBatch: 4 });
  assert.deepEqual(plan.batchSizes, [3]);
  assert.equal(plan.belowMinimumPerBatch, true);
});

test("planBatches mín./máx. — sem mínimo cadastrado mantém a regra antiga (12 = 9 + 3)", () => {
  const plan = planBatches({ totalKg: 12, capacityPerBatch: 9, salesToKgFactor: 1, salesUnit: "Un" });
  assert.deepEqual(plan.batchSizes, [9, 3]);
  assert.equal(plan.belowMinimumPerBatch, false);
});

test("planBatches mín./máx. — sem divisão possível (mín. 4 / máx. 5, 6 un): regra antiga e aviso", () => {
  const plan = planBatches({ totalKg: 6, capacityPerBatch: 5, salesToKgFactor: 1, salesUnit: "Un", minPerBatch: 4 });
  assert.deepEqual(plan.batchSizes, [5, 1]);
  assert.equal(plan.belowMinimumPerBatch, true);
});

test("planBatches mín./máx. — produto em Kg (mín. 4 kg / máx. 9 kg, 12,5 kg)", () => {
  const plan = planBatches({ totalKg: 12.5, capacityPerBatch: 9, salesToKgFactor: 1, salesUnit: "Kg", minPerBatch: 4 });
  assert.deepEqual(plan.batchSizes, [8.5, 4]);
});

test("computePreWeighBatchSplit mín./máx. — 28 un = 2 cheias de 9 + parcial 6 + parcial 4", () => {
  const split = computePreWeighBatchSplit({ totalKg: 28 * 0.5, capacityPerBatch: 9, salesToKgFactor: 0.5, salesUnit: "Un", minPerBatch: 4 });
  assert.equal(split.fullBatchCount, 2);
  assert.equal(split.fullBatchUnits, 9);
  assert.deepEqual(split.partials, [{ units: 6, kg: 3, count: 1 }, { units: 4, kg: 2, count: 1 }]);
  assert.equal(formatBatchSplitPhrase(split), "2 cheias de 9 Un + 1 parcial de 6 Un + 1 parcial de 4 Un");
});

test("formatBatchSizesPhrase — várias parciais iguais (9 + 4 + 4)", () => {
  assert.equal(formatBatchSizesPhrase([9, 4, 4], "Un"), "1 cheia de 9 Un + 2 parciais de 4 Un");
});
