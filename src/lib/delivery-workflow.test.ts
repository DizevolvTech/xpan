import assert from "node:assert/strict";
import test from "node:test";

import {
  canRegisterDeliveryFailure,
  canTransitionDeliveryStatus,
  getExpeditionVisibleStatus,
  getNextDeliveryAction,
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
