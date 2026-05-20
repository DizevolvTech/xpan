import assert from "node:assert/strict";
import test from "node:test";

import type { ProductionIngredient, ProductionProduct } from "@/lib/production-planning";

import { round3, scaleRecipeQuantity } from "./recipe-expansion";

/**
 * Fixtures mínimas. Só preenchemos os campos que `scaleRecipeQuantity` e
 * `getProductRecipeTotalsFromData` leem; o resto vai como `as ProductionProduct`
 * para evitar ruído (esse é o padrão usado em outros testes do projeto, ex.
 * engine.test.ts).
 */
function makeIngredient(id: string, name: string): ProductionIngredient {
  return {
    id,
    code: id.toUpperCase(),
    name,
    type: "puro",
    unit: "Kg",
    metadata: "",
    observation: "",
    composition: [],
    status: "ativo",
  } as ProductionIngredient;
}

function makePizzaProduct(): ProductionProduct {
  // Receita: 0.6kg farinha + 0.4kg molho = 1.0kg total. Break 0% → output 1.0kg.
  // Vendida em Un (peso/un = 0.25kg, 4 pizzas por kg). Sem ser Kg/L, o ramo de
  // `getProductRecipeTotalsFromData` que divide por `unitWeightKg` é exercitado.
  return {
    id: "pizza",
    code: "PZ-001",
    name: "Pizza Margherita",
    description: "",
    lineId: "line-1",
    active: true,
    availableForOrdering: true,
    validityDays: 1,
    minimumProductionKg: 0,
    economicProductionKg: 0,
    allowsStorage: false,
    productionDays: [],
    expeditionLeadDays: 0,
    unitProfiles: {
      sales: { unit: "Un", description: "unidade", weightKg: 0.25 },
      production: { unit: "Kg", description: "kg", weightKg: 1 },
      expedition: { unit: "Kg", description: "kg", weightKg: 1 },
    },
    isSoldLoose: false,
    recipe: [
      { id: "r1", sourceType: "ingrediente", sourceId: "farinha", label: "Farinha", quantity: 0.6, unit: "Kg" },
      { id: "r2", sourceType: "ingrediente", sourceId: "molho", label: "Molho", quantity: 0.4, unit: "Kg" },
    ],
    preparationStages: [],
    preparationMode: "",
    breakPercent: 0,
    breakStage: "antes_divisao",
    breakComment: "",
    canBeIngredient: false,
    weight: "",
    productionUnit: "Kg",
    salesUnit: "Un",
    salesToKgFactor: 0.25,
    expeditionUnit: "Kg",
    expeditionToKgFactor: 1,
    isMpiIngredient: false,
  } as ProductionProduct;
}

void test("round3 mantém 3 casas decimais e retorna Number", () => {
  assert.equal(round3(1.234567), 1.235);
  assert.equal(round3(0), 0);
  assert.equal(round3(2), 2);
  assert.equal(typeof round3(0.1 + 0.2), "number");
});

void test("scaleRecipeQuantity sem produto retorna a quantidade nominal", () => {
  // Caminho de borda: o caller passa undefined quando não consegue resolver o produto.
  // Não deve quebrar; deve voltar a quantidade pedida tal como veio.
  const result = scaleRecipeQuantity(2, undefined, [], [], 0.5);
  assert.equal(result, 0.5);
});

void test("scaleRecipeQuantity escala linearmente com o output", () => {
  const farinha = makeIngredient("farinha", "Farinha");
  const molho = makeIngredient("molho", "Molho");
  const pizza = makePizzaProduct();

  // Receita base produz 1.0kg. Para 2.0kg, precisamos do dobro de cada item.
  const farinhaPara2kg = scaleRecipeQuantity(2.0, pizza, [farinha, molho], [pizza], 0.6);
  assert.equal(farinhaPara2kg, 1.2);

  const molhoPara2kg = scaleRecipeQuantity(2.0, pizza, [farinha, molho], [pizza], 0.4);
  assert.equal(molhoPara2kg, 0.8);
});

void test("scaleRecipeQuantity com baseOutputKg=0 retorna a quantidade nominal (não divide por zero)", () => {
  // Produto sem receita → totalIngredientsKg = 0 → outputAfterBreakKg = 0 → fallback.
  const produtoSemReceita = { ...makePizzaProduct(), recipe: [] } as ProductionProduct;
  const result = scaleRecipeQuantity(10, produtoSemReceita, [], [produtoSemReceita], 0.5);
  assert.equal(result, 0.5);
});
