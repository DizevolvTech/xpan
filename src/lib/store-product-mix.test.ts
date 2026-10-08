import assert from "node:assert/strict";
import test from "node:test";

import {
  isProductInStoreMix,
  normalizeStoreProductMix,
  resolveStoreProductMixForSave,
  selectStoresForProduct,
} from "@/lib/store-product-mix";

test("sem mix definido a loja recebe todos os produtos (padrão do cliente sem mix)", () => {
  assert.equal(isProductInStoreMix(null, "p-1"), true);
  assert.equal(isProductInStoreMix(undefined, "p-1"), true);
  assert.equal(isProductInStoreMix([], "p-1"), true);
});

test("com mix definido só os produtos marcados entram por padrão", () => {
  assert.equal(isProductInStoreMix(["p-1", "p-2"], "p-1"), true);
  assert.equal(isProductInStoreMix(["p-1", "p-2"], "p-3"), false);
});

test("leitura do banco é tolerante: lixo, vazio e não-lista viram 'todos os produtos'", () => {
  assert.equal(normalizeStoreProductMix(null), null);
  assert.equal(normalizeStoreProductMix(undefined), null);
  assert.equal(normalizeStoreProductMix([]), null);
  assert.equal(normalizeStoreProductMix("p-1"), null);
  assert.equal(normalizeStoreProductMix({ a: 1 }), null);
  assert.equal(normalizeStoreProductMix([1, null, "  ", ""]), null);
});

test("leitura limpa espaços e remove duplicados preservando a ordem", () => {
  assert.deepEqual(normalizeStoreProductMix([" p-1 ", "p-2", "p-1", 7, "p-3"]), ["p-1", "p-2", "p-3"]);
});

test("gravar: null e ausente significam todos; lista válida é normalizada", () => {
  assert.deepEqual(resolveStoreProductMixForSave(null), { ok: true, mix: null });
  assert.deepEqual(resolveStoreProductMixForSave(undefined), { ok: true, mix: null });
  assert.deepEqual(resolveStoreProductMixForSave(["p-1", "p-1", "p-2"]), { ok: true, mix: ["p-1", "p-2"] });
});

test("gravar: lista vazia é recusada (esconderia todo o catálogo da loja)", () => {
  for (const value of [[], [""], ["  "], [null]]) {
    const result = resolveStoreProductMixForSave(value);
    assert.equal(result.ok, false, JSON.stringify(value));
  }
});

test("gravar: valor que não é lista é recusado em vez de virar 'todos' em silêncio", () => {
  for (const value of ["p-1", 3, { a: 1 }, true]) {
    assert.equal(resolveStoreProductMixForSave(value).ok, false, JSON.stringify(value));
  }
});

const STORES = [
  { id: "s-gourmet", productMix: ["p-1", "p-2", "p-3"] },
  { id: "s-basica", productMix: ["p-1"] },
  { id: "s-nova", productMix: null },
];

test("centralizado: por padrão cada loja vê só os produtos do seu mix; loja sem mix vê todos", () => {
  const ids = (productId: string) =>
    selectStoresForProduct(STORES, productId, { showAll: false }).map((store) => store.id);

  assert.deepEqual(ids("p-1"), ["s-gourmet", "s-basica", "s-nova"]);
  assert.deepEqual(ids("p-3"), ["s-gourmet", "s-nova"]);
});

test("centralizado: 'mostrar todas as lojas' desfaz o filtro (pedido fora do padrão não é bloqueado)", () => {
  const all = selectStoresForProduct(STORES, "p-3", { showAll: true }).map((store) => store.id);
  assert.deepEqual(all, ["s-gourmet", "s-basica", "s-nova"]);
});

test("centralizado: loja fora do mix com quantidade já digitada não some da tela", () => {
  const visible = selectStoresForProduct(STORES, "p-3", {
    showAll: false,
    hasQuantity: (storeId) => storeId === "s-basica",
  }).map((store) => store.id);

  assert.deepEqual(visible, ["s-gourmet", "s-basica", "s-nova"]);
});
