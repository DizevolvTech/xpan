import assert from "node:assert/strict";
import test from "node:test";

import {
  getProductOperationalStatusLabel,
  getProductRecipeTotalsFromData,
} from "@/lib/production-data-utils";
import type { ProductionIngredient, ProductionProduct } from "@/lib/production-planning";

const ingredients: ProductionIngredient[] = [
  {
    id: "ingredient-eggs",
    code: "IN-000001",
    externalCode: "",
    name: "Ovos",
    type: "puro",
    unit: "Un",
    purchaseUnit: "Dz",
    purchaseToConsumptionFactor: 12,
    metadata: "",
    observation: "",
    composition: [],
    status: "ativo",
  },
];

const baseProduct: ProductionProduct = {
  id: "product-cake",
  code: "PR-00001",
  externalCode: "",
  name: "Bolo",
  description: "",
  lineId: "line-1",
  active: true,
  availableForOrdering: true,
  validityDays: 5,
  minimumProductionKg: 20,
  economicProductionKg: 20,
  allowsStorage: false,
  productionDays: ["segunda"],
  saleLeadDays: 1,
  unitProfiles: {
    sales: { unit: "Un", description: "Unidade", weightKg: 0.25 },
    production: { unit: "Kg", description: "Produção", weightKg: 1 },
    expedition: { unit: "Caixa", description: "Caixa", weightKg: 1 },
  },
  packagingProfile: undefined,
  isSoldLoose: true,
  recipe: [
    {
      id: "recipe-eggs",
      sourceType: "ingrediente",
      sourceId: "ingredient-eggs",
      label: "Ovos",
      quantity: 1,
      unit: "Dz",
    },
  ],
  preparationStages: ["em_preparacao"],
  preparationMode: "",
  breakPercent: 0,
  breakStage: "depois_divisao",
  breakComment: "",
  canBeIngredient: false,
  ingredientProfile: undefined,
  weight: "0,250 Kg",
  productionUnit: "Kg",
  salesUnit: "Un",
  salesToKgFactor: 0.25,
  expeditionUnit: "Caixa",
  expeditionToKgFactor: 1,
  isMpiIngredient: false,
};

test("recipe totals convert purchase unit into consumption unit before weight calculation", () => {
  const totals = getProductRecipeTotalsFromData(baseProduct, ingredients, []);

  assert.equal(totals.totalIngredientsKg, 12);
});

test("recipe totals include final quantity derived from unit sale weight", () => {
  const totals = getProductRecipeTotalsFromData(
    {
      ...baseProduct,
      recipe: [
        {
          id: "recipe-flour",
          sourceType: "ingrediente",
          sourceId: "missing",
          label: "Farinha",
          quantity: 2,
          unit: "Kg",
        },
      ],
    },
    [],
    [],
  );

  assert.equal(totals.outputAfterBreakKg, 2);
  assert.equal(totals.finalOutputQuantity, 8);
  assert.equal(totals.finalOutputUnit, "Un");
});

test("operational status label reflects whether the product is in the active schedule portfolio", () => {
  assert.equal(
    getProductOperationalStatusLabel({
      operationalLineId: "line-1",
    }),
    "No cronograma ativo",
  );

  assert.equal(
    getProductOperationalStatusLabel({
      operationalLineId: undefined,
    }),
    "Fora do cronograma ativo",
  );
});
