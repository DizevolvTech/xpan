import assert from "node:assert/strict";
import test from "node:test";

import type { ProductPreparationStageKey } from "@/lib/production-planning";
import {
  canTransitionProductionItemStatus,
  clampStatusToFlow,
  getNextProductionActionLabel,
  getNextProductionItemStatus,
  getPreviousProductionActionLabel,
  getPreviousProductionItemStatus,
  getProductionStatusProgress,
  getProductionStatusLabel,
  intermediatePreparationStages,
} from "@/lib/production-workflow";

test("intermediatePreparationStages — base NÃO vai a forno nem embalagem (só preparar+produzir)", () => {
  // Forno e embalagem pertencem ao PRODUTO FINAL; a base é preparada, misturada e consumida.
  assert.deepEqual(intermediatePreparationStages(undefined), ["em_preparacao", "em_producao"]);
  // Da produção, o próximo passo da BASE é concluir — nunca forno nem embalagem.
  const baseStages = intermediatePreparationStages(undefined);
  assert.equal(getNextProductionItemStatus("em_producao", baseStages), "concluido");
  assert.equal(getNextProductionActionLabel("em_producao", baseStages), "Marcar como concluído");
});

test("intermediatePreparationStages — respeita stages configuradas mas tira forno/embalagem", () => {
  assert.deepEqual(
    intermediatePreparationStages(["em_preparacao", "em_producao", "em_forno", "embalando"]),
    ["em_preparacao", "em_producao"],
  );
  // Fallback: se só sobrar forno/embalagem, cai para produção (algo tem que ser produzido).
  assert.deepEqual(intermediatePreparationStages(["em_forno", "embalando"]), ["em_producao"]);
});

test("clampStatusToFlow — status legado fora do fluxo vira o passo válido mais próximo", () => {
  const baseFlow = ["nao_iniciado", "em_preparacao", "em_producao", "concluido"] as const;
  // Base já produzida sob o fluxo antigo (em_forno/embalando) → grampeia p/ em_producao.
  assert.equal(clampStatusToFlow("em_forno", [...baseFlow]), "em_producao");
  assert.equal(clampStatusToFlow("embalando", [...baseFlow]), "em_producao");
  // Status já no fluxo é no-op (não afeta itens normais).
  assert.equal(clampStatusToFlow("em_preparacao", [...baseFlow]), "em_preparacao");
});

test("base legada em em_forno continua operável (progresso + concluir) via clamp", () => {
  const baseStages = intermediatePreparationStages(undefined); // [prep, prod]
  // Sem quebrar: progresso e próxima ação computados sobre o passo grampeado (em_producao).
  assert.equal(getProductionStatusProgress("em_forno", baseStages), getProductionStatusProgress("em_producao", baseStages));
  assert.equal(getNextProductionItemStatus("em_forno", baseStages), "concluido");
  // E a transição em_forno → concluido é aceita (senão a base ficava travada).
  assert.equal(canTransitionProductionItemStatus("em_forno", "concluido", baseStages), true);
});

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
  const customStages: ProductPreparationStageKey[] = ["em_preparacao", "embalando"];

  assert.equal(getNextProductionItemStatus("em_preparacao", customStages), "embalando");
  assert.equal(getPreviousProductionItemStatus("embalando", customStages), "em_preparacao");
  assert.equal(canTransitionProductionItemStatus("em_preparacao", "em_forno", customStages), false);
  assert.equal(getNextProductionActionLabel("em_preparacao", customStages), "Iniciar embalagem");
  assert.equal(getProductionStatusProgress("embalando", customStages), 66.7);
});
