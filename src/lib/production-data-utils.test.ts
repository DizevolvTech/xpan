import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDefaultScheduleDayPriorities,
  getProductOperationalStatusLabel,
  getProductRecipeTotalsFromData,
  normalizeScheduleDayPriorities,
  sortScheduleEntriesForDay,
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
      expeditionLeadDays: 1,
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
  assert.equal(totals.fractionUnitWeightKg, 0.25);
  assert.equal(totals.finalFractionsQuantity, 8);
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

test("schedule day priorities fall back to the production-day order when missing", () => {
  const defaults = buildDefaultScheduleDayPriorities([
    { productionDays: ["segunda", "terca"] },
    { productionDays: ["segunda"] },
    { productionDays: ["terca"] },
  ]);

  assert.deepEqual(defaults, [
    { segunda: 1, terca: 1 },
    { segunda: 2 },
    { terca: 2 },
  ]);
});

test("schedule day priorities are normalized and keep only active production days", () => {
  const normalized = normalizeScheduleDayPriorities(
    { segunda: 3, quinta: 9 },
    ["segunda", "quarta"],
    { segunda: 1, quarta: 2 },
  );

  assert.deepEqual(normalized, {
    segunda: 3,
    quarta: 2,
  });
});

test("schedule entries sort by day priority before alphabetical fallback", () => {
  const ordered = sortScheduleEntriesForDay(
    [
      {
        code: "PR-0002",
        name: "Pão B",
        dayPriorities: { segunda: 2 },
      },
      {
        code: "PR-0003",
        name: "Pão C",
        dayPriorities: {},
      },
      {
        code: "PR-0001",
        name: "Pão A",
        dayPriorities: { segunda: 1 },
      },
    ],
    "segunda",
  );

  assert.deepEqual(
    ordered.map((item) => item.code),
    ["PR-0001", "PR-0002", "PR-0003"],
  );
});
