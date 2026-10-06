import assert from "node:assert/strict";
import test from "node:test";

import {
  applyProductVersionSnapshot,
  buildProductVersionSnapshot,
  buildRestoreChangeDescription,
  findMissingRecipeSources,
  isProductVersionSnapshot,
} from "@/lib/product-version-snapshot";

const product = {
  id: "product-1",
  code: "PR-58451",
  externalCode: "703936",
  gtin: "7891234567895",
  displayCode: "703936",
  active: true,
  availableForOrdering: true,
  createdAt: "2026-01-01",
  updatedAt: "2026-02-02",
  changeDescription: "motivo",
  name: "Panetone",
  validityDays: 5,
  recipe: [{ id: "r1", sourceType: "ingrediente", sourceId: "ing-1", label: "IN-1 · Farinha", quantity: 5, unit: "Kg" }],
  labTest: { bakedKg: 74.375, leftoverBakedKg: 0.136, unitCount: 175 },
  nested: undefined,
};

test("a foto guarda o cadastro de processo e deixa de fora identidade, código e liga/desliga", () => {
  const snapshot = buildProductVersionSnapshot(product);
  assert.equal(snapshot.name, "Panetone");
  assert.deepEqual(snapshot.labTest, product.labTest);
  assert.equal((snapshot.recipe as unknown[]).length, 1);
  for (const key of ["id", "code", "externalCode", "gtin", "displayCode", "active", "availableForOrdering", "createdAt", "updatedAt", "changeDescription", "nested"]) {
    assert.equal(key in snapshot, false, key);
  }
});

test("a foto é uma cópia: mexer no produto depois não muda a versão guardada", () => {
  const snapshot = buildProductVersionSnapshot(product);
  (product.recipe[0] as { quantity: number }).quantity = 999;
  assert.equal(((snapshot.recipe as Array<{ quantity: number }>)[0]).quantity, 5);
  (product.recipe[0] as { quantity: number }).quantity = 5;
});

test("restaurar aplica a versão no formulário SEM trocar código, GTIN nem o ativo de agora", () => {
  const snapshot = buildProductVersionSnapshot({ ...product, name: "Panetone antigo", validityDays: 3 });
  const current = { ...product, code: "PR-58451", externalCode: "NOVO-1", gtin: "999", active: false, name: "Panetone atual", validityDays: 9 };
  const restored = applyProductVersionSnapshot(current, snapshot);

  assert.equal(restored.name, "Panetone antigo");
  assert.equal(restored.validityDays, 3);
  assert.equal(restored.externalCode, "NOVO-1", "código do cliente de agora é mantido");
  assert.equal(restored.gtin, "999");
  assert.equal(restored.active, false, "ativo/pausado de agora é mantido");
  assert.equal(restored.id, "product-1");
});

test("restaurar não altera a foto guardada (nada vaza por referência)", () => {
  const snapshot = buildProductVersionSnapshot(product);
  const restored = applyProductVersionSnapshot({ ...product }, snapshot);
  (restored.recipe as Array<{ quantity: number }>)[0].quantity = 1;
  assert.equal(((snapshot.recipe as Array<{ quantity: number }>)[0]).quantity, 5);
});

test("isProductVersionSnapshot só aceita objeto preenchido", () => {
  assert.equal(isProductVersionSnapshot({ name: "x" }), true);
  for (const bad of [null, undefined, {}, [], "x", 3]) assert.equal(isProductVersionSnapshot(bad), false);
});

test("receita com item que não existe mais é detectada antes de restaurar", () => {
  const snapshot = buildProductVersionSnapshot({
    recipe: [
      { sourceType: "ingrediente", sourceId: "ing-ok", label: "IN-1 · Farinha" },
      { sourceType: "ingrediente", sourceId: "ing-sumiu", label: "IN-2 · Açúcar" },
      { sourceType: "produto", sourceId: "prod-sumiu", label: "PR-9 · Massa" },
      { sourceType: "produto", sourceId: "prod-ok", label: "PR-8 · Recheio" },
    ],
  });
  const missing = findMissingRecipeSources(snapshot, {
    ingredientIds: new Set(["ing-ok"]),
    productIds: new Set(["prod-ok"]),
  });
  assert.deepEqual(missing, ["IN-2 · Açúcar", "PR-9 · Massa"]);
  assert.deepEqual(findMissingRecipeSources({ name: "sem receita" }, { ingredientIds: new Set(), productIds: new Set() }), []);
});

test("o motivo da versão restaurada já vem preenchido", () => {
  assert.equal(buildRestoreChangeDescription(3), "Restaurada a versão 3. ");
});
