import assert from "node:assert/strict";
import test from "node:test";

import {
  applySavedListFilter,
  isValidListFilterPageKey,
  readSavedListFilters,
  sanitizeListFilterValue,
} from "./saved-list-filters";

test("aceita só chave de página no formato esperado", () => {
  assert.equal(isValidListFilterPageKey("gestor-fabrica-pedidos"), true);
  assert.equal(isValidListFilterPageKey("../x"), false);
  assert.equal(isValidListFilterPageKey(""), false);
  assert.equal(isValidListFilterPageKey(42), false);
});

test("valor salvo: vários status e histórico; lixo vira null", () => {
  assert.deepEqual(sanitizeListFilterValue({ selected: ["em_espera", "agendado"], showHistory: false }), {
    selected: ["em_espera", "agendado"],
    showHistory: false,
  });
  assert.deepEqual(sanitizeListFilterValue({ selected: [], showHistory: true }), { selected: [], showHistory: true });
  assert.equal(sanitizeListFilterValue({ selected: ["<script>"] }), null);
  assert.equal(sanitizeListFilterValue({ selected: "em_espera" }), null);
  assert.equal(sanitizeListFilterValue(null), null);
});

test("lê o metadata ignorando entradas inválidas", () => {
  const saved = readSavedListFilters({
    list_filters: { "gestor-fabrica-pedidos": { selected: ["entregue"], showHistory: false }, "x y": {}, ok: 3 },
    other: 1,
  });
  assert.deepEqual(saved, { "gestor-fabrica-pedidos": { selected: ["entregue"], showHistory: false } });
  assert.deepEqual(readSavedListFilters(undefined), {});
});

test("salvar e remover o padrão de uma página não mexe nas outras", () => {
  const start = { a: { selected: ["x"], showHistory: false } };
  const saved = applySavedListFilter(start, "b", { selected: [], showHistory: true });
  assert.deepEqual(Object.keys(saved).sort(), ["a", "b"]);
  const removed = applySavedListFilter(saved, "a", null);
  assert.deepEqual(Object.keys(removed), ["b"]);
  assert.deepEqual(start, { a: { selected: ["x"], showHistory: false } });
});
