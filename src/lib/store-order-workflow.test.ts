import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStoreOrderCapabilities,
  canCancelStoreOrder,
  canEditStoreOrder,
  canOpenOccurrenceForOrderExecution,
  resolveStoreVisibleOrderStatus,
} from "@/lib/store-order-workflow";

test("store visible order status follows delivery execution when delivery has advanced", () => {
  assert.equal(resolveStoreVisibleOrderStatus("agendado", "aguardando_expedicao"), "agendado");
  assert.equal(resolveStoreVisibleOrderStatus("aguardando_expedicao", "pronto_coleta"), "pronto_coleta");
  assert.equal(resolveStoreVisibleOrderStatus("aguardando_expedicao", "em_rota"), "em_rota");
  assert.equal(resolveStoreVisibleOrderStatus("aguardando_expedicao", "entregue"), "entregue");
  assert.equal(resolveStoreVisibleOrderStatus("em_producao", "entregue"), "em_producao");
});

test("store order can only be edited or cancelled before release and while active", () => {
  assert.equal(canEditStoreOrder("ativo", false), true);
  assert.equal(canCancelStoreOrder("ativo", false), true);

  assert.equal(canEditStoreOrder("ativo", true), false);
  assert.equal(canCancelStoreOrder("ativo", true), false);

  assert.equal(canEditStoreOrder("cancelado", false), false);
  assert.equal(canCancelStoreOrder("cancelado", false), false);
});

test("store occurrence action only opens for delivery-eligible execution statuses", () => {
  assert.equal(canOpenOccurrenceForOrderExecution("aguardando_expedicao", "aguardando_expedicao"), false);
  assert.equal(canOpenOccurrenceForOrderExecution("aguardando_expedicao", "pronto_coleta"), false);
  assert.equal(canOpenOccurrenceForOrderExecution("aguardando_expedicao", "em_rota"), true);
  assert.equal(canOpenOccurrenceForOrderExecution("aguardando_expedicao", "no_destino"), true);
  assert.equal(canOpenOccurrenceForOrderExecution("aguardando_expedicao", "entregue"), true);
  assert.equal(canOpenOccurrenceForOrderExecution("aguardando_expedicao", "tentativa_falha"), false);
  assert.equal(canOpenOccurrenceForOrderExecution("em_producao", "entregue"), false);
});

test("store order capabilities stay internally consistent", () => {
  assert.deepEqual(
    buildStoreOrderCapabilities({
      orderStatus: "agendado",
      managementStatus: "ativo",
      isReleasedToProduction: false,
      executionStatus: "aguardando_expedicao",
    }),
    {
      canEdit: true,
      canCancel: true,
      canOpenOccurrence: false,
    },
  );

  assert.deepEqual(
    buildStoreOrderCapabilities({
      orderStatus: "aguardando_expedicao",
      managementStatus: "ativo",
      isReleasedToProduction: true,
      executionStatus: "em_rota",
    }),
    {
      canEdit: false,
      canCancel: false,
      canOpenOccurrence: true,
    },
  );
});
