import assert from "node:assert/strict";
import test from "node:test";

import {
  getCachedServerData,
  invalidateDeliveryExecutionCaches,
  invalidateMasterDataCaches,
  invalidatePlanningCaches,
  invalidateServerDataCache,
} from "@/lib/server-data-cache";

test.afterEach(() => {
  invalidateServerDataCache("");
});

test("master data invalidation clears only the targeted tenant cache entries", async () => {
  let tenantAMasterLoads = 0;
  let tenantAPlanningLoads = 0;
  let tenantBMasterLoads = 0;
  let tenantBDeliveryLoads = 0;

  await getCachedServerData("tenant:tenant-a:master-data:snapshot", 60_000, async () => {
    tenantAMasterLoads += 1;
    return { value: "tenant-a-master" };
  });
  await getCachedServerData("tenant:tenant-a:planning:2026-03-22", 60_000, async () => {
    tenantAPlanningLoads += 1;
    return { value: "tenant-a-planning" };
  });
  await getCachedServerData("tenant:tenant-b:master-data:snapshot", 60_000, async () => {
    tenantBMasterLoads += 1;
    return { value: "tenant-b-master" };
  });
  await getCachedServerData("tenant:tenant-b:delivery-executions:all", 60_000, async () => {
    tenantBDeliveryLoads += 1;
    return { value: "tenant-b-delivery" };
  });

  invalidateMasterDataCaches("tenant-a");

  await getCachedServerData("tenant:tenant-a:master-data:snapshot", 60_000, async () => {
    tenantAMasterLoads += 1;
    return { value: "tenant-a-master-refreshed" };
  });
  await getCachedServerData("tenant:tenant-a:planning:2026-03-22", 60_000, async () => {
    tenantAPlanningLoads += 1;
    return { value: "tenant-a-planning-refreshed" };
  });
  await getCachedServerData("tenant:tenant-b:master-data:snapshot", 60_000, async () => {
    tenantBMasterLoads += 1;
    return { value: "tenant-b-master-refreshed" };
  });
  await getCachedServerData("tenant:tenant-b:delivery-executions:all", 60_000, async () => {
    tenantBDeliveryLoads += 1;
    return { value: "tenant-b-delivery-refreshed" };
  });

  assert.equal(tenantAMasterLoads, 2);
  assert.equal(tenantAPlanningLoads, 2);
  assert.equal(tenantBMasterLoads, 1);
  assert.equal(tenantBDeliveryLoads, 1);
});

test("planning invalidation is tenant-scoped", async () => {
  let tenantAPlanningLoads = 0;
  let tenantBPlanningLoads = 0;

  await getCachedServerData("tenant:tenant-a:planning:2026-03-22", 60_000, async () => {
    tenantAPlanningLoads += 1;
    return { value: "tenant-a-planning" };
  });
  await getCachedServerData("tenant:tenant-b:planning:2026-03-22", 60_000, async () => {
    tenantBPlanningLoads += 1;
    return { value: "tenant-b-planning" };
  });

  invalidatePlanningCaches("tenant-a");

  await getCachedServerData("tenant:tenant-a:planning:2026-03-22", 60_000, async () => {
    tenantAPlanningLoads += 1;
    return { value: "tenant-a-planning-refreshed" };
  });
  await getCachedServerData("tenant:tenant-b:planning:2026-03-22", 60_000, async () => {
    tenantBPlanningLoads += 1;
    return { value: "tenant-b-planning-refreshed" };
  });

  assert.equal(tenantAPlanningLoads, 2);
  assert.equal(tenantBPlanningLoads, 1);
});

test("delivery execution invalidation is tenant-scoped", async () => {
  let tenantADeliveryLoads = 0;
  let tenantBDeliveryLoads = 0;

  await getCachedServerData("tenant:tenant-a:delivery-executions:all", 60_000, async () => {
    tenantADeliveryLoads += 1;
    return { value: "tenant-a-delivery" };
  });
  await getCachedServerData("tenant:tenant-b:delivery-executions:all", 60_000, async () => {
    tenantBDeliveryLoads += 1;
    return { value: "tenant-b-delivery" };
  });

  invalidateDeliveryExecutionCaches("tenant-a");

  await getCachedServerData("tenant:tenant-a:delivery-executions:all", 60_000, async () => {
    tenantADeliveryLoads += 1;
    return { value: "tenant-a-delivery-refreshed" };
  });
  await getCachedServerData("tenant:tenant-b:delivery-executions:all", 60_000, async () => {
    tenantBDeliveryLoads += 1;
    return { value: "tenant-b-delivery-refreshed" };
  });

  assert.equal(tenantADeliveryLoads, 2);
  assert.equal(tenantBDeliveryLoads, 1);
});
