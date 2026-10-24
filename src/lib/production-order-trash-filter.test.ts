import assert from "node:assert/strict";
import test from "node:test";

import { filterTrashedProductionOrders, productionOrderPlanningKey } from "./production-order-trash-filter";

const op = (lineId: string, orderCodes: string[]) => ({
  productionDate: "2026-10-27",
  sectorId: "s1",
  lineId,
  scheduleId: null,
  orderCodes,
});

test("OP na lixeira some; outras ficam; pedido novo na mesma linha/dia faz voltar", () => {
  const a = op("l1", ["PD-1", "PD-2"]);
  const b = op("l2", ["PD-1"]);
  const trashed = [{ planningKey: productionOrderPlanningKey(a), orderCodes: ["PD-1", "PD-2"] }];
  assert.deepEqual(filterTrashedProductionOrders([a, b], trashed), [b]);
  assert.equal(productionOrderPlanningKey(a), "2026-10-27|s1|l1|sem-linha");
  const withNewOrder = op("l1", ["PD-1", "PD-2", "PD-3"]);
  assert.deepEqual(filterTrashedProductionOrders([withNewOrder], trashed), [withNewOrder]);
  assert.deepEqual(filterTrashedProductionOrders([a], []), [a]);
});
