import assert from "node:assert/strict";
import test from "node:test";

import type { ProductionIngredient, ProductionProduct } from "@/lib/production-planning";

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
    expeditionUnit: "Kg",
    expeditionQuantityRaw: 2,
    expeditionQuantity: 2,
    canPlan: true,
    scheduleDayPriority: 1,
    availableForRelease: true,
    releasedToProduction: false,
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
