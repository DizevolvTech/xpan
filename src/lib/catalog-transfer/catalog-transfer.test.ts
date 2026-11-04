import assert from "node:assert/strict";
import test from "node:test";

import { buildCatalogFile, buildCatalogFileName, parseCatalogFile } from "@/lib/catalog-transfer/build-file";
import { buildImportPlan, CatalogPlanError, formatImportDescription, nextFactoryCode, UndoLog } from "@/lib/catalog-transfer/plan";
import { buildCatalogReview, defaultSelection, toggleSelection } from "@/lib/catalog-transfer/review";
import type { CatalogDestination, CatalogFile, Row } from "@/lib/catalog-transfer/types";

/* ---------------- ambiente de origem (teste): panetone com MPI (esponja) e etapa cadastrada ---------------- */

const src = {
  subcategories: [{ id: "sub-1", code: "LP001", name: "Panetones" }] as Row[],
  ingredients: [
    { id: "ing-farinha", tenant_id: "t1", code: "IN000001", external_code: "9001", name: "Farinha", unit: "Kg", supply_class: "MP", created_at: "x", updated_at: "x", legacy_id: "ingredient-1" },
    { id: "ing-fruta", tenant_id: "t1", code: "IN000002", external_code: "9002", name: "Frutas", unit: "Kg", supply_class: "MP", created_at: "x", updated_at: "x", legacy_id: "ingredient-2" },
    { id: "ing-nao-usado", tenant_id: "t1", code: "IN000003", external_code: "9003", name: "Sal", unit: "Kg", supply_class: "MP", created_at: "x", updated_at: "x", legacy_id: "ingredient-3" },
  ] as Row[],
  products: [
    { id: "p-pan", tenant_id: "t1", legacy_id: "product-a", code: "PR00010", external_code: "7001", gtin: "7890000000011", name: "PANETONE CHAMA FRUTAS CP 400G", subcategory_id: "sub-1", operational_subcategory_id: "sub-1", active: true, validity_days: 120, recipe_stage_config: [{ stage: "operacional__embalagem" }], created_at: "x", updated_at: "x" },
    { id: "p-esp", tenant_id: "t1", legacy_id: "product-b", code: "PR00011", external_code: null, name: "ESPONJA", subcategory_id: "sub-1", operational_subcategory_id: null, active: true, validity_days: 2, created_at: "x", updated_at: "x" },
    { id: "p-outro", tenant_id: "t1", legacy_id: "product-c", code: "PR00012", external_code: "7002", name: "OUTRO", subcategory_id: "sub-1", active: true, validity_days: 5, created_at: "x", updated_at: "x" },
  ] as Row[],
  recipeItems: [
    { id: "r1", tenant_id: "t1", product_id: "p-pan", source_type: "produto", product_source_id: "p-esp", ingredient_source_id: null, label: "ESPONJA", quantity: 2, unit: "Kg", sort_order: 0, stage: "massa", is_main: false },
    { id: "r2", tenant_id: "t1", product_id: "p-pan", source_type: "ingrediente", ingredient_source_id: "ing-farinha", product_source_id: null, label: "Farinha", quantity: 10, unit: "Kg", sort_order: 1, stage: "massa", is_main: true },
    { id: "r3", tenant_id: "t1", product_id: "p-pan", source_type: "ingrediente", ingredient_source_id: "ing-fruta", product_source_id: null, label: "Frutas", quantity: 3, unit: "Kg", sort_order: 2, stage: "operacional__embalagem", is_main: false },
    { id: "r4", tenant_id: "t1", product_id: "p-esp", source_type: "ingrediente", ingredient_source_id: "ing-farinha", product_source_id: null, label: "Farinha", quantity: 1, unit: "Kg", sort_order: 0, stage: "massa", is_main: false },
  ] as Row[],
  preparationSteps: [{ product_id: "p-pan", stage_key: "em_producao", sort_order: 0 }] as Row[],
  stages: [
    { id: "s1", tenant_id: "t1", key: "operacional__embalagem", label: "Embalagem", base_stage: "operacional", active: true, sort_order: 1 },
    { id: "s2", tenant_id: "t1", key: "operacional__nao_usada", label: "Não usada", base_stage: "operacional", active: true, sort_order: 2 },
  ] as Row[],
};

function exportPanetone(): CatalogFile {
  return buildCatalogFile({ companyName: "Grupo Chama", exportedAt: "2026-11-04T12:00:00Z", selectedProductIds: ["p-pan"], ...src });
}

/* ---------------- ambiente de destino (definitivo): vazio, mas com a linha de produção ---------------- */

function emptyDestination(): CatalogDestination {
  return {
    products: [],
    recipeItems: [],
    ingredients: [],
    preparationSteps: [],
    stages: [],
    subcategories: [{ id: "dsub-1", code: "LP009", name: "PANETONES" }],
  };
}

test("exportar: receita completa, MPI incluído sem marcar, insumos usados e etapa cadastrada, sem ids", () => {
  const file = exportPanetone();
  assert.equal(file.format, "xpan-catalog");
  assert.deepEqual(file.products.map((p) => [p.key, p.includedAsIngredient]), [
    ["L:7001", false],
    ["F:PR00011", true],
  ]);
  // só insumos usados (sal fica de fora) e só a etapa cadastrada usada
  assert.deepEqual(file.ingredients.map((i) => i.code), ["IN000001", "IN000002"]);
  assert.deepEqual(file.stages.map((s) => s.key), ["operacional__embalagem"]);
  const panetone = file.products[0];
  assert.deepEqual(panetone.recipe.map((l) => [l.sourceType, l.ingredientCode, l.productKey, l.fields.quantity]), [
    ["produto", null, "F:PR00011", 2],
    ["ingrediente", "IN000001", null, 10],
    ["ingrediente", "IN000002", null, 3],
  ]);
  const serialized = JSON.stringify(file);
  for (const forbidden of ["p-pan", "ing-farinha", "sub-1", "tenant_id", "product_source_id", "created_at"]) {
    assert.ok(!serialized.includes(forbidden), `não deveria viajar: ${forbidden}`);
  }
  assert.equal(panetone.fields.gtin, "7890000000011");
  assert.equal(panetone.line?.name, "Panetones");
  assert.deepEqual(panetone.preparationSteps, [{ stageKey: "em_producao", sortOrder: 0 }]);
});

test("exportar: coluna nova do produto viaja sem mudar o código", () => {
  const products = src.products.map((p) => (p.id === "p-pan" ? { ...p, coluna_nova_do_futuro: "abc" } : p));
  const file = buildCatalogFile({ companyName: "x", exportedAt: "x", selectedProductIds: ["p-pan"], ...src, products });
  assert.equal(file.products[0].fields.coluna_nova_do_futuro, "abc");
});

test("exportar: respeita o limite de produtos e exige seleção", () => {
  assert.throws(() => buildCatalogFile({ companyName: "x", exportedAt: "x", selectedProductIds: [], ...src }), /ao menos um produto/);
  assert.equal(buildCatalogFileName(new Date(2026, 10, 4)), "xpan-cadastros-2026-11-04.json");
});

test("importar no destino vazio: produtos, MPI, insumos e etapa saem como novos e o MPI vem junto", () => {
  const review = buildCatalogReview(exportPanetone(), emptyDestination());
  assert.deepEqual(review.products.map((p) => [p.key, p.action, p.blocked]), [
    ["L:7001", "novo", false],
    ["F:PR00011", "novo", false],
  ]);
  assert.deepEqual(review.ingredients.map((i) => [i.code, i.status]), [["IN000001", "novo"], ["IN000002", "novo"]]);
  assert.deepEqual(review.stages.map((s) => [s.key, s.status]), [["operacional__embalagem", "nova"]]);
  assert.deepEqual(review.products[0].requires, ["F:PR00011"]);
  assert.deepEqual(defaultSelection(review), ["L:7001", "F:PR00011"]);
  assert.deepEqual(review.summary, { novos: 2, atualizar: 0, iguais: 0, bloqueados: 0 });
});

test("plano: ids remapeados, receita aponta para os ids do destino, insumo novo e etapa nova criados", () => {
  const file = exportPanetone();
  let n = 0;
  const { plan } = buildImportPlan(file, emptyDestination(), ["L:7001", "F:PR00011"], { newId: () => `new-${++n}`, now: "2026-11-04T00:00:00Z" });
  assert.equal(plan.stages.length, 1);
  assert.equal(plan.stages[0].base_stage, "operacional");
  assert.deepEqual(plan.ingredients.map((i) => i.code), ["IN000001", "IN000002"]);
  const panetone = plan.newProducts.find((p) => p.key === "L:7001")!;
  const esponja = plan.newProducts.find((p) => p.key === "F:PR00011")!;
  assert.equal(panetone.row.subcategory_id, "dsub-1");
  assert.equal(panetone.row.operational_subcategory_id, null);
  assert.equal(panetone.row.code, "PR00010");
  assert.equal(panetone.row.gtin, "7890000000011");
  assert.ok(!("tenant_id" in panetone.row));
  const mpiLine = panetone.recipeRows.find((r) => r.source_type === "produto")!;
  assert.equal(mpiLine.product_source_id, esponja.id);
  assert.equal(mpiLine.product_id, panetone.id);
  const farinha = plan.ingredients.find((i) => i.code === "IN000001")!;
  assert.equal(panetone.recipeRows.find((r) => r.label === "Farinha")!.ingredient_source_id, farinha.id);
  assert.equal(panetone.recipeRows.find((r) => r.label === "Farinha")!.quantity, 10);
  assert.ok(panetone.recipeRows.every((r) => !("id" in r)));
  assert.equal(panetone.preparationSteps[0].stage_key, "em_producao");
});

/* ---------------- produto existente com receita alterada ---------------- */

function destinationWithOldPanetone(): CatalogDestination {
  return {
    products: [
      { id: "d-pan", tenant_id: "t2", legacy_id: "product-z", code: "PR00500", external_code: "7001", gtin: null, name: "PANETONE CHAMA FRUTAS CP 400G", subcategory_id: "dsub-1", active: true, validity_days: 90, recipe_stage_config: [], created_at: "x", updated_at: "x" },
      { id: "d-esp", tenant_id: "t2", legacy_id: "product-y", code: "PR00011", external_code: null, name: "ESPONJA", subcategory_id: "dsub-1", active: true, validity_days: 2, recipe_stage_config: [], created_at: "x", updated_at: "x" },
    ],
    recipeItems: [
      { id: "dr1", tenant_id: "t2", product_id: "d-pan", source_type: "produto", product_source_id: "d-esp", ingredient_source_id: null, label: "ESPONJA", quantity: 1, unit: "Kg", sort_order: 0, stage: "massa", is_main: false },
      { id: "dr2", tenant_id: "t2", product_id: "d-pan", source_type: "ingrediente", ingredient_source_id: "d-ing-farinha", product_source_id: null, label: "Farinha", quantity: 10, unit: "Kg", sort_order: 1, stage: "massa", is_main: true },
      { id: "dr3", tenant_id: "t2", product_id: "d-pan", source_type: "ingrediente", ingredient_source_id: "d-ing-sal", product_source_id: null, label: "Sal", quantity: 0.1, unit: "Kg", sort_order: 2, stage: "massa", is_main: false },
      { id: "dr4", tenant_id: "t2", product_id: "d-esp", source_type: "ingrediente", ingredient_source_id: "d-ing-farinha", product_source_id: null, label: "Farinha", quantity: 1, unit: "Kg", sort_order: 0, stage: "massa", is_main: false },
    ],
    ingredients: [
      { id: "d-ing-farinha", tenant_id: "t2", code: "IN000001", external_code: "9001", name: "Farinha", unit: "Kg", supply_class: "MP" },
      { id: "d-ing-sal", tenant_id: "t2", code: "IN000003", external_code: "9003", name: "Sal", unit: "Kg", supply_class: "MP" },
    ],
    preparationSteps: [],
    stages: [],
    subcategories: [{ id: "dsub-1", code: "LP009", name: "PANETONES" }],
  };
}

test("produto existente com receita alterada: 'Vai atualizar' mostra campos e linhas; igual fica 'Igual'", () => {
  const review = buildCatalogReview(exportPanetone(), destinationWithOldPanetone());
  const panetone = review.products.find((p) => p.key === "L:7001")!;
  const esponja = review.products.find((p) => p.key === "F:PR00011")!;
  assert.equal(panetone.action, "atualizar");
  assert.equal(esponja.action, "igual");
  assert.ok(panetone.changes.some((c) => c.label === "Validade (dias)" && c.from === "90" && c.to === "120"));
  assert.ok(panetone.changes.some((c) => c.field === "gtin" && c.to === "7890000000011"));
  const texts = panetone.recipeChanges.map((c) => `${c.kind}:${c.text}`);
  assert.ok(texts.some((t) => t.startsWith("alterado:") && t.includes("ESPONJA") && t.includes("Quantidade: 1 → 2")));
  assert.ok(texts.some((t) => t.startsWith("adicionado:") && t.includes("Frutas")));
  assert.ok(texts.some((t) => t.startsWith("removido:") && t.includes("Sal")));
  assert.deepEqual(review.ingredients.map((i) => [i.code, i.status]), [["IN000001", "existe"], ["IN000002", "novo"]]);
  assert.deepEqual(panetone.requires, []); // MPI já existe no destino
  assert.deepEqual(defaultSelection(review), ["L:7001"]);
});

test("plano de atualização: mantém código de fábrica e id do destino, troca a receita pelos ids do destino", () => {
  let n = 0;
  const { plan } = buildImportPlan(exportPanetone(), destinationWithOldPanetone(), ["L:7001"], { newId: () => `new-${++n}`, now: "2026-11-04T00:00:00Z" });
  assert.equal(plan.newProducts.length, 0);
  const update = plan.updatedProducts[0];
  assert.equal(update.id, "d-pan");
  assert.ok(!("code" in update.row) && !("external_code" in update.row) && !("id" in update.row));
  assert.equal(update.row.validity_days, 120);
  assert.equal(update.row.updated_at, "2026-11-04T00:00:00Z");
  const mpi = update.recipeRows.find((r) => r.source_type === "produto")!;
  assert.equal(mpi.product_source_id, "d-esp");
  assert.equal(update.recipeRows.find((r) => r.label === "Farinha")!.ingredient_source_id, "d-ing-farinha");
  assert.equal(update.recipeRows.find((r) => r.label === "Frutas")!.ingredient_source_id, plan.ingredients[0].id);
  assert.equal(plan.ingredients.length, 1);
  assert.equal(update.recipeRows.length, 3);
  assert.equal(update.changes.length > 0, true);
});

/* ---------------- conflitos ---------------- */

test("conflito: dois produtos com o mesmo código no destino bloqueiam só aquele item", () => {
  const dest = destinationWithOldPanetone();
  dest.products.push({ id: "d-dup", tenant_id: "t2", legacy_id: "product-w", code: "PR00600", external_code: "7001", name: "DUPLICADO", subcategory_id: "dsub-1" });
  const review = buildCatalogReview(exportPanetone(), dest);
  const panetone = review.products.find((p) => p.key === "L:7001")!;
  assert.equal(panetone.blocked, true);
  assert.match(panetone.conflicts[0], /2 produtos com código da loja 7001 no destino/);
  assert.equal(review.products.find((p) => p.key === "F:PR00011")!.blocked, false);
  assert.throws(() => buildImportPlan(exportPanetone(), dest, ["L:7001"], { newId: () => "x", now: "n" }), CatalogPlanError);
  assert.equal(review.summary.bloqueados, 1);
});

test("conflito: dois produtos com o mesmo código dentro do arquivo", () => {
  const file = exportPanetone();
  file.products.push({ ...file.products[0], name: "COPIA" });
  const review = buildCatalogReview(file, emptyDestination());
  assert.equal(review.products.filter((p) => p.blocked && /mais de um produto/.test(p.conflicts[0])).length, 3 - 1);
});

test("conflito: insumo com unidade diferente bloqueia os produtos que o usam (e o MPI depende dele)", () => {
  const dest = destinationWithOldPanetone();
  dest.ingredients[0] = { ...dest.ingredients[0], unit: "Un" };
  const review = buildCatalogReview(exportPanetone(), dest);
  assert.match(review.ingredients.find((i) => i.code === "IN000001")!.conflicts[0], /Unidade diferente/);
  const panetone = review.products.find((p) => p.key === "L:7001")!;
  assert.equal(panetone.blocked, true);
  assert.match(panetone.conflicts[0], /IN000001/);
});

test("conflito: linha de produção inexistente bloqueia produto novo mas não o existente", () => {
  const noLine = emptyDestination();
  noLine.subcategories = [];
  const review = buildCatalogReview(exportPanetone(), noLine);
  assert.match(review.products[0].conflicts[0], /linha de produção "Panetones" não existe/);
  assert.equal(review.products[0].blocked, true);
  // MPI novo bloqueado arrasta o produto que depende dele
  const dest = destinationWithOldPanetone();
  dest.products = dest.products.filter((p) => p.id === "d-pan");
  dest.recipeItems = dest.recipeItems.filter((r) => r.product_id === "d-pan" && r.source_type !== "produto");
  dest.subcategories = [{ id: "x", code: "LP1", name: "Outra" }];
  const other = buildCatalogReview(exportPanetone(), dest);
  const panetone = other.products.find((p) => p.key === "L:7001")!;
  assert.equal(panetone.action, "atualizar");
  assert.equal(panetone.blocked, true); // depende do MPI novo (esponja), que está bloqueado
  assert.ok(panetone.conflicts.some((c) => /Depende do MPI/.test(c)));
});

test("código de fábrica do produto novo já usado no destino: gera outro e avisa", () => {
  const dest = emptyDestination();
  dest.products.push({ id: "d1", code: "PR00010", external_code: "OUTRO", name: "Ocupa o código", subcategory_id: "dsub-1" });
  const review = buildCatalogReview(exportPanetone(), dest);
  assert.match(review.products[0].notes[0], /PR00010 já existe/);
  const { plan } = buildImportPlan(exportPanetone(), dest, ["L:7001", "F:PR00011"], { newId: () => crypto.randomUUID(), now: "n" });
  // o MPI (sem código da loja) é identificado pelo código de fábrica e o mantém
  assert.equal(plan.newProducts.find((p) => p.key === "F:PR00011")!.row.code, "PR00011");
  assert.equal(plan.newProducts.find((p) => p.key === "L:7001")!.row.code, "PR00012");
  assert.equal(nextFactoryCode(["PR00001", "PR00099", "XX"]), "PR00100");
});

/* ---------------- seleção ---------------- */

test("seleção: ligar produto puxa o MPI novo; desligar o MPI desliga quem depende; plano exige o MPI", () => {
  const review = buildCatalogReview(exportPanetone(), emptyDestination());
  assert.deepEqual(toggleSelection(review, [], "L:7001", true).sort(), ["F:PR00011", "L:7001"]);
  assert.deepEqual(toggleSelection(review, ["L:7001", "F:PR00011"], "F:PR00011", false), []);
  assert.deepEqual(toggleSelection(review, ["L:7001", "F:PR00011"], "L:7001", false), ["F:PR00011"]);
  assert.throws(() => buildImportPlan(exportPanetone(), emptyDestination(), ["L:7001"], { newId: () => "x", now: "n" }), /MPI/);
});

test("plano ignora 'Igual' e só cria insumos/etapas dos produtos selecionados", () => {
  const { plan } = buildImportPlan(exportPanetone(), destinationWithOldPanetone(), ["F:PR00011"], { newId: () => "x", now: "n" });
  assert.equal(plan.updatedProducts.length + plan.newProducts.length, 0);
  assert.equal(plan.ingredients.length, 0);
  assert.equal(plan.stages.length, 0);
});

/* ---------------- arquivo e desfazer ---------------- */

test("arquivo inválido ou grande demais é recusado com mensagem clara", () => {
  assert.equal(parseCatalogFile({ foo: 1 }).ok, false);
  const ok = parseCatalogFile(JSON.parse(JSON.stringify(exportPanetone())));
  assert.equal(ok.ok, true);
  const tooMany = { ...exportPanetone(), products: Array.from({ length: 2001 }, () => exportPanetone().products[0]) };
  const result = parseCatalogFile(tooMany);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /limite é 2000/);
  const future = parseCatalogFile({ ...exportPanetone(), version: 99 });
  assert.equal(future.ok, false);
});

test("desfazer roda do último ao primeiro e informa o que não conseguiu desfazer", async () => {
  const order: string[] = [];
  const log = new UndoLog();
  log.push("a", async () => void order.push("a"));
  log.push("b", async () => {
    throw new Error("boom");
  });
  log.push("c", async () => void order.push("c"));
  const failures = await log.rollback();
  assert.deepEqual(order, ["c", "a"]);
  assert.deepEqual(failures, ["b: boom"]);
  assert.equal(log.size, 0);
});

test("descrição da versão: 'Importado de <arquivo> em <data>'", () => {
  assert.equal(
    formatImportDescription("xpan-cadastros-2026-11-04.json", new Date("2026-11-04T15:00:00Z")),
    "Importado de xpan-cadastros-2026-11-04.json em 04/11/2026",
  );
});
