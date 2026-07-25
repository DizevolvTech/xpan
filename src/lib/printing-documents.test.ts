import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPreWeighingDocument,
  buildProductionSheetDocument,
  groupPrintRowsByStage,
} from "@/lib/printing-documents";
import type { ProductionOrderItem, ProductionOrderRow } from "@/lib/factory-planning/types";
import type {
  ProductionIngredient,
  ProductionProduct,
  RecipeIngredientReference,
  RecipeStageConfigEntry,
} from "@/lib/production-planning";

const ingredients: ProductionIngredient[] = [
  {
    id: "ing-farinha",
    code: "IN-000001",
    name: "Farinha de trigo",
    type: "puro",
    unit: "Kg",
    metadata: "",
    observation: "",
    composition: [],
    status: "ativo",
  },
  {
    id: "ing-cobertura",
    code: "IN-000002",
    name: "Cobertura de chocolate",
    type: "puro",
    unit: "Kg",
    metadata: "",
    observation: "",
    composition: [],
    status: "ativo",
  },
  {
    id: "ing-creme",
    code: "IN-000003",
    name: "Creme de leite",
    type: "puro",
    unit: "Kg",
    metadata: "",
    observation: "",
    composition: [],
    status: "ativo",
  },
];

function buildProduct(
  id: string,
  code: string,
  name: string,
  recipe: RecipeIngredientReference[],
  overrides: Partial<ProductionProduct> = {},
): ProductionProduct {
  return {
    id,
    code,
    externalCode: "",
    name,
    description: "",
    lineId: "line-1",
    active: true,
    availableForOrdering: true,
    validityDays: 3,
    minimumProductionKg: 0,
    economicProductionKg: 0,
    allowsStorage: false,
    productionDays: ["segunda"],
    unitProfiles: {
      sales: { unit: "Kg", description: "Quilo", weightKg: 1 },
      production: { unit: "Kg", description: "Produção", weightKg: 1 },
      expedition: { unit: "Kg", description: "Expedição", weightKg: 1 },
    },
    packagingProfile: undefined,
    isSoldLoose: true,
    recipe,
    preparationStages: ["em_preparacao"],
    preparationMode: "",
    breakPercent: 0,
    breakStage: "depois_divisao",
    breakComment: "",
    canBeIngredient: false,
    ingredientProfile: undefined,
    weight: "1,000 Kg",
    productionUnit: "Kg",
    salesUnit: "Kg",
    salesToKgFactor: 1,
    expeditionUnit: "Kg",
    expeditionToKgFactor: 1,
    expeditionLeadDays: 1,
    isMpiIngredient: false,
    capacityPerBatch: null,
    economicBatchUnit: null,
    ...overrides,
  };
}

/** MPI usado como ingrediente por outros produtos (chantilly). */
const mpiChantilly = buildProduct(
  "mpi-chantilly",
  "PR-00090",
  "Chantilly",
  [{ id: "m1", sourceType: "ingrediente", sourceId: "ing-creme", label: "Creme de leite", quantity: 1, unit: "Kg" }],
  { canBeIngredient: true, isMpiIngredient: true },
);

/** Produto NÃO migrado: nenhuma linha com etapa preenchida (tudo cai em `massa`). */
const legacyProduct = buildProduct("product-pao", "PR-00001", "Pão doce", [
  { id: "l1", sourceType: "ingrediente", sourceId: "ing-farinha", label: "Farinha de trigo", quantity: 5, unit: "Kg" },
  {
    id: "l2",
    sourceType: "ingrediente",
    sourceId: "ing-cobertura",
    label: "Cobertura de chocolate",
    quantity: 2,
    unit: "Kg",
  },
  { id: "l3", sourceType: "produto", sourceId: "mpi-chantilly", label: "Chantilly", quantity: 2, unit: "Kg" },
  { id: "l4", sourceType: "produto", sourceId: "mpi-chantilly", label: "Chantilly", quantity: 1, unit: "Kg" },
]);

/** Produto migrado: etapas preenchidas, inclusive o mesmo insumo em duas etapas. */
const stagedProduct = buildProduct("product-torta", "PR-00002", "Torta de chocolate", [
  {
    id: "s1",
    sourceType: "produto",
    sourceId: "mpi-chantilly",
    label: "Chantilly",
    quantity: 1,
    unit: "Kg",
    stage: "cobertura",
  },
  {
    id: "s2",
    sourceType: "ingrediente",
    sourceId: "ing-farinha",
    label: "Farinha de trigo",
    quantity: 4,
    unit: "Kg",
    stage: "massa",
  },
  {
    id: "s3",
    sourceType: "produto",
    sourceId: "mpi-chantilly",
    label: "Chantilly",
    quantity: 2,
    unit: "Kg",
    stage: "recheio",
  },
  {
    id: "s4",
    sourceType: "ingrediente",
    sourceId: "ing-farinha",
    label: "Farinha de trigo",
    quantity: 1,
    unit: "Kg",
    stage: "esponja",
  },
  {
    id: "s5",
    sourceType: "ingrediente",
    sourceId: "ing-cobertura",
    label: "Cobertura de chocolate",
    quantity: 2,
    unit: "Kg",
    stage: "acabamento",
  },
]);

const products = [legacyProduct, stagedProduct, mpiChantilly];
const source = { products, ingredients };

function buildOpItem(product: ProductionProduct, totalKg: number): ProductionOrderItem {
  return {
    productId: product.id,
    productCode: product.code,
    productName: product.name,
    productionItemKey: `2026-07-24|sector-1|line-1|schedule-1|${product.id}`,
    isIntermediate: false,
    demandSource: "pedido",
    totalKg,
    minimumProductionKg: 0,
    belowMinimum: false,
    productionSequence: 1,
    progress: 0,
    status: "nao_iniciado",
    batchCount: 1,
    batchSizes: [totalKg],
    batchUnitLabel: "Kg",
    batchesDone: 0,
    capacityPerBatch: null,
    preparationStages: ["em_preparacao"],
    sourceItemsCount: 1,
  };
}

function buildOp(product: ProductionProduct, totalKg: number): ProductionOrderRow {
  return {
    id: "op-1",
    code: "OP-0001",
    productionDate: "2026-07-24",
    productionDateLabel: "24/07",
    sectorId: "sector-1",
    sectorName: "Confeitaria",
    lineId: "line-1",
    lineName: "Linha 1",
    scheduleId: "schedule-1",
    scheduleCode: "CR-0001",
    scheduleName: "Cronograma 1",
    itemsCount: 1,
    ordersCount: 1,
    totalKg,
    hasDemand: true,
    releasedToProduction: true,
    productionStarted: false,
    progress: 0,
    status: "agendado",
    orderCodes: ["PD-0001"],
    items: [buildOpItem(product, totalKg)],
    sourceItems: [
      {
        id: "item-1",
        orderId: "order-1",
        orderCode: "PD-0001",
        storeName: "Loja Centro",
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        requestedQuantity: totalKg,
        requestedUnit: "Kg",
        internalKg: totalKg,
        deliveryDate: "2026-07-25",
        deliveryDateLabel: "25/07",
        saleDate: "2026-07-25",
        saleDateLabel: "25/07",
        expeditionUnit: "Kg",
        expeditionQuantity: totalKg,
        productionItemKey: `2026-07-24|sector-1|line-1|schedule-1|${product.id}`,
        productionSequence: 1,
        releasedToProduction: true,
        productionItemStatus: "nao_iniciado",
        workflowProgress: 0,
      },
    ],
  };
}

test("folha de produção: produto SEM etapa preenchida sai idêntico ao de hoje (heurística Adic. + grupo único sem cabeçalho)", () => {
  const document = buildProductionSheetDocument(buildOp(legacyProduct, 10), source);
  const [section] = document.productSections;

  assert.deepEqual(
    section.items.map((row) => [row.label, row.sectionKind]),
    [
      ["Farinha de trigo", "base"],
      ["Cobertura de chocolate", "additional"],
      ["Chantilly", "base"],
      ["Chantilly", "base"],
    ],
  );

  const rows = [
    ...section.items.filter((row) => row.sectionKind !== "additional"),
    ...section.items.filter((row) => row.sectionKind === "additional"),
  ];
  const groups = groupPrintRowsByStage(rows);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].showStageHeader, false);
  assert.equal(groups[0].stage, "massa");
  assert.deepEqual(
    groups[0].rows.map((row) => row.label),
    ["Farinha de trigo", "Chantilly", "Chantilly", "Cobertura de chocolate"],
  );
});

test("folha de produção: produto COM etapa agrupa na ordem canônica e desliga a heurística Adic.", () => {
  const document = buildProductionSheetDocument(buildOp(stagedProduct, 10), source);
  const [section] = document.productSections;

  assert.equal(
    section.items.every((row) => row.sectionKind === "base"),
    true,
  );

  const groups = groupPrintRowsByStage(section.items);
  assert.deepEqual(
    groups.map((group) => group.stage),
    ["esponja", "massa", "recheio", "cobertura", "acabamento"],
  );
  assert.equal(
    groups.every((group) => group.showStageHeader),
    true,
  );
  assert.equal(groups[0].label, "Esponja / Pré-fermento");
  assert.deepEqual(
    groups.map((group) => group.rows.map((row) => row.estimatedQuantity)),
    [[1], [4], [2], [1], [2]],
  );
});

test("pré-pesagem: mesmo MPI em recheio e cobertura vira DUAS seções com pesos próprios", () => {
  const document = buildPreWeighingDocument(buildOp(stagedProduct, 10), source);

  assert.deepEqual(
    document.ingredientProducts.map((section) => [section.productId, section.stage, section.requiredKg]),
    [
      ["mpi-chantilly", "recheio", 2],
      ["mpi-chantilly", "cobertura", 1],
    ],
  );
  assert.deepEqual(
    document.ingredientProducts.map((section) => section.stageLabel),
    ["Recheio", "Cobertura"],
  );
  assert.deepEqual(document.ingredientProducts[0].usedBy, ["Torta de chocolate"]);
});

test("pré-pesagem: receita legada mantém UMA seção somada por MPI e sem rótulo de etapa", () => {
  const document = buildPreWeighingDocument(buildOp(legacyProduct, 10), source);

  assert.equal(document.ingredientProducts.length, 1);
  assert.equal(document.ingredientProducts[0].requiredKg, 3);
  assert.equal(document.ingredientProducts[0].stage, "massa");
  assert.equal(document.ingredientProducts[0].stageLabel, null);

  const [section] = document.productSections;
  assert.deepEqual(
    section.baseIngredients.map((row) => row.label),
    ["Farinha de trigo"],
  );
  assert.deepEqual(
    section.additionalIngredients.map((row) => row.label),
    ["Cobertura de chocolate"],
  );
});

test("pré-pesagem: linhas do produto carregam a etapa para o agrupamento na impressão", () => {
  const document = buildPreWeighingDocument(buildOp(stagedProduct, 10), source);
  const [section] = document.productSections;

  assert.deepEqual(
    groupPrintRowsByStage(section.baseIngredients).map((group) => [
      group.stage,
      group.rows.map((row) => row.label),
    ]),
    [
      ["esponja", ["Farinha de trigo"]],
      ["massa", ["Farinha de trigo"]],
      ["acabamento", ["Cobertura de chocolate"]],
    ],
  );
  assert.equal(section.additionalIngredients.length, 0);
});

/* -------------------------------------------------------------------------------------------------
 * XPAN #6 — a folha impressa acompanha a receita CONGELADA na liberação.
 *
 * A OP de MPI é gerada da receita congelada; se a folha imprimisse a receita ao vivo, o
 * padeiro pesaria uma coisa e a OP diria outra.
 * -----------------------------------------------------------------------------------------------*/

test("folha e pré-pesagem usam a receita CONGELADA quando o item da OP traz frozenRecipe", () => {
  // Receita AO VIVO (editada depois da liberação): farinha + creme.
  const editado = buildProduct("prod-frozen", "PR-9001", "Bolo", [
    { id: "r1", sourceType: "ingrediente", sourceId: "ing-farinha", label: "Farinha de trigo", quantity: 1, unit: "Kg" },
    { id: "r2", sourceType: "ingrediente", sourceId: "ing-creme", label: "Creme de leite", quantity: 0.5, unit: "Kg" },
  ] as RecipeIngredientReference[]);

  // Congelada na liberação: só farinha, e em outra quantidade.
  const congelada = [
    { id: "r1", sourceType: "ingrediente", sourceId: "ing-farinha", label: "Farinha de trigo", quantity: 2, unit: "Kg" },
  ] as RecipeIngredientReference[];

  const localSource = { products: [editado], ingredients };

  const op = buildOp(editado, 10);
  const opCongelada: ProductionOrderRow = {
    ...op,
    items: op.items.map((item): ProductionOrderItem => ({ ...item, frozenRecipe: congelada })),
  };

  const folha = buildProductionSheetDocument(opCongelada, localSource);
  assert.deepEqual(
    folha.productSections[0]!.items.map((row) => row.label),
    ["Farinha de trigo"],
    "a folha imprime a receita congelada, não o creme adicionado depois",
  );

  const prePesagem = buildPreWeighingDocument(opCongelada, localSource);
  assert.deepEqual(
    prePesagem.productSections[0]!.baseIngredients.map((row) => row.label),
    ["Farinha de trigo"],
    "a pré-pesagem também segue a receita congelada",
  );

  // Contraprova: sem frozenRecipe, imprime a receita ao vivo (comportamento anterior).
  const aoVivo = buildProductionSheetDocument(buildOp(editado, 10), localSource);
  assert.deepEqual(
    aoVivo.productSections[0]!.items.map((row) => row.label),
    ["Farinha de trigo", "Creme de leite"],
  );
});

/* -------------------------------------------------------------------------------------------------
 * Ficha em BLOCOS — a impressão respeita a SEQUÊNCIA que a ficha do produto definiu
 * (`recipeStageConfig`) e a folha de produção mostra o modo de preparo de cada bloco.
 * -----------------------------------------------------------------------------------------------*/

/** Ficha que reordena as etapas: cobertura primeiro, depois acabamento e massa. */
const fichaSequenciada: RecipeStageConfigEntry[] = [
  { stage: "cobertura", instructions: "Derreter o chocolate e cobrir ainda morno." },
  { stage: "acabamento", instructions: "" },
  { stage: "massa", instructions: "Bater 10 minutos em velocidade média." },
];

/** Mesma receita do `stagedProduct`, mas com a ficha declarando outra sequência de etapas. */
const stagedWithConfig = buildProduct("product-torta", "PR-00002", "Torta de chocolate", stagedProduct.recipe, {
  recipeStageConfig: fichaSequenciada,
});
const configuredSource = { products: [stagedWithConfig, mpiChantilly], ingredients };

test("retrocompatibilidade: produto sem recipeStageConfig e tudo em `massa` imprime exatamente como antes", () => {
  const document = buildProductionSheetDocument(buildOp(legacyProduct, 10), source);

  // Documento inteiro pinado: nada da ficha em blocos pode vazar para quem não configurou.
  assert.deepEqual(document, {
    productSections: [
      {
        productId: "product-pao",
        productCode: "PR-00001",
        productName: "Pão doce",
        plannedKg: 10,
        requestedQuantity: 10,
        requestedUnit: "Kg",
        unitWeightKg: 1,
        recipeStageConfig: undefined,
        items: [
          {
            key: "product-pao-l1-10",
            sourceType: "ingrediente",
            kind: "ingrediente",
            sectionKind: "base",
            stage: "massa",
            label: "Farinha de trigo",
            unit: "Kg",
            estimatedQuantity: 5,
            batchQuantity: undefined,
            partialQuantity: undefined,
            notes: undefined,
          },
          {
            key: "product-pao-l2-10",
            sourceType: "ingrediente",
            kind: "ingrediente",
            sectionKind: "additional",
            stage: "massa",
            label: "Cobertura de chocolate",
            unit: "Kg",
            estimatedQuantity: 2,
            batchQuantity: undefined,
            partialQuantity: undefined,
            notes: undefined,
          },
          {
            key: "product-pao-l3-10",
            sourceType: "produto",
            kind: "produto_mpi",
            sectionKind: "base",
            stage: "massa",
            label: "Chantilly",
            unit: "Kg",
            estimatedQuantity: 2,
            batchQuantity: undefined,
            partialQuantity: undefined,
            notes: "",
          },
          {
            key: "product-pao-l4-10",
            sourceType: "produto",
            kind: "produto_mpi",
            sectionKind: "base",
            stage: "massa",
            label: "Chantilly",
            unit: "Kg",
            estimatedQuantity: 1,
            batchQuantity: undefined,
            partialQuantity: undefined,
            notes: "",
          },
        ],
      },
    ],
  });

  const [section] = document.productSections;
  const groups = groupPrintRowsByStage(section.items, section.recipeStageConfig);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].showStageHeader, false);
  assert.equal(groups[0].instructions, "", "sem ficha configurada nenhum bloco imprime modo de preparo");

  // Pré-pesagem idem: uma seção somada por MPI, sem rótulo de etapa e sem ficha.
  const prePesagem = buildPreWeighingDocument(buildOp(legacyProduct, 10), source);
  assert.equal(prePesagem.ingredientProducts.length, 1);
  assert.equal(prePesagem.ingredientProducts[0]!.stageLabel, null);
  assert.equal(prePesagem.ingredientProducts[0]!.recipeStageConfig, undefined);
  assert.equal(prePesagem.productSections[0]!.recipeStageConfig, undefined);
});

test("folha de produção: blocos saem na sequência da ficha, cada um com seu modo de preparo", () => {
  const document = buildProductionSheetDocument(buildOp(stagedWithConfig, 10), configuredSource);
  const [section] = document.productSections;

  assert.deepEqual(section.recipeStageConfig, fichaSequenciada);

  const groups = groupPrintRowsByStage(section.items, section.recipeStageConfig);

  // Configuradas primeiro, na ordem da ficha; o resto entra depois, na ordem canônica.
  assert.deepEqual(
    groups.map((group) => [group.stage, group.rows.map((row) => row.label)]),
    [
      ["cobertura", ["Chantilly"]],
      ["acabamento", ["Cobertura de chocolate"]],
      ["massa", ["Farinha de trigo"]],
      ["esponja", ["Farinha de trigo"]],
      ["recheio", ["Chantilly"]],
    ],
  );
  assert.deepEqual(
    groups.map((group) => group.instructions),
    [
      "Derreter o chocolate e cobrir ainda morno.",
      "",
      "Bater 10 minutos em velocidade média.",
      "",
      "",
    ],
  );
  assert.equal(
    groups.every((group) => group.showStageHeader),
    true,
  );
});

test("pré-pesagem: seções de MPI e blocos do produto seguem a sequência da ficha", () => {
  const document = buildPreWeighingDocument(buildOp(stagedWithConfig, 10), configuredSource);

  // Sem ficha a ordem seria recheio → cobertura (canônica); a ficha inverte.
  assert.deepEqual(
    document.ingredientProducts.map((section) => [section.stage, section.requiredKg]),
    [
      ["cobertura", 1],
      ["recheio", 2],
    ],
  );

  const [section] = document.productSections;
  assert.deepEqual(
    groupPrintRowsByStage(section.baseIngredients, section.recipeStageConfig).map((group) => group.stage),
    ["acabamento", "massa", "esponja"],
  );
});

test("a sequência dos blocos vem da ficha AO VIVO, mesmo com a receita congelada na liberação", () => {
  // Ficha ao vivo põe o recheio antes da massa — e nem tem recheio na receita ao vivo.
  const produto = buildProduct(
    "prod-ficha-viva",
    "PR-9002",
    "Rocambole",
    [
      {
        id: "v1",
        sourceType: "ingrediente",
        sourceId: "ing-farinha",
        label: "Farinha de trigo",
        quantity: 3,
        unit: "Kg",
        stage: "massa",
      },
    ] as RecipeIngredientReference[],
    {
      recipeStageConfig: [
        { stage: "recheio", instructions: "Bater o creme até o ponto de espalhar." },
        { stage: "massa", instructions: "Assar em tabuleiro raso." },
      ],
    },
  );

  const congelada = [
    {
      id: "f1",
      sourceType: "ingrediente",
      sourceId: "ing-farinha",
      label: "Farinha de trigo",
      quantity: 2,
      unit: "Kg",
      stage: "massa",
    },
    {
      id: "f2",
      sourceType: "ingrediente",
      sourceId: "ing-creme",
      label: "Creme de leite",
      quantity: 1,
      unit: "Kg",
      stage: "recheio",
    },
  ] as RecipeIngredientReference[];

  const localSource = { products: [produto], ingredients };
  const op = buildOp(produto, 3);
  const opCongelada: ProductionOrderRow = {
    ...op,
    items: op.items.map((item): ProductionOrderItem => ({ ...item, frozenRecipe: congelada })),
  };

  const folha = buildProductionSheetDocument(opCongelada, localSource);
  const [section] = folha.productSections;

  // Quantidades vêm da receita congelada; a sequência dos blocos, da ficha ao vivo.
  assert.deepEqual(
    section.items.map((row) => row.label),
    ["Farinha de trigo", "Creme de leite"],
  );
  assert.deepEqual(section.recipeStageConfig, produto.recipeStageConfig);
  assert.deepEqual(
    groupPrintRowsByStage(section.items, section.recipeStageConfig).map((group) => [
      group.stage,
      group.instructions,
    ]),
    [
      ["recheio", "Bater o creme até o ponto de espalhar."],
      ["massa", "Assar em tabuleiro raso."],
    ],
  );
});
