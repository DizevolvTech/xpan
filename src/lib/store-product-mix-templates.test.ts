import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanStoreProductMixTemplateName,
  getStoreProductMixMode,
  mapStoreProductMixTemplateRows,
  resolveEffectiveStoreProductMix,
  selectStoreMixItems,
  toggleProductInMixList,
} from "@/lib/store-product-mix";
import {
  buildProductStoreMixToggles,
  diffProductStoreMixToggles,
  hasProductStoreMixChanges,
} from "@/components/production/product-store-mix-section";

const templates = [
  { id: "t-rua", name: "Loja de rua", productIds: ["p-1", "p-2"] },
  { id: "t-quiosque", name: "Quiosque", productIds: ["p-3"] },
];

test("#602 mix efetivo: modelo vale acima da lista manual", () => {
  assert.deepEqual(
    resolveEffectiveStoreProductMix({ productMixTemplateId: "t-quiosque", manualProductMix: ["p-1"] }, templates),
    ["p-3"],
  );
});

test("#602 mix efetivo: sem modelo usa a lista manual; sem nada, todos (null)", () => {
  assert.deepEqual(resolveEffectiveStoreProductMix({ productMixTemplateId: null, manualProductMix: ["p-2"] }, templates), ["p-2"]);
  assert.equal(resolveEffectiveStoreProductMix({ productMixTemplateId: null, manualProductMix: null }, templates), null);
});

test("#602 mix efetivo: modelo apagado/sumido nunca deixa a loja sem catálogo", () => {
  assert.equal(resolveEffectiveStoreProductMix({ productMixTemplateId: "t-x", manualProductMix: null }, templates), null);
  assert.deepEqual(resolveEffectiveStoreProductMix({ productMixTemplateId: "t-x", manualProductMix: ["p-9"] }, templates), ["p-9"]);
});

test("#602 modo da loja na tela", () => {
  assert.equal(getStoreProductMixMode({ productMixTemplateId: "t-rua", manualProductMix: null }), "modelo");
  assert.equal(getStoreProductMixMode({ productMixTemplateId: null, manualProductMix: ["p-1"] }), "manual");
  assert.equal(getStoreProductMixMode({ productMixTemplateId: null, manualProductMix: [] }), "todos");
  assert.equal(getStoreProductMixMode({}), "todos");
});

test("#602 lote: a loja vê só o seu mix, mas item com quantidade não some", () => {
  const items = [
    { id: "a", inStoreMix: true, qty: 0 },
    { id: "b", inStoreMix: false, qty: 0 },
    { id: "c", inStoreMix: false, qty: 3 },
  ];
  assert.deepEqual(
    selectStoreMixItems(items, (item) => item.qty > 0).map((item) => item.id),
    ["a", "c"],
  );
});

test("#602 duas lojas com mixes diferentes veem listas diferentes", () => {
  const catalog = ["p-1", "p-2", "p-3"];
  const rua = resolveEffectiveStoreProductMix({ productMixTemplateId: "t-rua" }, templates);
  const quiosque = resolveEffectiveStoreProductMix({ productMixTemplateId: "t-quiosque" }, templates);
  const see = (mix: string[] | null) => catalog.filter((id) => !mix || mix.includes(id));
  assert.deepEqual(see(rua), ["p-1", "p-2"]);
  assert.deepEqual(see(quiosque), ["p-3"]);
});

test("#602 modelos: linhas inválidas do banco são descartadas e a lista sai em ordem de nome", () => {
  const rows = [
    { id: "2", name: "Quiosque", product_ids: ["p-3"] },
    { id: "1", name: "Loja de rua", product_ids: ["p-1", "p-1", " "] },
    { id: "3", name: "Vazio", product_ids: [] },
    { id: 4, name: "Sem id", product_ids: ["p-1"] },
  ];
  assert.deepEqual(mapStoreProductMixTemplateRows(rows), [
    { id: "1", name: "Loja de rua", productIds: ["p-1"] },
    { id: "2", name: "Quiosque", productIds: ["p-3"] },
  ]);
});

test("#602 nome do modelo: espaços normalizados, 1 a 60 letras", () => {
  assert.equal(cleanStoreProductMixTemplateName("  Loja   de rua "), "Loja de rua");
  assert.equal(cleanStoreProductMixTemplateName("   "), null);
  assert.equal(cleanStoreProductMixTemplateName("x".repeat(61)), null);
  assert.equal(cleanStoreProductMixTemplateName(12), null);
});

test("#602 cadastro do produto: incluir/tirar de uma lista; nunca deixa a lista vazia", () => {
  assert.deepEqual(toggleProductInMixList(["p-1"], "p-2", true), ["p-1", "p-2"]);
  assert.deepEqual(toggleProductInMixList(["p-1", "p-2"], "p-2", true), ["p-1", "p-2"]);
  assert.deepEqual(toggleProductInMixList(["p-1", "p-2"], "p-1", false), ["p-2"]);
  assert.equal(toggleProductInMixList(["p-1"], "p-1", false), null);
});

test("#602 cadastro do produto: situação atual e só o que mudou vai ao servidor", () => {
  const stores = [
    { id: "s-1", name: "A", status: "ativo" as const, productMixTemplateId: "t-rua", manualProductMix: null },
    { id: "s-2", name: "B", status: "ativo" as const, productMixTemplateId: null, manualProductMix: ["p-1"] },
    { id: "s-3", name: "C", status: "ativo" as const, productMixTemplateId: null, manualProductMix: null },
  ];
  const initial = buildProductStoreMixToggles("p-1", templates, stores);
  assert.deepEqual(initial, { templates: { "t-rua": true, "t-quiosque": false }, stores: { "s-2": true } });
  const current = { templates: { ...initial.templates, "t-quiosque": true }, stores: { ...initial.stores } };
  const diff = diffProductStoreMixToggles(initial, current);
  assert.deepEqual(diff, { templates: { "t-quiosque": true }, stores: {} });
  assert.equal(hasProductStoreMixChanges(diff), true);
  assert.equal(hasProductStoreMixChanges(diffProductStoreMixToggles(initial, initial)), false);
  assert.deepEqual(buildProductStoreMixToggles(null, templates, stores), {
    templates: { "t-rua": false, "t-quiosque": false },
    stores: { "s-2": false },
  });
});
