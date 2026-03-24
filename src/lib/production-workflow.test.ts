import assert from "node:assert/strict";
import test from "node:test";

import {
  canTransitionProductionItemStatus,
  getNextProductionActionLabel,
  getNextProductionItemStatus,
  getPreviousProductionActionLabel,
  getPreviousProductionItemStatus,
  getProductionStatusProgress,
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
  assert.equal(getProductionStatusLabel("em_preparacao"), "Preparação");
  assert.equal(getNextProductionActionLabel("em_preparacao"), "Iniciar produção");
  assert.equal(getPreviousProductionActionLabel("em_producao"), "Voltar para preparação");
});

test("production workflow respects per-product custom stages", () => {
  const customStages = ["em_preparacao", "embalando"] as const;

  assert.equal(getNextProductionItemStatus("em_preparacao", customStages), "embalando");
  assert.equal(getPreviousProductionItemStatus("embalando", customStages), "em_preparacao");
  assert.equal(canTransitionProductionItemStatus("em_preparacao", "em_forno", customStages), false);
  assert.equal(getNextProductionActionLabel("em_preparacao", customStages), "Iniciar embalagem");
  assert.equal(getProductionStatusProgress("embalando", customStages), 66.7);
});
