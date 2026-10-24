import assert from "node:assert/strict";
import test from "node:test";

import {
  DELIVERY_FINAL_STATUSES,
  DELIVERY_VALID_STATUSES,
  EXPEDITION_FINAL_STATUSES,
  EXPEDITION_VALID_STATUSES,
  isInFieldDeliveryStatus,
} from "./expedition-status-filter";
import { defaultListStatusFilter, matchesListStatus } from "./list-status-filter";

test("Expedição: por padrão entregue e cancelado ficam fora; o resto aparece", () => {
  for (const status of EXPEDITION_VALID_STATUSES) {
    const expected = status !== "entregue" && status !== "cancelado";
    assert.equal(matchesListStatus(status, defaultListStatusFilter, EXPEDITION_FINAL_STATUSES), expected, status);
  }
});

test("Expedição: Ver histórico mostra os entregues; status escolhido mostra só ele", () => {
  assert.equal(matchesListStatus("entregue", { selected: [], showHistory: true }, EXPEDITION_FINAL_STATUSES), true);
  const picked = { selected: ["em_producao", "aguardando_expedicao"], showHistory: false };
  assert.equal(matchesListStatus("em_producao", picked, EXPEDITION_FINAL_STATUSES), true);
  assert.equal(matchesListStatus("aguardando_expedicao", picked, EXPEDITION_FINAL_STATUSES), true);
  assert.equal(matchesListStatus("em_rota", picked, EXPEDITION_FINAL_STATUSES), false);
});

test("Entregas: entregue fora por padrão", () => {
  assert.ok(DELIVERY_VALID_STATUSES.includes("entregue"));
  assert.equal(matchesListStatus("entregue", defaultListStatusFilter, DELIVERY_FINAL_STATUSES), false);
  assert.equal(matchesListStatus("em_rota", defaultListStatusFilter, DELIVERY_FINAL_STATUSES), true);
});

test("Visão Geral, coluna Em rota: só o que ainda está na rua", () => {
  for (const status of ["pronto_coleta", "em_rota", "no_destino", "tentativa_falha"]) {
    assert.equal(isInFieldDeliveryStatus(status), true, status);
  }
  for (const status of ["entregue", "aguardando_expedicao", "cancelado"]) {
    assert.equal(isInFieldDeliveryStatus(status), false, status);
  }
});
