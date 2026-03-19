import assert from "node:assert/strict";
import test from "node:test";

import { hasStoreAccess, resolveAllowedStoreIds } from "@/lib/store-access";

test("store scope applies to any user with explicit store assignments", () => {
  const allowedStoreIds = resolveAllowedStoreIds(["store-a", "store-c"]);

  assert.deepEqual(allowedStoreIds, ["store-a", "store-c"]);
  assert.equal(hasStoreAccess("store-a", allowedStoreIds), true);
  assert.equal(hasStoreAccess("store-b", allowedStoreIds), false);
});

test("empty store scope keeps unrestricted access regardless of base role", () => {
  const allowedStoreIds = resolveAllowedStoreIds([]);
  assert.equal(allowedStoreIds, null);
  assert.equal(hasStoreAccess("store-a", allowedStoreIds), true);
});
