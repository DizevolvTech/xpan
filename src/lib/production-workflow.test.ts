import assert from "node:assert/strict";
import test from "node:test";

import {
  canTransitionProductionItemStatus,
  getNextProductionItemStatus,
  getPreviousProductionItemStatus,
  getProductionStatusLabel,
} from "@/lib/production-workflow";

test("production workflow only allows adjacent transitions", () => {
  assert.equal(canTransitionProductionItemStatus("nao_iniciado", "em_preparacao"), true);
  assert.equal(canTransitionProductionItemStatus("em_preparacao", "nao_iniciado"), true);
  assert.equal(canTransitionProductionItemStatus("embalando", "concluido"), true);

  assert.equal(canTransitionProductionItemStatus("nao_iniciado", "em_producao"), false);
  assert.equal(canTransitionProductionItemStatus("concluido", "em_producao"), false);
});

test("production workflow exposes previous and next actions", () => {
  assert.equal(getNextProductionItemStatus("em_forno"), "embalando");
  assert.equal(getNextProductionItemStatus("concluido"), null);
  assert.equal(getPreviousProductionItemStatus("em_preparacao"), "nao_iniciado");
  assert.equal(getPreviousProductionItemStatus("nao_iniciado"), null);
  assert.equal(getProductionStatusLabel("em_producao"), "Em produção");
});
