import assert from "node:assert/strict";
import test from "node:test";

import { seedOrderBatchesOverview, takeSeededOrderBatchesOverview } from "./order-batches-overview-seed";

const overview = { groups: [] } as unknown as Parameters<typeof seedOrderBatchesOverview>[0];

test("visão de lotes semeada vale uma vez só (recarregar depois busca no servidor)", () => {
  seedOrderBatchesOverview(overview);
  assert.equal(takeSeededOrderBatchesOverview(), overview);
  assert.equal(takeSeededOrderBatchesOverview(), null);
});

test("visão de lotes semeada vencida não é usada", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  seedOrderBatchesOverview(overview);
  t.mock.timers.tick(10_001);
  assert.equal(takeSeededOrderBatchesOverview(), null);
});
