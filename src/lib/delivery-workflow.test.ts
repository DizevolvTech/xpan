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

test("expedition visible status prioritizes the delivery execution stage when it advances", () => {
  assert.equal(getExpeditionVisibleStatus("aguardando_expedicao", "pronto_coleta"), "pronto_coleta");
  assert.equal(getExpeditionVisibleStatus("aguardando_expedicao", "em_rota"), "em_rota");
  assert.equal(getExpeditionVisibleStatus("em_producao", "aguardando_expedicao"), "em_producao");
});

test("delivery execution is clamped while the order is not ready for expedition", () => {
  assert.equal(isOrderReadyForDeliveryExecution("aguardando_expedicao"), true);
  assert.equal(isOrderReadyForDeliveryExecution("em_producao"), false);
  assert.equal(resolveEffectiveDeliveryExecutionStatus("em_producao", "entregue"), "aguardando_expedicao");
  assert.equal(getExpeditionVisibleStatus("em_producao", "entregue"), "em_producao");
});

test("checklist completeness requires every aggregated expedition item", () => {
  assert.equal(areAllChecklistItemsChecked(["a", "b"], { a: true }), false);
  assert.equal(areAllChecklistItemsChecked(["a", "b"], { a: true, b: true }), true);
  assert.equal(areAllChecklistItemsChecked([], { a: true }), false);
});
