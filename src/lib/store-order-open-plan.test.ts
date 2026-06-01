import assert from "node:assert/strict";
import test from "node:test";

import { planStoreOrdersToOpen } from "@/lib/store-order-open-plan";

test("planStoreOrdersToOpen — abre só as lojas que ainda não têm pedido ativo na data", () => {
  const plan = planStoreOrdersToOpen({
    requestedStoreIds: ["loja-a", "loja-b", "loja-c"],
    storeIdsWithActiveOrder: ["loja-b"],
  });

  assert.deepEqual(plan.toOpen, ["loja-a", "loja-c"]);
  assert.deepEqual(plan.skipped, ["loja-b"]);
});

test("planStoreOrdersToOpen — deduplica lojas repetidas no pedido", () => {
  const plan = planStoreOrdersToOpen({
    requestedStoreIds: ["loja-a", "loja-a", "loja-b"],
    storeIdsWithActiveOrder: [],
  });

  assert.deepEqual(plan.toOpen, ["loja-a", "loja-b"]);
  assert.deepEqual(plan.skipped, []);
});

test("planStoreOrdersToOpen — todas já têm pedido ativo: nada a abrir", () => {
  const plan = planStoreOrdersToOpen({
    requestedStoreIds: ["loja-a", "loja-b"],
    storeIdsWithActiveOrder: ["loja-a", "loja-b"],
  });

  assert.deepEqual(plan.toOpen, []);
  assert.deepEqual(plan.skipped, ["loja-a", "loja-b"]);
});

test("planStoreOrdersToOpen — lista vazia retorna plano vazio", () => {
  const plan = planStoreOrdersToOpen({ requestedStoreIds: [], storeIdsWithActiveOrder: [] });
  assert.deepEqual(plan.toOpen, []);
  assert.deepEqual(plan.skipped, []);
});
