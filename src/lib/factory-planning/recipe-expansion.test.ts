import assert from "node:assert/strict";
import test from "node:test";

import type {
  ProductionIngredient,
  ProductionLine,
  ProductionProduct,
  ProductionSector,
} from "@/lib/production-planning";

import type { PlannedOrderItem } from "./types";
import { expandRecipeIntoItems, round3, scaleRecipeQuantity } from "./recipe-expansion";

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
    capacityPerBatch: null,
    economicBatchUnit: null,
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

// ---------------------------------------------------------------------------
// expandRecipeIntoItems — testes da Decisão 1/2/3 do ADR_expansao_mpi_em_op.md
// ---------------------------------------------------------------------------

function makeMpiProduct(overrides: Partial<ProductionProduct> = {}): ProductionProduct {
  return {
    id: "mpi-massa",
    code: "MPI-001",
    name: "Massa de Pizza",
    description: "",
    lineId: "line-massa",
    active: true,
    availableForOrdering: false,
    validityDays: 1,
    minimumProductionKg: 0,
    economicProductionKg: 0,
    allowsStorage: false,
    productionDays: [],
    expeditionLeadDays: 0,
    unitProfiles: {
      sales: { unit: "Kg", description: "kg", weightKg: 1 },
      production: { unit: "Kg", description: "kg", weightKg: 1 },
      expedition: { unit: "Kg", description: "kg", weightKg: 1 },
    },
    isSoldLoose: false,
    recipe: [],
    preparationStages: [],
    preparationMode: "",
    breakPercent: 0,
    breakStage: "antes_divisao",
    breakComment: "",
    canBeIngredient: true,
    weight: "",
    productionUnit: "Kg",
    salesUnit: "Kg",
    salesToKgFactor: 1,
    expeditionUnit: "Kg",
    expeditionToKgFactor: 1,
    isMpiIngredient: true,
    capacityPerBatch: null,
    economicBatchUnit: null,
    ...overrides,
  } as ProductionProduct;
}

function makePlannedItem(overrides: Partial<PlannedOrderItem> = {}): PlannedOrderItem {
  return {
    id: "item-1",
    orderId: "order-1",
    orderCode: "PED-001",
    storeId: "store-1",
    storeName: "Loja Centro",
    orderedAt: "2026-05-20",
    baseDate: "2026-05-20",
    deliveryDate: "2026-05-21",
    saleDate: "2026-05-21",
    productionDate: "2026-05-20",
    delayed: false,
    demandSource: "pedido",
    productId: "pizza",
    productCode: "PZ-001",
    productName: "Pizza Margherita",
    lineId: "line-1",
    lineName: "Linha Forno",
    sectorId: "sector-1",
    sectorName: "Salgados",
    scheduleId: "schedule-1",
    scheduleCode: "S-01",
    scheduleName: "Cronograma 1",
    requestedQuantity: 8, // 8 pizzas → 8 * 0.25 = 2kg
    requestedUnit: "Un",
    internalKg: 2,
    minimumProductionKg: 0,
    expeditionUnit: "Kg",
    expeditionQuantityRaw: 2,
    expeditionQuantity: 2,
    canPlan: true,
    scheduleDayPriority: 1,
    availableForRelease: true,
    releasedToProduction: false,
    productionStarted: false,
    capacityPerBatch: null,
    salesToKgFactor: 1,
    salesUnit: "Kg",
    batchesDone: 0,
    productionItemKey: "2026-05-20|line-1|schedule-1|pizza",
    productionItemStatus: "nao_iniciado",
    preparationStages: [],
    workflowProgress: 0,
    opCode: null,
    status: "em_producao",
    ...overrides,
  };
}

void test("expandRecipeIntoItems gera 1 item extra para pizza com receita de massa (Decisão 1)", () => {
  // Pizza consome 0.4kg de massa por kg de pizza (receita total 1.0kg, sendo 0.4 de MPI).
  const farinha = makeIngredient("farinha", "Farinha");
  const molho = makeIngredient("molho", "Molho");
  const massaMpi = makeMpiProduct({ id: "mpi-massa" });
  const pizza = {
    ...makePizzaProduct(),
    recipe: [
      { id: "r1", sourceType: "ingrediente", sourceId: "farinha", label: "Farinha", quantity: 0.6, unit: "Kg" },
      { id: "r2", sourceType: "produto", sourceId: "mpi-massa", label: "Massa", quantity: 0.4, unit: "Kg" },
    ],
  } as ProductionProduct;
  const productsById = new Map([
    [pizza.id, pizza],
    [massaMpi.id, massaMpi],
  ]);

  const result = expandRecipeIntoItems([makePlannedItem()], productsById, [farinha, molho], [pizza, massaMpi]);

  assert.equal(result.length, 2, "deve manter o item original + 1 MPI");
  const [original, mpi] = result;
  assert.equal(original.productId, "pizza");
  assert.equal(mpi.productId, "mpi-massa");
  // Pizza produz 2kg internamente, receita total 1.0kg, massa = 0.4kg/1.0kg → 0.8kg para 2kg de pizza.
  assert.equal(mpi.internalKg, 0.8);
  assert.equal(mpi.requestedQuantity, 0.8);
  // Decisão 3: herda planning key — mesma data/linha/setor/schedule do pai.
  assert.equal(mpi.productionDate, "2026-05-20");
  assert.equal(mpi.lineId, "line-1");
  assert.equal(mpi.scheduleId, "schedule-1");
  // productionItemKey segue formato padrão; productId distinto basta para diferenciar.
  assert.equal(mpi.productionItemKey, "2026-05-20|line-1|schedule-1|mpi-massa");
});

void test("1 Un de MPI na receita expande em kg do peso cadastrado, não 1 kg", () => {
  const paoDeLo = makeMpiProduct({
    id: "mpi-pao-de-lo",
    name: "Pão de ló",
    salesUnit: "Un",
    unitProfiles: {
      sales: { unit: "Un", description: "Unidade", weightKg: 0.17 },
      production: { unit: "Kg", description: "kg", weightKg: 1 },
      expedition: { unit: "Un", description: "Unidade", weightKg: 0.17 },
    },
    ingredientProfile: {
      unit: "Kg",
      weightKg: 1,
      purchaseUnit: "Kg",
      purchaseToConsumptionFactor: 1,
      metadata: "",
      observation: "",
    },
  });
  const bolo = {
    ...makePizzaProduct(),
    id: "bolo-chama",
    recipe: [
      {
        id: "r1",
        sourceType: "produto",
        sourceId: "mpi-pao-de-lo",
        label: "Pão de ló",
        quantity: 1,
        unit: "Un",
      },
      {
        id: "r2",
        sourceType: "ingrediente",
        sourceId: "farinha",
        label: "Recheio",
        quantity: 0.221,
        unit: "Kg",
      },
    ],
  } as ProductionProduct;
  const productsById = new Map([
    [bolo.id, bolo],
    [paoDeLo.id, paoDeLo],
  ]);

  const result = expandRecipeIntoItems(
    [makePlannedItem({ productId: "bolo-chama", internalKg: 0.391 })],
    productsById,
    [makeIngredient("farinha", "Farinha")],
    [bolo, paoDeLo],
  );

  const mpi = result.find((item) => item.productId === "mpi-pao-de-lo");
  assert.ok(mpi, "deve expandir a OP do pão de ló");
  assert.equal(mpi?.internalKg, 0.17);
});

void test("AJ-0008.1: ingrediente misturado puro vira OP herdando a rota do pai", () => {
  const farinha = makeIngredient("farinha", "Farinha");
  const molho: ProductionIngredient = {
    ...makeIngredient("molho", "Molho Especial"),
    type: "misturado",
  };
  const pizza = makePizzaProduct(); // recipe: 0.6 farinha + 0.4 molho (total 1.0kg)
  const productsById = new Map([[pizza.id, pizza]]);

  const result = expandRecipeIntoItems([makePlannedItem()], productsById, [farinha, molho], [pizza], {
    expandMixedIngredients: true,
  });

  assert.equal(result.length, 2, "item original + 1 OP do misturado");
  const mixed = result.find((item) => item.productId === "molho");
  assert.ok(mixed, "deve gerar item para o ingrediente misturado");
  // 0.4kg molho / 1.0kg receita × 2kg pizza = 0.8kg
  assert.equal(mixed!.internalKg, 0.8);
  assert.equal(mixed!.requestedQuantity, 0.8);
  // Ingredientes não têm linha própria → herdam a rota do pai (estilo Fase 1).
  assert.equal(mixed!.productionDate, "2026-05-20");
  assert.equal(mixed!.lineId, "line-1");
  assert.equal(mixed!.scheduleId, "schedule-1");
  assert.equal(mixed!.productCode, "MOLHO");
  assert.equal(mixed!.productName, "Molho Especial");
  assert.equal(mixed!.productionItemKey, "2026-05-20|line-1|schedule-1|molho");
});

void test("AJ-0008.1: ingrediente puro (não misturado) NÃO vira OP", () => {
  const farinha = makeIngredient("farinha", "Farinha"); // puro
  const molho = makeIngredient("molho", "Molho"); // puro
  const pizza = makePizzaProduct();
  const productsById = new Map([[pizza.id, pizza]]);

  const result = expandRecipeIntoItems([makePlannedItem()], productsById, [farinha, molho], [pizza], {
    expandMixedIngredients: true,
  });

  assert.equal(result.length, 1, "nenhum ingrediente puro deve virar OP");
  assert.ok(!result.some((item) => item.productId === "farinha" || item.productId === "molho"));
});

void test("AJ-0008.1: sem a flag, misturado não vira OP (comportamento legado preservado)", () => {
  const farinha = makeIngredient("farinha", "Farinha");
  const molho: ProductionIngredient = {
    ...makeIngredient("molho", "Molho Especial"),
    type: "misturado",
  };
  const pizza = makePizzaProduct();
  const productsById = new Map([[pizza.id, pizza]]);

  const result = expandRecipeIntoItems([makePlannedItem()], productsById, [farinha, molho], [pizza]);

  assert.equal(result.length, 1, "sem expandMixedIngredients, mantém só o item original");
});

void test("expandRecipeIntoItems com 5 pedidos da mesma pizza gera 5 itens de MPI com mesma planning key (Decisão 3)", () => {
  // Decisão 3: agrupamento de demanda acontece DEPOIS, em
  // `buildProductionOrdersFromPlannedItems` (que agrupa por (planningKey, productId)).
  // O contrato desta função é apenas garantir que os MPIs **compartilham** planning key
  // do pai — o agrupamento vem de graça lá na frente.
  const farinha = makeIngredient("farinha", "Farinha");
  const massaMpi = makeMpiProduct();
  const pizza = {
    ...makePizzaProduct(),
    recipe: [
      { id: "r1", sourceType: "ingrediente", sourceId: "farinha", label: "Farinha", quantity: 0.6, unit: "Kg" },
      { id: "r2", sourceType: "produto", sourceId: "mpi-massa", label: "Massa", quantity: 0.4, unit: "Kg" },
    ],
  } as ProductionProduct;
  const productsById = new Map([
    [pizza.id, pizza],
    [massaMpi.id, massaMpi],
  ]);
  const cincoPedidos = Array.from({ length: 5 }, (_, i) => makePlannedItem({ id: `item-${i + 1}`, orderId: `order-${i + 1}` }));

  const result = expandRecipeIntoItems(cincoPedidos, productsById, [farinha], [pizza, massaMpi]);

  assert.equal(result.length, 10, "5 originais + 5 MPI");
  const mpis = result.filter((item) => item.productId === "mpi-massa");
  assert.equal(mpis.length, 5);
  const planningKeys = new Set(mpis.map((m) => m.productionItemKey));
  assert.equal(planningKeys.size, 1, "todos os MPIs compartilham a mesma planning key (= agrupam adiante)");
});

void test("expandRecipeIntoItems não expande produto sem canBeIngredient (Decisão 1)", () => {
  // Mesmo que a recipe aponte para um sourceType="produto", se o produto-alvo não tem
  // canBeIngredient=true, não é uma MPI — não vira OP. Evita expandir produtos finais
  // que aparecem na receita por engano de cadastro.
  const farinha = makeIngredient("farinha", "Farinha");
  const naoMpi = makeMpiProduct({ id: "produto-final", canBeIngredient: false, isMpiIngredient: false });
  const pizza = {
    ...makePizzaProduct(),
    recipe: [
      { id: "r1", sourceType: "produto", sourceId: "produto-final", label: "Algo", quantity: 0.5, unit: "Kg" },
    ],
  } as ProductionProduct;
  const productsById = new Map([
    [pizza.id, pizza],
    [naoMpi.id, naoMpi],
  ]);

  const result = expandRecipeIntoItems([makePlannedItem()], productsById, [farinha], [pizza, naoMpi]);

  assert.equal(result.length, 1, "não expande quando canBeIngredient=false");
  assert.equal(result[0].productId, "pizza");
});

void test("expandRecipeIntoItems detecta ciclo A→B→A e aborta sem loop infinito", () => {
  // Banco não previne ciclos (sem CHECK constraint). Motor é a última linha.
  // Se A consome B (canBeIngredient) e B consome A (canBeIngredient), a recursão
  // deve abortar no segundo encontro de A, sem stack overflow nem duplicação.
  const farinha = makeIngredient("farinha", "Farinha");
  const productA = makeMpiProduct({
    id: "mpi-a",
    code: "A",
    canBeIngredient: true,
    recipe: [
      { id: "rA", sourceType: "produto", sourceId: "mpi-b", label: "B", quantity: 0.5, unit: "Kg" },
    ],
  } as Partial<ProductionProduct>);
  const productB = makeMpiProduct({
    id: "mpi-b",
    code: "B",
    canBeIngredient: true,
    recipe: [
      { id: "rB", sourceType: "produto", sourceId: "mpi-a", label: "A", quantity: 0.5, unit: "Kg" },
    ],
  } as Partial<ProductionProduct>);
  const productsById = new Map([
    [productA.id, productA],
    [productB.id, productB],
  ]);
  const warns: string[] = [];

  const result = expandRecipeIntoItems(
    [makePlannedItem({ productId: "mpi-a" })],
    productsById,
    [farinha],
    [productA, productB],
    { onWarn: (msg) => warns.push(msg) },
  );

  // Item original + B (expandido a partir de A). B tenta expandir A mas visited bloqueia.
  assert.equal(result.length, 2);
  assert.equal(result[0].productId, "mpi-a");
  assert.equal(result[1].productId, "mpi-b");
  assert.ok(
    warns.some((m) => m.includes("ciclo detectado")),
    "deve emitir warning de ciclo detectado",
  );
});

// ---------------------------------------------------------------------------
// AJ-A4 — fase 2: MPI roda na linha/setor nativos quando configurados
// ---------------------------------------------------------------------------

function makeLine(id: string, name: string, sectorId: string): ProductionLine {
  return {
    id,
    name,
    description: "",
    sectorId,
    capacityPerDayKg: 100,
    active: true,
  } as unknown as ProductionLine;
}

function makeSector(id: string, name: string): ProductionSector {
  return {
    id,
    name,
    description: "",
    active: true,
  } as unknown as ProductionSector;
}

void test("AJ-A4: MPI com operationalLineId próprio roda na linha nativa, não na do pai", () => {
  const farinha = makeIngredient("farinha", "Farinha");
  const massa = makeMpiProduct({
    id: "mpi-massa",
    canBeIngredient: true,
    operationalLineId: "line-massa",
  } as Partial<ProductionProduct>);
  const pizza = {
    ...makePizzaProduct(),
    recipe: [
      { id: "r2", sourceType: "produto", sourceId: "mpi-massa", label: "Massa", quantity: 0.4, unit: "Kg" },
    ],
  } as ProductionProduct;
  const productsById = new Map([
    [pizza.id, pizza],
    [massa.id, massa],
  ]);
  const linesById = new Map([
    ["line-1", makeLine("line-1", "Linha Forno", "sector-forno")],
    ["line-massa", makeLine("line-massa", "Linha Massa", "sector-padaria")],
  ]);
  const sectorsById = new Map([
    ["sector-forno", makeSector("sector-forno", "Forno")],
    ["sector-padaria", makeSector("sector-padaria", "Padaria")],
  ]);

  const result = expandRecipeIntoItems(
    [makePlannedItem()],
    productsById,
    [farinha],
    [pizza, massa],
    { linesById, sectorsById },
  );

  assert.equal(result.length, 2);
  const mpi = result.find((r) => r.productId === "mpi-massa");
  assert.ok(mpi, "deve gerar item de MPI");
  assert.equal(mpi!.lineId, "line-massa", "MPI roda na linha nativa");
  assert.equal(mpi!.lineName, "Linha Massa");
  assert.equal(mpi!.sectorId, "sector-padaria");
  assert.equal(mpi!.sectorName, "Padaria");
  // Schedule do pai não se aplica à linha de massa — campos limpos.
  assert.equal(mpi!.scheduleId, null);
  assert.equal(mpi!.scheduleCode, null);
  assert.equal(mpi!.scheduleName, null);
  assert.equal(mpi!.scheduleDayPriority, null);
  // Planning key reflete a linha nativa, viabilizando agrupamento por linha de massa.
  assert.equal(mpi!.productionItemKey, "2026-05-20|line-massa|sem-linha|mpi-massa");
});

void test("AJ-A4: MPI sem operationalLineId/lineId herda linha do pai (fallback fase 1)", () => {
  const farinha = makeIngredient("farinha", "Farinha");
  const massa = makeMpiProduct({
    id: "mpi-massa",
    canBeIngredient: true,
  });
  // Limpar operationalLineId E lineId no MPI (cadastro incompleto).
  delete (massa as unknown as Record<string, unknown>).operationalLineId;
  delete (massa as unknown as Record<string, unknown>).lineId;
  const pizza = {
    ...makePizzaProduct(),
    recipe: [
      { id: "r2", sourceType: "produto", sourceId: "mpi-massa", label: "Massa", quantity: 0.4, unit: "Kg" },
    ],
  } as ProductionProduct;
  const productsById = new Map([
    [pizza.id, pizza],
    [massa.id, massa],
  ]);

  const result = expandRecipeIntoItems(
    [makePlannedItem()],
    productsById,
    [farinha],
    [pizza, massa],
    { linesById: new Map(), sectorsById: new Map() },
  );

  const mpi = result.find((r) => r.productId === "mpi-massa");
  assert.ok(mpi);
  assert.equal(mpi!.lineId, "line-1", "sem operationalLineId/lineId, herda do pai");
  assert.equal(mpi!.scheduleId, "schedule-1", "schedule do pai preservado quando linha não muda");
});

void test("AJ-A4: maps não fornecidos = comportamento fase 1 (herda tudo do pai)", () => {
  const farinha = makeIngredient("farinha", "Farinha");
  const massa = makeMpiProduct({
    id: "mpi-massa",
    canBeIngredient: true,
    operationalLineId: "line-massa",
  } as Partial<ProductionProduct>);
  const pizza = {
    ...makePizzaProduct(),
    recipe: [
      { id: "r2", sourceType: "produto", sourceId: "mpi-massa", label: "Massa", quantity: 0.4, unit: "Kg" },
    ],
  } as ProductionProduct;
  const productsById = new Map([
    [pizza.id, pizza],
    [massa.id, massa],
  ]);

  // Sem options.linesById/sectorsById — backwards-compat com fase 1.
  const result = expandRecipeIntoItems([makePlannedItem()], productsById, [farinha], [pizza, massa]);

  const mpi = result.find((r) => r.productId === "mpi-massa");
  assert.ok(mpi);
  assert.equal(mpi!.lineId, "line-1", "sem maps, mantém fase 1 (linha do pai)");
  assert.equal(mpi!.scheduleId, "schedule-1");
});

void test("expandRecipeIntoItems faz recursão de 2 níveis (A → MPI-B → MPI-C)", () => {
  // Receita encadeada: pizza usa massa, massa usa fermento.
  const farinha = makeIngredient("farinha", "Farinha");
  const fermento = makeMpiProduct({ id: "mpi-fermento", code: "FERM", canBeIngredient: true });
  const massa = makeMpiProduct({
    id: "mpi-massa",
    canBeIngredient: true,
    recipe: [
      { id: "rM1", sourceType: "ingrediente", sourceId: "farinha", label: "Farinha", quantity: 0.8, unit: "Kg" },
      { id: "rM2", sourceType: "produto", sourceId: "mpi-fermento", label: "Fermento", quantity: 0.2, unit: "Kg" },
    ],
  } as Partial<ProductionProduct>);
  const pizza = {
    ...makePizzaProduct(),
    recipe: [
      { id: "r1", sourceType: "ingrediente", sourceId: "farinha", label: "Farinha", quantity: 0.6, unit: "Kg" },
      { id: "r2", sourceType: "produto", sourceId: "mpi-massa", label: "Massa", quantity: 0.4, unit: "Kg" },
    ],
  } as ProductionProduct;
  const productsById = new Map([
    [pizza.id, pizza],
    [massa.id, massa],
    [fermento.id, fermento],
  ]);

  const result = expandRecipeIntoItems([makePlannedItem()], productsById, [farinha], [pizza, massa, fermento]);

  assert.equal(result.length, 3, "pizza + massa + fermento");
  const ids = result.map((r) => r.productId);
  assert.deepEqual(ids.sort(), ["mpi-fermento", "mpi-massa", "pizza"].sort());
});

// ---------------------------------------------------------------------------
// XPAN #6 (parte 2): pedido JÁ LIBERADO usa a receita CONGELADA no release
// (releasedRecipeByOrderProduct), não a receita editada ao vivo.
// ---------------------------------------------------------------------------

void test("expandRecipeIntoItems — pedido LIBERADO expande a receita CONGELADA (snapshot), não a ao vivo", () => {
  const farinha = makeIngredient("farinha", "Farinha");
  const massaNova = makeMpiProduct({ id: "mpi-massa-nova", name: "Massa Nova" });
  const massaAntiga = makeMpiProduct({ id: "mpi-massa-antiga", name: "Massa Antiga" });
  // Receita AO VIVO (editada depois da liberação): usa a massa NOVA.
  const pizza = {
    ...makePizzaProduct(),
    recipe: [
      { id: "r1", sourceType: "ingrediente", sourceId: "farinha", label: "Farinha", quantity: 0.6, unit: "Kg" },
      { id: "r2", sourceType: "produto", sourceId: "mpi-massa-nova", label: "Massa Nova", quantity: 0.4, unit: "Kg" },
    ],
  } as ProductionProduct;
  const productsById = new Map([
    [pizza.id, pizza],
    [massaNova.id, massaNova],
    [massaAntiga.id, massaAntiga],
  ]);

  // Snapshot congelado NA LIBERAÇÃO: a pizza usava a massa ANTIGA.
  const releasedRecipeByOrderProduct = new Map([
    [
      "order-1",
      new Map([
        [
          "pizza",
          [
            { id: "r1", sourceType: "ingrediente", sourceId: "farinha", label: "Farinha", quantity: 0.6, unit: "Kg" },
            { id: "r2", sourceType: "produto", sourceId: "mpi-massa-antiga", label: "Massa Antiga", quantity: 0.4, unit: "Kg" },
          ] as ProductionProduct["recipe"],
        ],
      ]),
    ],
  ]);

  const liberado = expandRecipeIntoItems(
    [makePlannedItem({ orderId: "order-1", releasedToProduction: true })],
    productsById,
    [farinha],
    [pizza, massaNova, massaAntiga],
    { releasedRecipeByOrderProduct },
  );
  assert.deepEqual(
    liberado.filter((i) => i.productId !== "pizza").map((i) => i.productId),
    ["mpi-massa-antiga"],
    "OP liberada expande a massa ANTIGA (receita congelada), não a nova",
  );

  // Contraprova: pedido SEM snapshot (não liberado) usa a receita ao vivo (massa nova).
  const aoVivo = expandRecipeIntoItems(
    [makePlannedItem({ orderId: "order-2" })],
    productsById,
    [farinha],
    [pizza, massaNova, massaAntiga],
    { releasedRecipeByOrderProduct },
  );
  assert.deepEqual(
    aoVivo.filter((i) => i.productId !== "pizza").map((i) => i.productId),
    ["mpi-massa-nova"],
    "pedido sem snapshot usa a receita ao vivo",
  );
});

void test("expandRecipeIntoItems — produto SEM linha num pedido congelado não cai na receita ao vivo", () => {
  // Regressão 24/07: o produto não tinha receita na liberação (logo, nenhuma linha no
  // snapshot). Ao adicionar um MPI à receita depois, `frozenRecipe ?? liveProduct.recipe`
  // caía na receita NOVA e criava OP de MPI para um pedido JÁ LIBERADO (produção duplicada).
  const farinha = makeIngredient("farinha", "Farinha");
  const massaNova = makeMpiProduct({ id: "mpi-massa-nova", name: "Massa Nova" });
  const pizza = {
    ...makePizzaProduct(),
    recipe: [
      { id: "r1", sourceType: "ingrediente", sourceId: "farinha", label: "Farinha", quantity: 0.6, unit: "Kg" },
      { id: "r2", sourceType: "produto", sourceId: "mpi-massa-nova", label: "Massa Nova", quantity: 0.4, unit: "Kg" },
    ],
  } as ProductionProduct;
  const productsById = new Map([
    [pizza.id, pizza],
    [massaNova.id, massaNova],
  ]);

  // O pedido TEM snapshot, mas a pizza não tem linha nele (não tinha receita na liberação).
  const releasedRecipeByOrderProduct = new Map([
    ["order-1", new Map<string, ProductionProduct["recipe"]>()],
  ]);

  const liberado = expandRecipeIntoItems(
    [makePlannedItem({ orderId: "order-1", releasedToProduction: true })],
    productsById,
    [farinha],
    [pizza, massaNova],
    { releasedRecipeByOrderProduct },
  );

  assert.deepEqual(
    liberado.filter((item) => item.productId !== "pizza").map((item) => item.productId),
    [],
    "pedido congelado sem linha do produto não expande MPI adicionado depois",
  );
});
