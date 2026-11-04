import assert from "node:assert/strict";
import test from "node:test";

import {
  anticipateButtonLabel,
  buildAnticipationConfirmation,
  canAnticipateBatchRelease,
  checkBatchAnticipation,
} from "@/lib/batch-anticipation";

test("quadro #234: só administrador da empresa e master veem/usam antecipar", () => {
  assert.equal(canAnticipateBatchRelease("administrador"), true);
  assert.equal(canAnticipateBatchRelease("administrador-master"), true);
  for (const role of ["gestor-fabrica", "gestor-dados", "chao-fabrica", "loja", "", null, undefined]) {
    assert.equal(canAnticipateBatchRelease(role), false, String(role));
  }
});

test("quadro #234: servidor responde 403 para gestor-fabrica e libera administrador", () => {
  const refusal = checkBatchAnticipation("gestor-fabrica");
  assert.equal(refusal?.status, 403);
  assert.match(refusal?.message ?? "", /administrador/);
  assert.equal(checkBatchAnticipation("loja")?.status, 403);
  assert.equal(checkBatchAnticipation("administrador"), null);
  assert.equal(checkBatchAnticipation("administrador-master"), null);
});

test("quadro #234: texto do botão e da confirmação dizem quantas lojas faltam", () => {
  assert.equal(anticipateButtonLabel(3), "Antecipar liberação (3)");
  const one = buildAnticipationConfirmation({ deliveryLabel: "05/11", pendingOrders: 1, missingStoreNames: ["Loja Sul"] });
  assert.match(one.description, /1 loja ainda não pediu \(Loja Sul\)/);
  assert.match(one.description, /não poderá mais pedir para essa entrega/);
  const two = buildAnticipationConfirmation({ deliveryLabel: "05/11", pendingOrders: 2, missingStoreNames: ["A", "B"] });
  assert.match(two.description, /2 lojas ainda não pediram \(A, B\)/);
  assert.match(two.description, /não poderão mais pedir/);
});
