import assert from "node:assert/strict";
import test from "node:test";

import {
  FutureWorkflowDateError,
  assertDeliveryNotInFuture,
  assertProductionNotInFuture,
  canOverrideFutureWorkflowDate,
  getOperationalTodayKey,
  getProductionDateFromKey,
} from "@/lib/workflow-date-guard";

const TODAY = "2026-06-02";

test("getProductionDateFromKey extrai a data (1ª parte) da chave de produção", () => {
  assert.equal(
    getProductionDateFromKey("2026-06-03|line-confeitaria|product-pudim-grande"),
    "2026-06-03",
  );
  // chave legada de 4 partes (com scheduleId) — data ainda é a 1ª parte
  assert.equal(getProductionDateFromKey("2026-04-01|line-x|schedule-y|product-z"), "2026-04-01");
  // formato inesperado → null (a trava nunca trava por não entender a chave)
  assert.equal(getProductionDateFromKey("sem-data|line|produto"), null);
});

test("assertProductionNotInFuture BLOQUEIA produção concluída em data futura", () => {
  assert.throws(
    () => assertProductionNotInFuture("2026-06-03|line-confeitaria|product-pudim-grande", TODAY),
    FutureWorkflowDateError,
  );
});

test("assertProductionNotInFuture PERMITE hoje e datas passadas", () => {
  assert.doesNotThrow(() => assertProductionNotInFuture("2026-06-02|line-a|product-b", TODAY));
  assert.doesNotThrow(() => assertProductionNotInFuture("2026-05-01|line-a|product-b", TODAY));
});

test("assertProductionNotInFuture: chave sem data válida não bloqueia", () => {
  assert.doesNotThrow(() => assertProductionNotInFuture("chave-estranha", TODAY));
});

test("assertDeliveryNotInFuture BLOQUEIA entregue em data de entrega futura", () => {
  assert.throws(() => assertDeliveryNotInFuture("2026-06-04", TODAY), FutureWorkflowDateError);
});

test("assertDeliveryNotInFuture PERMITE hoje, passado e data ausente", () => {
  assert.doesNotThrow(() => assertDeliveryNotInFuture("2026-06-02", TODAY));
  assert.doesNotThrow(() => assertDeliveryNotInFuture("2026-05-30", TODAY));
  assert.doesNotThrow(() => assertDeliveryNotInFuture(null, TODAY));
  assert.doesNotThrow(() => assertDeliveryNotInFuture(undefined, TODAY));
});

test("FutureWorkflowDateError carrega reason e mensagem amigável (DD/MM/AAAA)", () => {
  try {
    assertProductionNotInFuture("2999-01-01|line|product", TODAY);
    assert.fail("deveria ter lançado FutureWorkflowDateError");
  } catch (error) {
    assert.ok(error instanceof FutureWorkflowDateError);
    assert.equal(error.reason, "production_in_future");
    assert.match(error.message, /01\/01\/2999/);
  }
});

test("getOperationalTodayKey retorna uma data YYYY-MM-DD", () => {
  assert.match(getOperationalTodayKey(), /^\d{4}-\d{2}-\d{2}$/);
});

test("canOverrideFutureWorkflowDate: só gestor de fábrica e administrador forçam", () => {
  assert.equal(canOverrideFutureWorkflowDate("administrador"), true);
  assert.equal(canOverrideFutureWorkflowDate("gestor-fabrica"), true);
  assert.equal(canOverrideFutureWorkflowDate("chao-fabrica"), false);
  assert.equal(canOverrideFutureWorkflowDate("loja"), false);
  assert.equal(canOverrideFutureWorkflowDate(null), false);
  assert.equal(canOverrideFutureWorkflowDate(undefined), false);
});
