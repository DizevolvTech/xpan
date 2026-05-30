import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDefaultScheduleDayPriorities,
  deriveProductionDaysFromDayPriorities,
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

test("AJ-0004.1: decimal preciso das frações finais propaga (não só ceil para unidade discreta)", () => {
  // 2,99 kg de saída / 0,35 kg por unidade = 8,542857… (ex. do card).
  const totals = getProductRecipeTotalsFromData(
    {
      ...baseProduct,
      unitProfiles: {
        sales: { unit: "Un", description: "Unidade", weightKg: 0.35 },
        production: { unit: "Kg", description: "Produção", weightKg: 1 },
        expedition: { unit: "Caixa", description: "Caixa", weightKg: 1 },
      },
      recipe: [
        {
          id: "recipe-massa",
          sourceType: "ingrediente",
          sourceId: "missing",
          label: "Massa",
          quantity: 2.99,
          unit: "Kg",
        },
      ],
    },
    [],
    [],
  );

  // Display/downstream: valor preciso (não arredondado para unidade discreta).
  assert.ok(
    Math.abs(totals.finalFractionsQuantityPrecise - 8.542857142857143) < 1e-9,
    `esperava ~8,542857, recebeu ${totals.finalFractionsQuantityPrecise}`,
  );
  // Não pode ter sido truncado para inteiro nem para 2 casas.
  assert.notEqual(totals.finalFractionsQuantityPrecise, 9);
  assert.notEqual(totals.finalFractionsQuantityPrecise, 8.54);
  // O campo "ordenável" segue arredondando para cima (unidade inteira).
  assert.equal(totals.finalFractionsQuantity, 9);
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

test("derives production days from a dayPriorities payload (drag de [sabado, domingo] para [segunda, quarta])", () => {
  // Simula o frontend arrastando um produto que produzia em sábado+domingo
  // para passar a produzir em segunda+quarta. Como o payload do PATCH só
  // carrega o objeto de dias novos, o backend deve derivar production_days
  // a partir das chaves desse objeto — exatamente o bug que essa mudança
  // corrige.
  const { days, invalidKeys } = deriveProductionDaysFromDayPriorities({
    segunda: 1,
    quarta: 2,
  });

  assert.deepEqual(days, ["segunda", "quarta"]);
  assert.deepEqual(invalidKeys, []);

  // E o normalizador de prioridades agora deve operar com os dias NOVOS,
  // não com os antigos do item — preservando os números fornecidos.
  const normalized = normalizeScheduleDayPriorities(
    { segunda: 1, quarta: 2 },
    days,
  );
  assert.deepEqual(normalized, { segunda: 1, quarta: 2 });
});

test("derived production days are sorted by canonical weekday order and deduplicated", () => {
  // Payload propositalmente fora de ordem; resultado deve seguir
  // sortProductionDays (segunda → ... → domingo).
  const { days } = deriveProductionDaysFromDayPriorities({
    domingo: 1,
    quarta: 1,
    segunda: 1,
    sabado: 1,
  });

  assert.deepEqual(days, ["segunda", "quarta", "sabado", "domingo"]);
});

test("derives empty days for null/undefined/{} payload (caller deve bloquear)", () => {
  assert.deepEqual(deriveProductionDaysFromDayPriorities(undefined), {
    days: [],
    invalidKeys: [],
  });
  assert.deepEqual(deriveProductionDaysFromDayPriorities(null), {
    days: [],
    invalidKeys: [],
  });
  assert.deepEqual(deriveProductionDaysFromDayPriorities({}), {
    days: [],
    invalidKeys: [],
  });
});

test("reports invalid weekday keys without throwing", () => {
  // Simula um payload malicioso/bug do cliente com chaves fora do enum.
  // Cast deliberado: o contrato é `Partial<Record<ProductionWeekDay, number>>`,
  // mas em runtime o JSON.parse não garante nada — a função precisa lidar.
  const payload = { segunda: 1, foo: 2, sunday: 3 } as unknown as Partial<
    Record<import("@/lib/production-planning").ProductionWeekDay, number>
  >;
  const { days, invalidKeys } = deriveProductionDaysFromDayPriorities(payload);

  assert.deepEqual(days, ["segunda"]);
  assert.deepEqual(invalidKeys.sort(), ["foo", "sunday"]);
});
