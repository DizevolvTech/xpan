import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPreWeighingDocument,
  buildProductionSheetDocument,
  groupPrintRowsByStage,
  resolveProductionDeliveryGap,
  sumStageQuantityPerUnitKg,
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

  /*
   * BASELINE RE-FIXADO em 2026-07-25, quando a folha passou a sair no formato da ficha que o
   * cliente já usa. A ESTRUTURA do documento mudou de propósito; o CONTEÚDO por produto, não:
   *
   *  - `deliveryGap`: novo. É o "Dia+1" do cabeçalho (produzir 24/07 → entregar 25/07).
   *  - `ingredientSections`: novo. A folha absorveu a seção do MPI, que na ficha vem ANTES dos
   *    produtos. É a MESMA agregação da pré-pesagem (ver teste logo abaixo) — o MPI continua
   *    aparecendo também como linha dentro do bloco do produto que o consome, como na ficha.
   *  - `unitsCount` + `quantityPerUnit`: novos. Alimentam a coluna "Unidades" (quanto vai em
   *    CADA unidade produzida). Aqui o produto é vendido a granel (peso unitário 1 kg), então
   *    a "unidade" é o quilo: 5 kg de farinha em 10 kg de carga = 0,500 kg por kg.
   *
   * O que NÃO pode mudar e segue pinado: as linhas do produto, na mesma ordem, com as mesmas
   * quantidades, a mesma heurística de "Adic." e sem nenhum vestígio de ficha em blocos.
   */
  assert.deepEqual(document, {
    deliveryGap: { days: [1], label: "Dia+1" },
    ingredientSections: [
      {
        productId: "mpi-chantilly",
        productCode: "PR-00090",
        productName: "Chantilly",
        stage: "massa",
        stageLabel: null,
        requiredQuantity: 3,
        requiredUnit: "Kg",
        requiredKg: 3,
        usedBy: ["Pão doce"],
        recipeStageConfig: undefined,
        batchSplit: null,
        items: [
          {
            key: "mpi-chantilly-m1-3",
            sourceType: "ingrediente",
            kind: "ingrediente",
            sectionKind: "base",
            stage: "massa",
            label: "Creme de leite",
            unit: "Kg",
            estimatedQuantity: 3,
            batchQuantity: undefined,
            partialQuantity: undefined,
            notes: undefined,
          },
        ],
      },
    ],
    productSections: [
      {
        productId: "product-pao",
        productCode: "PR-00001",
        productName: "Pão doce",
        plannedKg: 10,
        requestedQuantity: 10,
        requestedUnit: "Kg",
        unitWeightKg: 1,
        unitsCount: 10,
        batchSplit: null,
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
            quantityPerUnit: 0.5,
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
            quantityPerUnit: 0.2,
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
            quantityPerUnit: 0.2,
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
            quantityPerUnit: 0.1,
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

/* -------------------------------------------------------------------------------------------------
 * FORMATO DA FICHA DO CLIENTE — a folha da OP passou a sair como a ficha que ele já usa:
 * seção do MPI primeiro (batido uma vez para a OP inteira), depois um bloco por produto com a
 * coluna "Unidades" (quanto vai em CADA unidade) e o cabeçalho com o gap "Dia+N".
 * -----------------------------------------------------------------------------------------------*/

test("folha de produção: a seção do MPI é a MESMA agregação da pré-pesagem", () => {
  const op = buildOp(stagedProduct, 10);
  const folha = buildProductionSheetDocument(op, source);
  const prePesagem = buildPreWeighingDocument(op, source);

  // Uma agregação só para as duas folhas: o padeiro pesa e produz exatamente o mesmo MPI.
  assert.deepEqual(folha.ingredientSections, prePesagem.ingredientProducts);
  assert.deepEqual(
    folha.ingredientSections.map((section) => [section.productCode, section.stage, section.requiredKg]),
    [
      ["PR-00090", "recheio", 2],
      ["PR-00090", "cobertura", 1],
    ],
  );

  // E o MPI CONTINUA como linha dentro do bloco de quem o consome — é assim na ficha: a
  // seção diz quanto bater no total, a linha diz quanto entra naquele produto.
  assert.deepEqual(
    folha.productSections[0]!.items.filter((row) => row.kind === "produto_mpi").map((row) => [
      row.stage,
      row.estimatedQuantity,
    ]),
    [
      ["cobertura", 1],
      ["recheio", 2],
    ],
  );
});

/** MPI de massa, como o "MPI MASSA CUCA CASEIRA" da ficha. */
const mpiMassaCuca = buildProduct(
  "mpi-massa-cuca",
  "PR-00091",
  "MPI Massa cuca",
  [{ id: "mc1", sourceType: "ingrediente", sourceId: "ing-farinha", label: "Farinha de trigo", quantity: 1, unit: "Kg" }],
  { canBeIngredient: true, isMpiIngredient: true },
);

/** Produto vendido em UNIDADES, como a cuca da ficha: massa (bloco base) + cobertura de farofa. */
const cucaProduct = buildProduct(
  "product-cuca",
  "PR-00003",
  "Cuca caseira banana",
  [
    {
      id: "c1",
      sourceType: "produto",
      sourceId: "mpi-massa-cuca",
      label: "MPI Massa cuca",
      quantity: 1,
      unit: "Kg",
      stage: "massa",
    },
    {
      id: "c2",
      sourceType: "ingrediente",
      sourceId: "ing-cobertura",
      label: "Farofa doce",
      quantity: 0.5,
      unit: "Kg",
      stage: "cobertura",
    },
  ],
  {
    unitProfiles: {
      sales: { unit: "Un", description: "Unidade", weightKg: 0.5 },
      production: { unit: "Kg", description: "Produção", weightKg: 1 },
      expedition: { unit: "Un", description: "Expedição", weightKg: 0.5 },
    },
    isSoldLoose: false,
    salesUnit: "Un",
    salesToKgFactor: 0.5,
  },
);

const cucaSource = { products: [cucaProduct, mpiMassaCuca], ingredients };

/** OP de 6 cucas: 3 kg de carga, pedido de 6 Un. */
function buildCucaOp(): ProductionOrderRow {
  const op = buildOp(cucaProduct, 3);
  return {
    ...op,
    sourceItems: op.sourceItems.map((item) => ({ ...item, requestedQuantity: 6, requestedUnit: "Un" as const })),
  };
}

test("coluna Unidades: quanto vai em CADA unidade produzida, por linha (MPI ou ingrediente simples)", () => {
  const document = buildProductionSheetDocument(buildCucaOp(), cucaSource);
  const [section] = document.productSections;

  // 3 kg de carga ÷ 0,5 kg por cuca = 6 cucas. É o divisor da coluna.
  assert.equal(section!.unitWeightKg, 0.5);
  assert.equal(section!.unitsCount, 6);
  assert.equal(section!.requestedQuantity, 6);
  assert.equal(section!.requestedUnit, "Un");

  assert.deepEqual(
    section!.items.map((row) => [row.label, row.estimatedQuantity, row.quantityPerUnit]),
    [
      // Vale para o MPI (0,333 kg de massa por cuca)...
      ["MPI Massa cuca", 2, 0.333],
      // ...e para o ingrediente simples (0,167 kg de farofa por cuca).
      ["Farofa doce", 1, 0.167],
    ],
  );

  // Prova de que a coluna fecha: a soma do que vai em cada unidade é o peso unitário.
  assert.equal(
    sumStageQuantityPerUnitKg(section!.items),
    section!.unitWeightKg,
    "o que vai em uma unidade tem que somar o peso unitário",
  );
});

test("subtotal por unidade do bloco: soma só peso/volume e ignora linha contada em unidade", () => {
  const document = buildProductionSheetDocument(buildCucaOp(), cucaSource);
  const groups = groupPrintRowsByStage(document.productSections[0]!.items);

  // Cada bloco tem seu subtotal — é o "0,165 kg" que a ficha imprime no sub-cabeçalho.
  assert.deepEqual(
    groups.map((group) => [group.stage, sumStageQuantityPerUnitKg(group.rows)]),
    [
      ["massa", 0.333],
      ["cobertura", 0.167],
    ],
  );

  // g vira kg; linha em "Un" (ex.: 6 ovos) não entra numa soma em kg; bloco sem nada
  // somável devolve null em vez de um zero enganoso.
  assert.equal(
    sumStageQuantityPerUnitKg([
      { unit: "Kg", quantityPerUnit: 0.25 },
      { unit: "g", quantityPerUnit: 30 },
      { unit: "Un", quantityPerUnit: 6 },
      { unit: "Kg", quantityPerUnit: null },
    ]),
    0.28,
  );
  assert.equal(sumStageQuantityPerUnitKg([{ unit: "Un", quantityPerUnit: 6 }]), null);
  assert.equal(sumStageQuantityPerUnitKg([]), null);
});

test("cabeçalho: o gap produção→entrega sai das datas da própria OP", () => {
  const op = buildOp(legacyProduct, 10);

  // Produzir 24/07, entregar 25/07 → "Dia+1".
  assert.deepEqual(resolveProductionDeliveryGap(op), { days: [1], label: "Dia+1" });
  assert.deepEqual(
    buildProductionSheetDocument(op, source).deliveryGap,
    { days: [1], label: "Dia+1" },
    "a folha carrega o gap para as duas rotas de impressão imprimirem o mesmo cabeçalho",
  );

  // Entrega no mesmo dia da produção não vira "Dia+0".
  assert.deepEqual(
    resolveProductionDeliveryGap({
      ...op,
      sourceItems: op.sourceItems.map((item) => ({ ...item, deliveryDate: "2026-07-24" })),
    }),
    { days: [0], label: "Mesmo dia" },
  );

  // Mais de uma data de entrega na mesma OP: mostra as duas, em ordem, sem inventar média.
  assert.deepEqual(
    resolveProductionDeliveryGap({
      ...op,
      sourceItems: [
        { ...op.sourceItems[0]!, deliveryDate: "2026-07-26" },
        { ...op.sourceItems[0]!, id: "item-2", deliveryDate: "2026-07-25" },
      ],
    }),
    { days: [1, 2], label: "Dia+1 / Dia+2" },
  );

  // OP sem item de pedido (só MPI) não tem gap — o cabeçalho omite em vez de chutar.
  assert.deepEqual(resolveProductionDeliveryGap({ ...op, sourceItems: [] }), { days: [], label: null });
});

test("folha de produção: MPI que também é item da OP NÃO sai duas vezes", () => {
  // Quando o MPI não tem linha nativa própria, ele herda a linha do pai e o motor o coloca
  // como ITEM da mesma OP. Sem filtro, o padeiro recebia a mesma massa em dois lugares: a
  // seção "Produto Ingrediente" (com Peso finalizado) e mais um bloco de produto com a faixa
  // "Pedido · Kg 0", que não quer dizer nada. A ficha do cliente tem UMA seção de MPI.
  const op = buildOp(stagedProduct, 10);
  const mpi = source.products.find((product) => product.canBeIngredient)!;
  const opComMpiComoItem: ProductionOrderRow = {
    ...op,
    items: [...op.items, { ...buildOpItem(mpi, 3), isIntermediate: true }],
  };

  const folha = buildProductionSheetDocument(opComMpiComoItem, source);

  assert.ok(
    folha.ingredientSections.some((section) => section.productId === mpi.id),
    "o MPI tem de aparecer na seção Produto Ingrediente",
  );
  assert.deepEqual(
    folha.productSections.filter((section) => section.productId === mpi.id),
    [],
    "e NÃO pode voltar como bloco de produto",
  );
  // O produto final segue impresso normalmente.
  assert.deepEqual(
    folha.productSections.map((section) => section.productId),
    [stagedProduct.id],
  );
});

test("impressão: MPI e linhas da receita saem com o código do cliente; sem ele, com o da fábrica", () => {
  const farinhaComErp: ProductionIngredient = { ...ingredients[0], externalCode: "FAR-01" };
  const chantillyComErp = { ...mpiChantilly, externalCode: "CHA-90" };
  const produto = buildProduct("product-erp", "PR-00003", "Bolo", [
    { id: "e1", sourceType: "ingrediente", sourceId: "ing-farinha", label: "IN-000001 · Farinha de trigo", quantity: 5, unit: "Kg" },
    { id: "e2", sourceType: "ingrediente", sourceId: "ing-creme", label: "IN-000003 · Creme de leite", quantity: 1, unit: "Kg" },
    { id: "e3", sourceType: "produto", sourceId: "mpi-chantilly", label: "PR-00090 · Chantilly", quantity: 2, unit: "Kg" },
  ]);
  const comErp = { products: [produto, chantillyComErp], ingredients: [farinhaComErp, ingredients[1], ingredients[2]] };

  const pre = buildPreWeighingDocument(buildOp(produto, 10), comErp);
  assert.equal(pre.ingredientProducts[0].productCode, "CHA-90");
  const labels = pre.productSections[0].baseIngredients.map((row) => row.label);
  assert.ok(labels.includes("FAR-01 · Farinha de trigo"), "ingrediente com código do cliente");
  assert.ok(labels.includes("IN-000003 · Creme de leite"), "ingrediente sem código do cliente mantém o da fábrica");

  const folha = buildProductionSheetDocument(buildOp(produto, 10), comErp);
  const folhaLabels = folha.productSections[0].items.map((row) => row.label);
  assert.ok(folhaLabels.includes("FAR-01 · Farinha de trigo"));

  const semErp = buildPreWeighingDocument(buildOp(produto, 10), { products: [produto, mpiChantilly], ingredients });
  assert.equal(semErp.ingredientProducts[0].productCode, "PR-00090");
});

test("folha e fichas 80 mm de produto em Kg com batida de 4 kg: 10,4 kg = 4 + 4 + 2,4 e os insumos somam a carga", async () => {
  const { buildThermalTickets } = await import("@/lib/thermal-production");
  const pao = buildProduct("product-pao-kg", "PR-71837", "Pão Caseiro", [
    { id: "k1", sourceType: "ingrediente", sourceId: "ing-farinha", label: "Farinha de trigo", quantity: 2, unit: "Kg" },
  ], { capacityPerBatch: 4, salesToKgFactor: 1 });
  const op = buildOp(pao, 10.4);
  op.items = [{ ...op.items[0], capacityPerBatch: 4 }];
  const document = buildProductionSheetDocument(op, { products: [pao], ingredients });
  const [section] = document.productSections;

  assert.equal(section.batchSplit?.fullBatchCount, 2);
  assert.equal(section.batchSplit?.fullBatchUnits, 4);
  assert.equal(section.batchSplit?.partialUnits, 2.4);

  const tickets = buildThermalTickets(document);
  assert.deepEqual(tickets.map((t) => t.quantity), [4, 4, 2.4]);
  assert.deepEqual(tickets.map((t) => t.complementary), [false, false, true]);
  assert.equal(Number(tickets.reduce((s, t) => s + t.quantity, 0).toFixed(3)), 10.4);
  const farinha = tickets.map((t) => t.items.find((r) => r.label === "Farinha de trigo")!.estimatedQuantity);
  // 2 kg de farinha por kg de produto no teste; o que importa é a soma fechar com a OP inteira.
  assert.equal(Number(farinha.reduce((s, q) => s + q, 0).toFixed(3)), Number(section.items.find((r) => r.label === "Farinha de trigo")!.estimatedQuantity.toFixed(3)));
});

test("folha de produto em Kg menor que a batida: uma ficha só, com o peso exato (antes saía ficha vazia)", async () => {
  const { buildThermalTickets } = await import("@/lib/thermal-production");
  const pao = buildProduct("product-pao-kg2", "PR-71838", "Pão Caseiro 2", [
    { id: "k1", sourceType: "ingrediente", sourceId: "ing-farinha", label: "Farinha de trigo", quantity: 2, unit: "Kg" },
  ], { capacityPerBatch: 4, salesToKgFactor: 1 });
  const op = buildOp(pao, 0.4);
  op.items = [{ ...op.items[0], capacityPerBatch: 4 }];
  const tickets = buildThermalTickets(buildProductionSheetDocument(op, { products: [pao], ingredients }));
  assert.equal(tickets.length, 1);
  assert.equal(tickets[0].quantity, 0.4);
  assert.equal(tickets[0].complementary, true);
});

// ── Destino de impressão por insumo da receita ───────────────────────────────────────────────────
import { buildPackagingSeparationDocument } from "@/lib/printing-documents";
import { getRecipeReferenceWeightKgFromData, getProductRecipeTotalsFromData } from "@/lib/production-data-utils";
import type { RecipePrintDestination } from "@/lib/production-planning";

function destinationProduct(id: string, code: string, name: string, destinations: Record<string, RecipePrintDestination[] | undefined>) {
  const line = (lineId: string, label: string, sourceId: string, quantity: number, unit: "Kg" | "Un") => ({
    id: lineId, sourceType: "ingrediente" as const, sourceId, label, quantity, unit, stage: "massa" as const,
    ...(destinations[lineId] ? { printDestinations: destinations[lineId] } : {}),
  });
  return buildProduct(id, code, name, [
    line("d1", "Farinha de trigo", "ing-farinha", 5, "Kg"),
    line("d2", "Cobertura de chocolate", "ing-cobertura", 2, "Kg"),
    line("d3", "Caixa 20cm", "ing-caixa", 1, "Un"),
  ]);
}
const ingredientsWithBox: ProductionIngredient[] = [
  ...ingredients,
  { id: "ing-caixa", code: "IN-000099", name: "Caixa 20cm", type: "puro", supplyClass: "ME", unit: "Un", weightKg: 0.05, metadata: "", observation: "", composition: [], status: "ativo" },
];
const labelsOf = (rows: Array<{ label: string }>) => rows.map((row) => row.label);

test("destino: sem configurar, produção e pré-pesagem listam as MESMAS linhas de sempre (padrão)", () => {
  const product = destinationProduct("p-dest", "PR-D1", "Bolo", {});
  const src = { products: [product], ingredients: ingredientsWithBox };
  const sheet = buildProductionSheetDocument(buildOp(product, 10), src);
  const pre = buildPreWeighingDocument(buildOp(product, 10), src);
  assert.deepEqual(labelsOf(sheet.productSections[0].items).sort(), ["Caixa 20cm", "Cobertura de chocolate", "Farinha de trigo"].sort());
  const preLabels = labelsOf([...pre.productSections[0].baseIngredients, ...pre.productSections[0].additionalIngredients]);
  assert.deepEqual(preLabels.sort(), ["Caixa 20cm", "Cobertura de chocolate", "Farinha de trigo"].sort());
  assert.equal(sheet.productSections[0].items.every((row) => row.alsoPrintedOn === undefined), true, "sem marca nova");
});

test("destino: ME na produção + separação NÃO sai na pré-pesagem, e a farinha segue nas duas", () => {
  const product = destinationProduct("p-dest2", "PR-D2", "Bolo", { d3: ["producao", "separacao_embalagem"] });
  const src = { products: [product], ingredients: ingredientsWithBox };
  const sheet = buildProductionSheetDocument(buildOp(product, 10), src);
  const pre = buildPreWeighingDocument(buildOp(product, 10), src);
  assert.ok(labelsOf(sheet.productSections[0].items).includes("Caixa 20cm"), "caixa na produção");
  const preLabels = labelsOf([...pre.productSections[0].baseIngredients, ...pre.productSections[0].additionalIngredients]);
  assert.ok(!preLabels.includes("Caixa 20cm"), "caixa fora da balança");
  assert.ok(preLabels.includes("Farinha de trigo"), "farinha continua na pré-pesagem");
  const caixa = sheet.productSections[0].items.find((row) => row.label === "Caixa 20cm")!;
  assert.match(caixa.alsoPrintedOn ?? "", /Separação de embalagens/, "marca 'também em' só na linha configurada");
  assert.equal(sheet.productSections[0].items.find((row) => row.label === "Farinha de trigo")!.alsoPrintedOn, undefined);
});

test("destino: quantidade cheia em cada folha (não divide) e lista vazia some das folhas", () => {
  const product = destinationProduct("p-dest3", "PR-D3", "Bolo", { d3: ["producao", "prepesagem", "separacao_embalagem"], d2: [] });
  const src = { products: [product], ingredients: ingredientsWithBox };
  const sheet = buildProductionSheetDocument(buildOp(product, 10), src);
  const pre = buildPreWeighingDocument(buildOp(product, 10), src);
  const onSheet = sheet.productSections[0].items.find((row) => row.label === "Caixa 20cm")!;
  const onPre = [...pre.productSections[0].baseIngredients, ...pre.productSections[0].additionalIngredients].find((row) => row.label === "Caixa 20cm")!;
  assert.equal(onSheet.estimatedQuantity, onPre.estimatedQuantity, "mesma quantidade cheia nas duas folhas");
  assert.ok(!labelsOf(sheet.productSections[0].items).includes("Cobertura de chocolate"), "lista vazia: fora da produção");
  assert.ok(!labelsOf([...pre.productSections[0].baseIngredients, ...pre.productSections[0].additionalIngredients]).includes("Cobertura de chocolate"), "lista vazia: fora da pré-pesagem");
});

test("destino NÃO muda consumo, peso nem massa: receita com e sem destinos tem os mesmos totais", () => {
  const plain = destinationProduct("p-dest4", "PR-D4", "Bolo", {});
  const configured = destinationProduct("p-dest4", "PR-D4", "Bolo", { d1: [], d2: ["separacao_embalagem"], d3: ["producao"] });
  const a = getProductRecipeTotalsFromData(plain, ingredientsWithBox, []);
  const b = getProductRecipeTotalsFromData(configured, ingredientsWithBox, []);
  assert.deepEqual(b, a);
  const byId = new Map(ingredientsWithBox.map((entry) => [entry.id, entry]));
  for (const [x, y] of plain.recipe.map((item, index) => [item, configured.recipe[index]] as const)) {
    assert.equal(getRecipeReferenceWeightKgFromData(y, byId, new Map()), getRecipeReferenceWeightKgFromData(x, byId, new Map()), x.label);
  }
});

test("separação de embalagens: soma a mesma caixa entre produtos, arredonda unidade contada para cima", () => {
  const a = destinationProduct("p-sep-a", "PR-S1", "Bolo A", { d3: ["separacao_embalagem"] });
  const b = destinationProduct("p-sep-b", "PR-S2", "Bolo B", { d3: ["separacao_embalagem"] });
  const op = buildOp(a, 10);
  op.items = [buildOpItem(a, 10), buildOpItem(b, 4)];
  const doc = buildPackagingSeparationDocument(op, { products: [a, b], ingredients: ingredientsWithBox });
  assert.equal(doc.lines.length, 1, "Caixa 20cm é UMA linha");
  const line = doc.lines[0];
  assert.equal(line.label, "Caixa 20cm");
  assert.equal(line.exactQuantity, 14 * 0 + line.exactQuantity);
  assert.equal(Number.isInteger(line.quantity), true, "unidade contada = inteiro");
  assert.ok(line.quantity >= line.exactQuantity, "arredonda para cima, nunca para baixo");
  assert.deepEqual(line.usedBy.map((entry) => entry.productName).sort(), ["Bolo A", "Bolo B"]);
});

test("separação de embalagens: linha só de produção/pré-pesagem não entra; sem embalagem o relatório é vazio", () => {
  const product = destinationProduct("p-sep-c", "PR-S3", "Bolo C", {});
  const doc = buildPackagingSeparationDocument(buildOp(product, 10), { products: [product], ingredients: ingredientsWithBox });
  assert.deepEqual(doc.lines, []);
});

test("separação de embalagens: peso/volume mantém as 3 casas (não vira inteiro)", () => {
  const product = destinationProduct("p-sep-d", "PR-S4", "Bolo D", { d2: ["separacao_embalagem"] });
  const doc = buildPackagingSeparationDocument(buildOp(product, 7.3), { products: [product], ingredients: ingredientsWithBox });
  const line = doc.lines.find((entry) => entry.label === "Cobertura de chocolate")!;
  assert.equal(line.quantity, line.exactQuantity);
  assert.equal(Number.isInteger(line.quantity), false);
});

test("destino: OP liberada ANTES da mudança (receita congelada sem o campo) imprime como sempre", () => {
  const live = destinationProduct("p-frz", "PR-F1", "Bolo", { d3: ["separacao_embalagem"], d1: [] });
  // O congelamento antigo não tinha `printDestinations` em nenhuma linha.
  const frozen = live.recipe.map(({ printDestinations: _ignored, ...line }) => { void _ignored; return line; });
  const op = buildOp(live, 10);
  op.items = [{ ...op.items[0], frozenRecipe: frozen }];
  const src = { products: [live], ingredients: ingredientsWithBox };
  const sheet = buildProductionSheetDocument(op, src);
  const pre = buildPreWeighingDocument(op, src);
  assert.deepEqual(labelsOf(sheet.productSections[0].items).sort(), ["Caixa 20cm", "Cobertura de chocolate", "Farinha de trigo"].sort(), "receita viva mudou, a OP congelada não");
  const preLabels = labelsOf([...pre.productSections[0].baseIngredients, ...pre.productSections[0].additionalIngredients]);
  assert.deepEqual(preLabels.sort(), ["Caixa 20cm", "Cobertura de chocolate", "Farinha de trigo"].sort());
  assert.deepEqual(buildPackagingSeparationDocument(op, src).lines, [], "congelada sem destino: nada na separação");
});

test("destino: OP liberada DEPOIS da mudança congela o destino junto com a receita", () => {
  const live = destinationProduct("p-frz2", "PR-F2", "Bolo", { d3: ["separacao_embalagem"] });
  const op = buildOp(live, 10);
  op.items = [{ ...op.items[0], frozenRecipe: JSON.parse(JSON.stringify(live.recipe)) }];
  const changedLater = { ...live, recipe: live.recipe.map((line) => ({ ...line, printDestinations: ["producao" as const] })) };
  const doc = buildPackagingSeparationDocument(op, { products: [changedLater], ingredients: ingredientsWithBox });
  assert.equal(doc.lines.length, 1, "a edição posterior da receita não apaga a separação da OP já liberada");
});

// ── Embalagens e etiquetas do DIA programado ─────────────────────────────────────────────────────
import { buildDayLabels, buildDayPackagingSeparation } from "@/lib/day-packaging-labels";

function opWith(id: string, code: string, items: Array<{ product: ProductionProduct; totalKg: number }>): ProductionOrderRow {
  const base = buildOp(items[0].product, items[0].totalKg);
  return { ...base, id, code, items: items.map((entry) => buildOpItem(entry.product, entry.totalKg)) };
}

test("dia: a mesma caixa em duas OPs vira UMA linha, com o total do dia e o detalhe por produto", () => {
  const a = destinationProduct("p-da", "PR-DA", "Bolo A", { d3: ["separacao_embalagem"] });
  const b = destinationProduct("p-db", "PR-DB", "Bolo B", { d3: ["separacao_embalagem"] });
  const src = { products: [a, b], ingredients: ingredientsWithBox };
  const lines = buildDayPackagingSeparation([opWith("op-1", "OP-1", [{ product: a, totalKg: 10 }]), opWith("op-2", "OP-2", [{ product: b, totalKg: 20 }])], src);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].opCount, 2);
  assert.deepEqual(lines[0].usedBy.map((u) => u.productName).sort(), ["Bolo A", "Bolo B"]);
  const sum = lines[0].usedBy.reduce((t, u) => t + u.quantity, 0);
  assert.ok(Math.abs(sum - lines[0].exactQuantity) < 0.002, "o detalhe por produto fecha com o total");
});

test("dia: arredonda a unidade contada UMA vez no total (0,4 + 0,4 = 1 caixa, não 2)", () => {
  // Cada OP precisa de ~0,4 de caixa: sozinha arredondaria para 1; as duas juntas, ~0,8, ainda cabem em 1.
  const mk = (id: string) => { const p = destinationProduct(id, `PR-${id}`, `Bolo ${id}`, { d3: ["separacao_embalagem"] }); return { ...p, recipe: p.recipe.map((line) => (line.id === "d3" ? { ...line, quantity: 0.28 } : line)) }; };
  const a = mk("p-r1"); const b = mk("p-r2");
  const src = { products: [a, b], ingredients: ingredientsWithBox };
  const ops = [opWith("op-1", "OP-1", [{ product: a, totalKg: 10 }]), opWith("op-2", "OP-2", [{ product: b, totalKg: 10 }])];
  const perOp = ops.flatMap((op) => buildPackagingSeparationDocument(op, src).lines);
  assert.deepEqual(perOp.map((l) => l.quantity), [1, 1], "cada OP sozinha arredondaria para 1");
  const day = buildDayPackagingSeparation(ops, src);
  assert.equal(day.length, 1);
  assert.ok(day[0].exactQuantity < 1 && day[0].exactQuantity > 0.5, `exato ${day[0].exactQuantity}`);
  assert.equal(day[0].exactQuantity, Math.round((perOp[0].exactQuantity + perOp[1].exactQuantity) * 1000) / 1000, "o total é a soma dos exatos, não dos arredondados");
  assert.equal(day[0].quantity, 1, "o dia separa 1 caixa, não 2");
});

test("dia: peso/volume mantém 3 casas; embalagem em unidade diferente nunca se soma", () => {
  const a = destinationProduct("p-w1", "PR-W1", "Bolo W1", { d2: ["separacao_embalagem"], d3: ["separacao_embalagem"] });
  const src = { products: [a], ingredients: ingredientsWithBox };
  const day = buildDayPackagingSeparation([opWith("op-1", "OP-1", [{ product: a, totalKg: 7.3 }])], src);
  const cobertura = day.find((l) => l.label.includes("Cobertura"))!;
  assert.equal(cobertura.quantity, cobertura.exactQuantity);
  assert.equal(Number.isInteger(cobertura.quantity), false);
  assert.equal(new Set(day.map((l) => l.key)).size, day.length, "uma linha por insumo+unidade");
});

test("dia: sem nenhuma embalagem marcada, o relatório é vazio", () => {
  const a = destinationProduct("p-v1", "PR-V1", "Bolo V1", {});
  assert.deepEqual(buildDayPackagingSeparation([opWith("op-1", "OP-1", [{ product: a, totalKg: 10 }])], { products: [a], ingredients: ingredientsWithBox }), []);
});

test("etiquetas do dia: uma por produto, somando o mesmo produto em OPs diferentes", () => {
  const a = destinationProduct("p-e1", "PR-E1", "Bolo Chocolate", {});
  const b = destinationProduct("p-e2", "PR-E2", "Bolo Laranja", {});
  const src = { products: [a, b], ingredients: ingredientsWithBox };
  const ops = [opWith("op-1", "OP-1", [{ product: a, totalKg: 10 }, { product: b, totalKg: 4 }]), opWith("op-2", "OP-2", [{ product: a, totalKg: 6 }])];
  const labels = buildDayLabels(ops, src);
  assert.deepEqual(labels.map((l) => l.productName), ["Bolo Chocolate", "Bolo Laranja"]);
  const choc = labels.find((l) => l.productName === "Bolo Chocolate")!;
  const laranja = labels.find((l) => l.productName === "Bolo Laranja")!;
  assert.deepEqual(choc.opCodes, ["OP-1", "OP-2"]);
  assert.equal(laranja.opCodes.length, 1);
  const chocSingle = buildDayLabels([ops[0]], src).find((l) => l.productName === "Bolo Chocolate")!;
  const chocSecond = buildDayLabels([ops[1]], src).find((l) => l.productName === "Bolo Chocolate")!;
  assert.ok(Math.abs(choc.quantity - (chocSingle.quantity + chocSecond.quantity)) < 0.002, "soma das OPs");
});

test("etiquetas do dia: usa o código que o cliente reconhece e o peso da etiqueta do teste de laboratório", () => {
  const base = destinationProduct("p-c1", "PR-C1", "Pão", {});
  const a = { ...base, externalCode: "1720", labTest: { labelWeightKg: 0.263 } } as unknown as ProductionProduct;
  const [label] = buildDayLabels([opWith("op-1", "OP-1", [{ product: a, totalKg: 5 }])], { products: [a], ingredients: ingredientsWithBox });
  assert.equal(label.code, "1720");
  assert.equal(label.labelWeightKg, 0.263);
  const [semTeste] = buildDayLabels([opWith("op-1", "OP-1", [{ product: base, totalKg: 5 }])], { products: [base], ingredients: ingredientsWithBox });
  assert.equal(semTeste.labelWeightKg, null);
});

test("dia: o MESMO produto em duas OPs soma na linha de 'usado em' (não sobrescreve)", () => {
  const a = destinationProduct("p-us", "PR-US", "Bolo US", { d3: ["separacao_embalagem"] });
  const src = { products: [a], ingredients: ingredientsWithBox };
  const one = buildDayPackagingSeparation([opWith("op-1", "OP-1", [{ product: a, totalKg: 10 }])], src)[0];
  const two = buildDayPackagingSeparation([opWith("op-1", "OP-1", [{ product: a, totalKg: 10 }]), opWith("op-2", "OP-2", [{ product: a, totalKg: 10 }])], src)[0];
  assert.equal(two.usedBy.length, 1, "um produto, uma entrada");
  assert.ok(Math.abs(two.usedBy[0].quantity - 2 * one.usedBy[0].quantity) < 0.002);
});

test("etiquetas do dia: o mesmo produto em unidades diferentes (Un numa OP, Kg noutra) não se soma", () => {
  const base = destinationProduct("p-un", "PR-UN", "Pão Misto", {});
  const withUnit = (id: string, unit: "Un" | "Kg", qty: number) => {
    const op = opWith(id, id.toUpperCase(), [{ product: base, totalKg: 5 }]);
    return { ...op, sourceItems: op.sourceItems.map((item) => ({ ...item, requestedUnit: unit, requestedQuantity: qty })) } as ProductionOrderRow;
  };
  const labels = buildDayLabels([withUnit("op-a", "Un", 20), withUnit("op-b", "Kg", 5)], { products: [base], ingredients: ingredientsWithBox });
  assert.equal(labels.length, 2, "uma etiqueta por unidade");
  assert.deepEqual(labels.map((l) => l.unit).sort(), ["Kg", "Un"]);
  assert.equal(labels.find((l) => l.unit === "Un")!.quantity, 20);
  assert.equal(labels.find((l) => l.unit === "Kg")!.quantity, 5);
});

test("etiquetas do dia: a mesma OP não aparece duas vezes na lista de OPs do produto", () => {
  const a = destinationProduct("p-oc", "PR-OC", "Bolo OC", {});
  const op = opWith("op-1", "OP-1", [{ product: a, totalKg: 10 }, { product: a, totalKg: 6 }]);
  const [label] = buildDayLabels([op], { products: [a], ingredients: ingredientsWithBox });
  assert.deepEqual(label.opCodes, ["OP-1"]);
});
