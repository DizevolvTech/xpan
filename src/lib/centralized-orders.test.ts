import assert from "node:assert/strict";
import test from "node:test";
import { reviewOrderEntries, type OrderEntryCatalog } from "./centralized-orders";

const catalog: OrderEntryCatalog = {
  stores: [{ id: "s1", code: "001", name: "Loja Centro" }, { id: "s2", code: "002", name: "Loja Praia" }],
  products: [{ id: "p1", code: "PR-01", externalCode: "0009", name: "Bolo de Laranja", unit: "Un" }],
};
test("centralizado preserva produto e quantidades distintas por loja", () => {
  const result = reviewOrderEntries([{ row: 2, store: "001", product: "0009", quantity: 100 }, { row: 3, store: "Loja Praia", product: "PR-01", quantity: 50 }], catalog);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows.map(r => [r.storeId, r.productId, r.quantity]), [["s1", "p1", 100], ["s2", "p1", 50]]);
});
test("importação identifica linhas desconhecidas, duplicadas e fracionárias", () => {
  const result = reviewOrderEntries([
    { row: 2, store: "001", product: "0009", quantity: 1 },
    { row: 3, store: "001", product: "0009", quantity: 2 },
    { row: 4, store: "002", product: "0009", quantity: "1,5" },
    { row: 5, store: "outra", product: "novo", quantity: 1 },
    { row: 6, store: "002", product: "0009", quantity: -1 },
  ], catalog);
  assert.deepEqual([...new Set(result.errors.map(e => e.row))], [3, 4, 5, 6]);
});
test("nomes ambíguos não selecionam arbitrariamente uma loja", () => {
  const result = reviewOrderEntries([{ row: 2, store: "Loja Centro", product: "0009", quantity: 1 }], { ...catalog, stores: [...catalog.stores, { id: "s3", code: "003", name: "Loja Centro" }] });
  assert.match(result.errors[0].message, /ambígua/);
});

test("mix da loja não bloqueia o centralizado nem a planilha: produto fora do mix é aceito", () => {
  const withMix: OrderEntryCatalog = {
    ...catalog,
    stores: [
      { id: "s1", code: "001", name: "Loja Centro", productMix: ["outro-produto"] },
      { id: "s2", code: "002", name: "Loja Praia", productMix: null },
    ],
  };
  const result = reviewOrderEntries(
    [{ row: 2, store: "001", product: "0009", quantity: 10 }, { row: 3, store: "002", product: "0009", quantity: 5 }],
    withMix,
  );

  assert.deepEqual(result.errors, [], "p1 está fora do mix de s1 e mesmo assim a linha vale");
  assert.deepEqual(result.rows.map(r => [r.storeId, r.productId, r.quantity]), [["s1", "p1", 10], ["s2", "p1", 5]]);
});

const kgCatalog: OrderEntryCatalog = {
  stores: [{ id: "s1", code: "001", name: "Loja Centro" }, { id: "s2", code: "002", name: "Loja Praia" }],
  products: [
    { id: "p1", code: "PR-01", externalCode: "0009", name: "Bolo de Laranja", unit: "Un" },
    { id: "p2", code: "PR-02", externalCode: "0010", name: "Massa de Pão", unit: "Kg" },
  ],
};

test("DEFEITO ORIGINAL: '1.000' numa planilha vale mil, não um", () => {
  const result = reviewOrderEntries([{ row: 2, store: "001", product: "0009", quantity: "1.000" }], kgCatalog);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].quantity, 1000);
  assert.deepEqual(result.warnings, [], "unidade inteira não tem ambiguidade");
});

test("milhar em produto por peso vale mil e vira AVISO por linha, sem bloquear", () => {
  const result = reviewOrderEntries([{ row: 7, store: "001", product: "0010", quantity: "1.000" }], kgCatalog);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].quantity, 1000);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].row, 7);
  assert.match(result.warnings[0].message, /milhar/);
  assert.match(result.rows[0].warning ?? "", /milhar/);
});

test("quantidade com a unidade do produto é aceita; com outra unidade é recusada com explicação", () => {
  const good = reviewOrderEntries([{ row: 2, store: "001", product: "0009", quantity: "12 un" }], kgCatalog);
  assert.deepEqual(good.errors, []);
  assert.equal(good.rows[0].quantity, 12);
  const wrong = reviewOrderEntries([{ row: 3, store: "001", product: "0009", quantity: "5 kg" }], kgCatalog);
  assert.match(wrong.errors[0].message, /Converta/);
});

test("erros dizem o que errou e sugerem o nome parecido", () => {
  const result = reviewOrderEntries([
    { row: 2, store: "Loja Cetro", product: "0009", quantity: 1 },
    { row: 3, store: "001", product: "Bolo de Laranj", quantity: 1 },
    { row: 4, store: "999", product: "0009", quantity: 1 },
    { row: 5, store: "", product: "0009", quantity: 1 },
  ], kgCatalog);
  const byRow = new Map(result.errors.map(e => [e.row, e.message]));
  assert.match(byRow.get(2) ?? "", /Quis dizer 001 · Loja Centro\?/);
  assert.match(byRow.get(3) ?? "", /Quis dizer 0009 · Bolo de Laranja\?/);
  assert.match(byRow.get(4) ?? "", /Confira o código/);
  assert.match(byRow.get(5) ?? "", /em branco/);
});

test("linha repetida aponta a primeira ocorrência", () => {
  const result = reviewOrderEntries([
    { row: 2, store: "001", product: "0009", quantity: 1 },
    { row: 9, store: "001", product: "0009", quantity: 2 },
  ], kgCatalog);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].row, 9);
  assert.match(result.errors[0].message, /linha 2/);
});

test("unidade inteira recusa fração e diz qual produto", () => {
  const result = reviewOrderEntries([{ row: 2, store: "001", product: "0009", quantity: "2,5" }], kgCatalog);
  assert.match(result.errors[0].message, /Bolo de Laranja.*inteiras/);
});

test("erro na quantidade não impede de apontar loja/produto ruins na MESMA linha", () => {
  const result = reviewOrderEntries([{ row: 2, store: "xx", product: "yy", quantity: "abc" }], kgCatalog);
  const messages = result.errors.map(e => e.message).join(" | ");
  assert.match(messages, /Loja/);
  assert.match(messages, /Produto/);
  assert.match(messages, /Quantidade/);
});

test("código ERP que o Excel guardou como número (zeros perdidos) ainda é reconhecido", () => {
  const result = reviewOrderEntries([
    { row: 2, store: "1", product: "9", quantity: 5 },
    { row: 3, store: "002", product: "0009", quantity: 5 },
  ], catalog);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows.map(r => [r.storeId, r.productId]), [["s1", "p1"], ["s2", "p1"]]);
});

test("sem zeros só casa quando é único: '1' não vira '01' e '001' ao mesmo tempo", () => {
  const ambiguous: OrderEntryCatalog = { ...catalog, stores: [{ id: "a", code: "01", name: "A" }, { id: "b", code: "001", name: "B" }] };
  const result = reviewOrderEntries([{ row: 2, store: "1", product: "0009", quantity: 1 }], ambiguous);
  assert.match(result.errors[0].message, /ambígua/);
});

test("zeros não viram coincidência com nome ou texto que não é só número", () => {
  const result = reviewOrderEntries([{ row: 2, store: "001", product: "009", quantity: 1 }], { ...catalog, products: [{ id: "p9", code: "PR-009", name: "Pão", unit: "Un" }] });
  assert.match(result.errors[0].message, /não reconhecido/);
});

import { findOrderConflicts } from "./centralized-orders";

test("conflito com pedido ativo: diz a loja e o código do pedido, uma vez por loja", () => {
  const { errors, conflicts } = findOrderConflicts(
    [
      { row: 2, storeId: "s1", storeName: "Loja Centro" },
      { row: 3, storeId: "s1", storeName: "Loja Centro" },
      { row: 4, storeId: "s2", storeName: "Loja Praia" },
    ],
    [{ storeId: "s1", code: "PD-261012-0003" }],
  );
  assert.deepEqual(conflicts, [{ storeId: "s1", storeName: "Loja Centro", orderCode: "PD-261012-0003" }]);
  assert.deepEqual(errors.map(e => e.row), [2, 3], "todas as linhas da loja em conflito são apontadas");
  assert.match(errors[0].message, /Loja Centro já tem o pedido PD-261012-0003/);
});

test("sem pedido existente, não há conflito", () => {
  assert.deepEqual(findOrderConflicts([{ row: 2, storeId: "s1", storeName: "Loja Centro" }], []), { errors: [], conflicts: [] });
});

import { canConfirmReview, gridToEntryRows } from "./centralized-orders";

test("confirmar: erro bloqueia sempre; aviso exige 'conferi'; sem linhas não confirma", () => {
  assert.equal(canConfirmReview({ rows: [1], errors: [{}], warnings: [] }, true).allowed, false);
  assert.equal(canConfirmReview({ rows: [], errors: [], warnings: [] }, true).allowed, false);
  assert.equal(canConfirmReview({ rows: [1], errors: [], warnings: [{}] }, false).allowed, false);
  assert.match(canConfirmReview({ rows: [1], errors: [], warnings: [{}] }, false).reason ?? "", /avisos/);
  assert.equal(canConfirmReview({ rows: [1], errors: [], warnings: [{}] }, true).allowed, true);
  assert.equal(canConfirmReview({ rows: [1], errors: [], warnings: [] }, false).allowed, true);
  assert.equal(canConfirmReview({ rows: [1], errors: [] }, false).allowed, true);
});

test("grade: vazio e zero não geram linha, texto da quantidade é preservado para a revisão", () => {
  const rows = gridToEntryRows({
    p1: { s1: "10", s2: "", s3: "0", s4: "0,0", s5: " 1.000 " },
    p2: { s1: "2,5" },
  });
  assert.deepEqual(rows.map(r => [r.product, r.store, r.quantity]), [["p1", "s1", "10"], ["p1", "s5", "1.000"], ["p2", "s1", "2,5"]]);
  assert.deepEqual(rows.map(r => r.row), [1, 2, 3]);
});

test("sugestão não usa código curto como 'contém': PR-71838 não vira o produto de código externo '1'", () => {
  const cat: OrderEntryCatalog = {
    stores: [{ id: "s1", code: "LJ-009", name: "Jardim Blumenau" }],
    products: [
      { id: "a", code: "PR-15610", externalCode: "1", name: "Pão Francês", unit: "Un" },
      { id: "b", code: "PR-71837", externalCode: "1720", name: "Pão Caseiro", unit: "Kg" },
    ],
  };
  const result = reviewOrderEntries([{ row: 2, store: "LJ-009", product: "PR-71838", quantity: 1 }], cat);
  assert.match(result.errors[0].message, /Quis dizer 1720 · Pão Caseiro\?/);
  assert.doesNotMatch(result.errors[0].message, /Pão Francês/);
});

test("sem nada parecido, não inventa sugestão", () => {
  const result = reviewOrderEntries([{ row: 2, store: "LJ-009", product: "zzzzzzzz", quantity: 1 }], {
    stores: [{ id: "s1", code: "LJ-009", name: "Jardim Blumenau" }],
    products: [{ id: "a", code: "PR-1", name: "Pão", unit: "Un" }],
  });
  assert.doesNotMatch(result.errors[0].message, /Quis dizer/);
  assert.match(result.errors[0].message, /Confira o código/);
});
