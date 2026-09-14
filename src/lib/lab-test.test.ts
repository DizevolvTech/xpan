import assert from "node:assert/strict";
import test from "node:test";

import type { ProductionProduct } from "@/lib/production-planning";
import {
  applyLabTestToProduct,
  bakerPercentLegalHint,
  bakerPercents,
  computeLabTest,
  computeRecipeBakerPercents,
  emptyLabTest,
  ingredientKgPerFinishedUnit,
  normalizeLabTest,
  round6,
  scaleIngredientForUnits,
} from "@/lib/lab-test";

const panetoneBase: ProductionProduct = {
  id: "panetone",
  code: "PR-001",
  name: "Panetone",
  description: "Panetone",
  lineId: "line-1",
  active: true,
  availableForOrdering: true,
  validityDays: 5,
  minimumProductionKg: 0,
  economicProductionKg: 0,
  allowsStorage: false,
  productionDays: ["segunda"],
  expeditionLeadDays: 1,
  unitProfiles: {
    sales: { unit: "Un", description: "Venda", weightKg: 0.4 },
    production: { unit: "Un", description: "Produção", weightKg: 0.4 },
    expedition: { unit: "Caixa", description: "Expedição", weightKg: 4 },
  },
  isSoldLoose: true,
  recipe: [],
  preparationStages: ["em_preparacao"],
  preparationMode: "",
  breakPercent: 0,
  breakStage: "depois_divisao",
  breakComment: "",
  canBeIngredient: false,
  weight: "0,400 Kg",
  productionUnit: "Un",
  salesUnit: "Un",
  salesToKgFactor: 0.4,
  expeditionUnit: "Caixa",
  expeditionToKgFactor: 4,
  isMpiIngredient: false,
  capacityPerBatch: null,
  economicBatchUnit: null,
};

test("panetone: quebra, rendimento e unidade assada iguais à planilha", () => {
  const result = computeLabTest({
    recipeTotalKg: 78.878,
    labTest: {
      ...emptyLabTest(),
      bakedKg: 73.525,
      unitCount: 173,
    },
  });

  assert.ok(result?.complete);
  assert.equal(result.rawDoughKg, 78.878);
  assert.equal(result.usedRecipeSumAsRawDough, true);
  assert.equal(Number(result.breakKg.toFixed(3)), 5.353);
  assert.equal(Number(result.breakPercent.toFixed(2)), 6.79);
  assert.equal(Number(result.yieldPercent.toFixed(2)), 93.21);
  assert.equal(Number(result.bakedUnitKg.toFixed(3)), 0.425);
  assert.equal(round6(result.bakedUnitKg), 0.425);
});

test("pão de fubá 250g: unidade média ~277g; etiqueta 250g não é peso de produção", () => {
  const result = computeLabTest({
    recipeTotalKg: 45,
    labTest: {
      ...emptyLabTest(),
      bakedKg: 41.611,
      unitCount: 150,
      labelWeightKg: 0.25,
    },
  });

  assert.ok(result?.complete);
  assert.equal(round6(result.bakedUnitKg), 0.277407);
  assert.equal(Number(result.bakedUnitGrams.toFixed(3)), 277.407);
  assert.equal(result.labelWeightKg, 0.25);
  assert.notEqual(round6(result.bakedUnitKg), 0.25);
});

test("sobra assada entra no assado efetivo (kg_assados − sobra)", () => {
  const result = computeLabTest({
    recipeTotalKg: 45,
    labTest: {
      ...emptyLabTest(),
      bakedKg: 42,
      leftoverBakedKg: 0.389,
      unitCount: 150,
    },
  });

  assert.ok(result?.complete);
  assert.equal(result.effectiveBakedKg, 41.611);
  assert.equal(round6(result.bakedUnitKg), 0.277407);
});

test("massa crua medida na balança prevalece sobre a soma da receita", () => {
  const result = computeLabTest({
    recipeTotalKg: 80,
    labTest: {
      ...emptyLabTest(),
      rawDoughKg: 78.878,
      bakedKg: 73.525,
      unitCount: 173,
    },
  });

  assert.ok(result?.complete);
  assert.equal(result.rawDoughKg, 78.878);
  assert.equal(result.usedRecipeSumAsRawDough, false);
  assert.equal(Number(result.breakPercent.toFixed(2)), 6.79);
});

test("teste incompleto (sem unidades) não deriva quebra", () => {
  const result = computeLabTest({
    recipeTotalKg: 78.878,
    labTest: {
      ...emptyLabTest(),
      bakedKg: 73.525,
    },
  });

  assert.equal(result?.complete, false);
  assert.equal(result?.breakPercent, 0);
});

test("kg por 1 unidade tem 6 casas; demanda da OP = unitário × unidades", () => {
  assert.equal(ingredientKgPerFinishedUnit(12.345678, 150), 0.082305);
  assert.equal(scaleIngredientForUnits(12.345678, 150, 100), 8.2305);
});

test("baker's % sobre o principal (100%) e true % sobre o total (soma 100%)", () => {
  const percents = computeRecipeBakerPercents([
    { id: "flour", kg: 10, isMain: true, sourceType: "ingrediente", sourceId: "farinha" },
    { id: "water", kg: 6, sourceType: "ingrediente", sourceId: "agua" },
    { id: "salt", kg: 0.2, sourceType: "ingrediente", sourceId: "sal", label: "Sal" },
  ]);

  assert.equal(percents.get("flour")?.overMain, 100);
  assert.equal(percents.get("water")?.overMain, 60);
  assert.equal(percents.get("salt")?.overMain, 2);
  assert.equal(Number((percents.get("flour")?.overTotal ?? 0).toFixed(4)), 61.7284);
  assert.equal(
    Number(
      (
        (percents.get("flour")?.overTotal ?? 0) +
        (percents.get("water")?.overTotal ?? 0) +
        (percents.get("salt")?.overTotal ?? 0)
      ).toFixed(6),
    ),
    100,
  );
});

test("duas linhas da mesma farinha somam a base 100% do baker's %", () => {
  const percents = computeRecipeBakerPercents([
    { id: "esponja", kg: 2, isMain: true, sourceType: "ingrediente", sourceId: "farinha" },
    { id: "massa", kg: 8, sourceType: "ingrediente", sourceId: "farinha" },
    { id: "water", kg: 6, sourceType: "ingrediente", sourceId: "agua" },
  ]);

  assert.equal(percents.get("esponja")?.overMain, 20);
  assert.equal(percents.get("massa")?.overMain, 80);
  assert.equal(percents.get("water")?.overMain, 60);
});

test("sal acima de 2% baker's gera aviso visual; não entra no motor", () => {
  const overMain = bakerPercents(0.3, 10, 16.3).overMain;
  assert.equal(overMain, 3);
  assert.match(bakerPercentLegalHint("Sal refinado", overMain) ?? "", /2%/);
  assert.equal(bakerPercentLegalHint("Açúcar", overMain), null);
});

test("applyLabTestToProduct grava quebra derivada e peso Un = unidade assada, não a etiqueta", () => {
  const applied = applyLabTestToProduct(
    {
      ...panetoneBase,
      labTest: {
        ...emptyLabTest(),
        bakedKg: 41.611,
        unitCount: 150,
        labelWeightKg: 0.25,
      },
    },
    45,
  );

  assert.equal(Number(applied.breakPercent.toFixed(2)), Number(((1 - 41.611 / 45) * 100).toFixed(2)));
  assert.equal(applied.unitProfiles.sales.weightKg, 0.277407);
  assert.equal(applied.unitProfiles.production.weightKg, 0.277407);
  assert.equal(applied.unitProfiles.expedition.weightKg, 4);
});

test("applyLabTestToProduct não mexe em venda/produção em Kg", () => {
  const applied = applyLabTestToProduct(
    {
      ...panetoneBase,
      unitProfiles: {
        sales: { unit: "Kg", description: "Venda", weightKg: 1 },
        production: { unit: "Kg", description: "Produção", weightKg: 1 },
        expedition: { unit: "Kg", description: "Expedição", weightKg: 1 },
      },
      labTest: {
        ...emptyLabTest(),
        bakedKg: 41.611,
        unitCount: 150,
      },
    },
    45,
  );

  assert.equal(applied.unitProfiles.sales.weightKg, 1);
  assert.equal(applied.unitProfiles.production.weightKg, 1);
  assert.ok(applied.breakPercent > 0);
});

test("normalizeLabTest descarta lixo e preserva zeros como null de campo vazio inválido", () => {
  assert.equal(normalizeLabTest(null), null);
  assert.deepEqual(normalizeLabTest({ bakedKg: "41.611", unitCount: 150, leftoverBakedKg: -1 }), {
    rawUnitWeightKg: null,
    rawDoughKg: null,
    bakedKg: 41.611,
    leftoverBakedKg: null,
    unitCount: 150,
    labelWeightKg: null,
  });
});
