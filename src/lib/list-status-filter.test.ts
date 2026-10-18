import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultListStatusFilter,
  isListStatusFilterCustom,
  matchesListStatus,
  parseSavedListStatusFilter,
  serializeListStatusFilter,
  toggleListStatus,
} from "@/lib/list-status-filter";

const finals = ["entregue", "cancelado"];
const valid = ["em_espera", "em_producao", "entregue", "cancelado"];

test("padrão esconde finalizados e mostra pendências", () => {
  assert.equal(matchesListStatus("em_producao", defaultListStatusFilter, finals), true);
  assert.equal(matchesListStatus("entregue", defaultListStatusFilter, finals), false);
  assert.equal(matchesListStatus("cancelado", defaultListStatusFilter, finals), false);
  assert.equal(isListStatusFilterCustom(defaultListStatusFilter), false);
});

test("Ver histórico mostra tudo", () => {
  const state = { selected: [], showHistory: true };
  assert.equal(matchesListStatus("entregue", state, finals), true);
  assert.equal(matchesListStatus("em_espera", state, finals), true);
  assert.equal(isListStatusFilterCustom(state), true);
});

test("multi-seleção mostra só os escolhidos, inclusive finalizado escolhido", () => {
  let state = toggleListStatus(defaultListStatusFilter, "em_espera");
  state = toggleListStatus(state, "entregue");
  assert.deepEqual(state.selected, ["em_espera", "entregue"]);
  assert.equal(matchesListStatus("em_espera", state, finals), true);
  assert.equal(matchesListStatus("entregue", state, finals), true);
  assert.equal(matchesListStatus("em_producao", state, finals), false);
  // desmarcar volta ao padrão
  state = toggleListStatus(toggleListStatus(state, "em_espera"), "entregue");
  assert.deepEqual(state, defaultListStatusFilter);
});

test("padrão salvo: round-trip, status inválido descartado, lixo volta ao padrão de fábrica", () => {
  const saved = serializeListStatusFilter({ selected: ["em_producao", "em_espera"], showHistory: false });
  assert.deepEqual(parseSavedListStatusFilter(saved, valid), { selected: ["em_producao", "em_espera"], showHistory: false });
  assert.deepEqual(
    parseSavedListStatusFilter('{"selected":["inexistente","entregue"],"showHistory":true}', valid),
    { selected: ["entregue"], showHistory: true },
  );
  assert.deepEqual(parseSavedListStatusFilter("{nao-json", valid), defaultListStatusFilter);
  assert.deepEqual(parseSavedListStatusFilter(null, valid), defaultListStatusFilter);
  assert.deepEqual(parseSavedListStatusFilter('{"selected":"x"}', valid), defaultListStatusFilter);
});
