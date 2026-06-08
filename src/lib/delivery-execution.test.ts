import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveDeliveryExecutionEntry,
  type DeliveryExecutionEntry,
} from "@/lib/delivery-execution";

function makePersisted(
  status: DeliveryExecutionEntry["status"],
  overrides: Partial<DeliveryExecutionEntry> = {},
): DeliveryExecutionEntry {
  return {
    status,
    checklistState: {},
    checklistCompletedAt: null,
    updatedAt: "2026-06-03T12:00:00.000Z",
    attemptsCount: 0,
    lastAttempt: null,
    pendingReleaseReason: null,
    pendingReleasedAt: null,
    ...overrides,
  };
}

test("resolveDeliveryExecutionEntry returns persisted execution when expedition is ready", () => {
  const persisted = makePersisted("pronto_coleta");
  assert.equal(resolveDeliveryExecutionEntry(persisted, true), persisted);
});

test("advanced persisted status survives expeditionReady=false (não esconde 'entregue')", () => {
  // Regressão: um pedido JÁ ENTREGUE não pode reaparecer como
  // 'aguardando_expedicao' quando a produção recomputa expeditionReady=false.
  const persisted = makePersisted("entregue");
  const resolved = resolveDeliveryExecutionEntry(persisted, false);
  assert.equal(resolved, persisted);
  assert.equal(resolved.status, "entregue");
});

test("em_rota e no_destino também sobrevivem a expeditionReady=false", () => {
  for (const status of ["em_rota", "no_destino", "tentativa_falha"] as const) {
    const persisted = makePersisted(status);
    assert.equal(
      resolveDeliveryExecutionEntry(persisted, false).status,
      status,
    );
  }
});

test("aguardando_expedicao persistido com expeditionReady=false cai no sintético", () => {
  const persisted = makePersisted("aguardando_expedicao");
  const resolved = resolveDeliveryExecutionEntry(persisted, false);
  assert.equal(resolved.status, "aguardando_expedicao");
  // Sintético: não é a mesma referência persistida.
  assert.notEqual(resolved, persisted);
});

test("sem execução persistida: expeditionReady decide o status sintético", () => {
  assert.equal(resolveDeliveryExecutionEntry(undefined, false).status, "aguardando_expedicao");
  assert.equal(resolveDeliveryExecutionEntry(undefined, true).status, "aguardando_expedicao");
});
