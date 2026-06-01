import assert from "node:assert/strict";
import test from "node:test";

import {
  areAllChecklistItemsChecked,
  canRegisterDeliveryFailure,
  canTransitionDeliveryStatus,
  getExpeditionVisibleStatus,
  isOrderReadyForDeliveryExecution,
  getNextDeliveryAction,
  resolveEffectiveDeliveryExecutionStatus,
} from "@/lib/delivery-workflow";

test("delivery workflow only allows valid transitions", () => {
  assert.equal(canTransitionDeliveryStatus("aguardando_expedicao", "pronto_coleta"), true);
  assert.equal(canTransitionDeliveryStatus("pronto_coleta", "em_rota"), true);
  assert.equal(canTransitionDeliveryStatus("em_rota", "no_destino"), true);
  assert.equal(canTransitionDeliveryStatus("no_destino", "entregue"), true);
  assert.equal(canTransitionDeliveryStatus("tentativa_falha", "em_rota"), true);

  assert.equal(canTransitionDeliveryStatus("aguardando_expedicao", "em_rota"), false);
  assert.equal(canTransitionDeliveryStatus("pronto_coleta", "entregue"), false);
  assert.equal(canTransitionDeliveryStatus("entregue", "em_rota"), false);
});

test("delivery actions expose the next valid step", () => {
  assert.deepEqual(getNextDeliveryAction("pronto_coleta"), {
    label: "Iniciar rota",
    nextStatus: "em_rota",
  });
  assert.deepEqual(getNextDeliveryAction("no_destino"), {
    label: "Confirmar entrega",
    nextStatus: "entregue",
  });
  assert.equal(getNextDeliveryAction("entregue"), null);
  assert.equal(canRegisterDeliveryFailure("em_rota"), true);
  assert.equal(canRegisterDeliveryFailure("pronto_coleta"), false);
});

test("delivery failure can be registered again from tentativa_falha (re-attempt in one click)", () => {
  assert.equal(canRegisterDeliveryFailure("em_rota"), true);
  assert.equal(canRegisterDeliveryFailure("no_destino"), true);
  assert.equal(canRegisterDeliveryFailure("tentativa_falha"), true);

  assert.equal(canRegisterDeliveryFailure("aguardando_expedicao"), false);
  assert.equal(canRegisterDeliveryFailure("pronto_coleta"), false);
  assert.equal(canRegisterDeliveryFailure("entregue"), false);
});

test("an advanced delivery execution is the source of truth and is not reset by recomputed production status", () => {
  // Produção foi recomputada/resetada (orderStatus volta para agendado),
  // mas a entrega já está em rota — NÃO pode ser arrastada de volta.
  assert.equal(resolveEffectiveDeliveryExecutionStatus("agendado", "em_rota"), "em_rota");
  assert.equal(resolveEffectiveDeliveryExecutionStatus("em_producao", "entregue"), "entregue");
  assert.equal(resolveEffectiveDeliveryExecutionStatus("agendado", "no_destino"), "no_destino");
  assert.equal(resolveEffectiveDeliveryExecutionStatus("agendado", "tentativa_falha"), "tentativa_falha");

  // Sem execução avançada, o gate de prontidão da produção ainda vale.
  assert.equal(resolveEffectiveDeliveryExecutionStatus("agendado", null), "aguardando_expedicao");
  assert.equal(resolveEffectiveDeliveryExecutionStatus("agendado", "aguardando_expedicao"), "aguardando_expedicao");
  assert.equal(resolveEffectiveDeliveryExecutionStatus("aguardando_expedicao", null), "aguardando_expedicao");
  assert.equal(resolveEffectiveDeliveryExecutionStatus("aguardando_expedicao", "pronto_coleta"), "pronto_coleta");
});

test("expedition visible status prioritizes the delivery execution stage when it advances", () => {
  assert.equal(getExpeditionVisibleStatus("aguardando_expedicao", "pronto_coleta"), "pronto_coleta");
  assert.equal(getExpeditionVisibleStatus("aguardando_expedicao", "em_rota"), "em_rota");
  assert.equal(getExpeditionVisibleStatus("em_producao", "aguardando_expedicao"), "em_producao");
});

test("delivery execution is clamped only while there is no advanced execution yet", () => {
  assert.equal(isOrderReadyForDeliveryExecution("aguardando_expedicao"), true);
  assert.equal(isOrderReadyForDeliveryExecution("em_producao"), false);
  // Sem execução avançada (null), a produção ainda não pronta mantém aguardando_expedicao.
  assert.equal(resolveEffectiveDeliveryExecutionStatus("em_producao", null), "aguardando_expedicao");
  assert.equal(getExpeditionVisibleStatus("em_producao", null), "em_producao");
  // Comportamento corrigido: uma execução já avançada (entregue) é a fonte da verdade
  // e NÃO é arrastada de volta pelo orderStatus derivado da produção.
  assert.equal(resolveEffectiveDeliveryExecutionStatus("em_producao", "entregue"), "entregue");
  assert.equal(getExpeditionVisibleStatus("em_producao", "entregue"), "entregue");
});

test("checklist completeness requires every aggregated expedition item", () => {
  assert.equal(areAllChecklistItemsChecked(["a", "b"], { a: true }), false);
  assert.equal(areAllChecklistItemsChecked(["a", "b"], { a: true, b: true }), true);
  assert.equal(areAllChecklistItemsChecked([], { a: true }), false);
});
