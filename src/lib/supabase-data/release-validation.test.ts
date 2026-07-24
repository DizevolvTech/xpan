import assert from "node:assert/strict";
import test from "node:test";

import {
  OrderReleaseValidationError,
  assertPlanningAllowsRelease,
  type OrderRowForValidation,
  type PlanningSnapshotForValidation,
} from "@/lib/supabase-data/release-validation";

const baseOrderRow: OrderRowForValidation = {
  id: "uuid-1",
  legacy_id: "PED-001",
  management_status: "ativo",
};

const planningWithReleasable: PlanningSnapshotForValidation = {
  orders: [{ id: "PED-001", availableForRelease: true }],
};

const planningWithBlocked: PlanningSnapshotForValidation = {
  orders: [{ id: "PED-001", availableForRelease: false }],
};

const emptyPlanning: PlanningSnapshotForValidation = { orders: [] };

test("assertPlanningAllowsRelease — pedido cancelado é sempre bloqueado", () => {
  const result = assertPlanningAllowsRelease(
    { ...baseOrderRow, management_status: "cancelado" },
    planningWithReleasable,
    "PED-001",
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.error instanceof OrderReleaseValidationError);
    assert.equal(result.error.reason, "order_cancelled");
    assert.match(result.error.message, /Invalid release/);
    assert.match(result.error.message, /cancelado/);
  }
});

test("assertPlanningAllowsRelease — pedido fora do planejamento bloqueia (order_not_planned)", () => {
  const result = assertPlanningAllowsRelease(baseOrderRow, emptyPlanning, "PED-001");

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.reason, "order_not_planned");
    assert.match(result.error.message, /planejamento/);
  }
});

test("assertPlanningAllowsRelease — pedido sem availableForRelease bloqueia (order_not_releasable)", () => {
  const result = assertPlanningAllowsRelease(baseOrderRow, planningWithBlocked, "PED-001");

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.reason, "order_not_releasable");
    assert.match(result.error.message, /data de produção|cronograma/i);
  }
});

test("assertPlanningAllowsRelease — pedido VAZIO (0 itens) é rejeitado (order_empty)", () => {
  const planningEmptyOrder: PlanningSnapshotForValidation = {
    // Pedido presente no planejamento, mas sem itens. `availableForRelease` já é
    // false no motor para pedido vazio; aqui validamos a rejeição EXPLÍCITA.
    orders: [{ id: "PED-001", availableForRelease: false, itemsCount: 0 }],
  };

  const result = assertPlanningAllowsRelease(baseOrderRow, planningEmptyOrder, "PED-001");

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.reason, "order_empty");
    assert.match(result.error.message, /sem itens/);
    assert.match(result.error.message, /Invalid release/);
  }
});

test("assertPlanningAllowsRelease — happy path: pedido planejado + releasable retorna ok", () => {
  const result = assertPlanningAllowsRelease(baseOrderRow, planningWithReleasable, "PED-001");

  assert.equal(result.ok, true);
});

test("assertPlanningAllowsRelease — lookup por legacy_id quando o input é uuid", () => {
  const result = assertPlanningAllowsRelease(
    baseOrderRow,
    planningWithReleasable,
    "uuid-1", // input é uuid; engine indexa por legacy_id
  );

  assert.equal(result.ok, true);
});

test("assertPlanningAllowsRelease — lookup por uuid quando legacy_id está vazio", () => {
  const orderRow: OrderRowForValidation = {
    id: "uuid-only",
    legacy_id: null,
    management_status: "ativo",
  };
  const planning: PlanningSnapshotForValidation = {
    orders: [{ id: "uuid-only", availableForRelease: true }],
  };

  const result = assertPlanningAllowsRelease(orderRow, planning, "uuid-only");

  assert.equal(result.ok, true);
});

test("OrderReleaseValidationError — message contém 'Invalid' para virar 400 no route", () => {
  const error = new OrderReleaseValidationError("order_not_releasable", "teste");
  assert.match(error.message.toLowerCase(), /invalid/);
});
