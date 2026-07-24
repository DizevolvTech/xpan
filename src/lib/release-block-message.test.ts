import assert from "node:assert/strict";
import test from "node:test";

import { buildReleaseBlockMessage } from "@/lib/release-block-message";

test("buildReleaseBlockMessage — pedido não liberável sugere reauditar o cronograma (AJ-0025)", () => {
  const message = buildReleaseBlockMessage(
    "order_not_releasable",
    "pedido tem item(ns) sem data de produção viável para a janela de hoje — verifique os dias de produção no cadastro do produto e o cronograma ativo da linha.",
  );

  assert.match(message, /reaudite|reauditar/i);
  assert.match(message, /cronograma/i);
});

test("buildReleaseBlockMessage — pedido fora do planejamento também orienta reauditoria", () => {
  const message = buildReleaseBlockMessage(
    "order_not_planned",
    "pedido não aparece no planejamento da fábrica para hoje.",
  );

  assert.match(message, /reaudite|reauditar/i);
});

test("buildReleaseBlockMessage — pedido cancelado NÃO sugere reauditar", () => {
  const message = buildReleaseBlockMessage(
    "order_cancelled",
    "pedido cancelado não pode ser liberado para produção.",
  );

  assert.doesNotMatch(message, /reaudite|reauditar/i);
  assert.match(message, /cancelado/i);
});

test("buildReleaseBlockMessage — preserva a mensagem do servidor", () => {
  const message = buildReleaseBlockMessage("order_not_releasable", "motivo específico do servidor");
  assert.match(message, /motivo específico do servidor/);
});
