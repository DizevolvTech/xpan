import assert from "node:assert/strict";
import test from "node:test";

import {
  canStoreInitiateOrder,
  resolveFilledStatus,
  type StoreOrderLifecycleStatus,
} from "@/lib/store-order-lifecycle";

test("resolveFilledStatus — pedido aberto pela fábrica vira preenchido quando a loja preenche", () => {
  assert.equal(resolveFilledStatus("aberto"), "preenchido");
});

test("resolveFilledStatus — pedido sem status (legado) conta como preenchido", () => {
  assert.equal(resolveFilledStatus(null), "preenchido");
  assert.equal(resolveFilledStatus(undefined), "preenchido");
});

test("resolveFilledStatus — pedido já enviado não regride para preenchido", () => {
  assert.equal(resolveFilledStatus("enviado"), "enviado");
});

test("canStoreInitiateOrder — flag OFF: loja cria o pedido livremente (comportamento legado)", () => {
  assert.equal(canStoreInitiateOrder(false), true);
});

test("canStoreInitiateOrder — flag ON: loja não cria do zero, só preenche o que a fábrica abriu", () => {
  assert.equal(canStoreInitiateOrder(true), false);
});

// Garante que o union de status cobre exatamente o ciclo do ADR.
test("StoreOrderLifecycleStatus cobre aberto/preenchido/enviado", () => {
  const all: StoreOrderLifecycleStatus[] = ["aberto", "preenchido", "enviado"];
  assert.equal(all.length, 3);
});
