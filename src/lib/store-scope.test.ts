import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStoreScopeStorageKey,
  resolveActiveStoreId,
  resolveAvailableStores,
} from "@/lib/store-scope";

const stores = [
  { id: "store-b", name: "Loja B" },
  { id: "store-a", name: "Loja A" },
  { id: "store-c", name: "Loja C" },
];

test("store scope filters available stores by explicit permissions", () => {
  assert.deepEqual(
    resolveAvailableStores(stores, ["store-a", "store-c"]).map((store) => store.id),
    ["store-a", "store-c"],
  );
  assert.deepEqual(resolveAvailableStores(stores).map((store) => store.id), ["store-b", "store-a", "store-c"]);
});

test("store scope resolves preferred, persisted and fallback store ids", () => {
  const availableStores = resolveAvailableStores(stores, ["store-a", "store-c"]);

  assert.equal(resolveActiveStoreId(availableStores, "store-c", "store-a"), "store-c");
  assert.equal(resolveActiveStoreId(availableStores, "store-b", "store-a"), "store-a");
  assert.equal(resolveActiveStoreId(availableStores, "", null), "store-a");
  assert.equal(resolveActiveStoreId([], "", null), "");
});

test("store scope storage key is stable regardless of store ordering", () => {
  assert.equal(
    buildStoreScopeStorageKey(stores),
    "xpan.store-scope.global.store-a.store-b.store-c",
  );
  assert.equal(
    buildStoreScopeStorageKey(stores, "tenant-123"),
    "xpan.store-scope.tenant-123.store-a.store-b.store-c",
  );
});
