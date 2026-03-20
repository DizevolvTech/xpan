import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeStoreIdsForRole,
  supportsStoreScope,
} from "@/lib/admin-users";

test("store scope is only available for loja users", () => {
  assert.equal(supportsStoreScope("loja"), true);
  assert.equal(supportsStoreScope("administrador"), false);
  assert.equal(supportsStoreScope("gestor-dados"), false);
  assert.equal(supportsStoreScope("gestor-fabrica"), false);
  assert.equal(supportsStoreScope("chao-fabrica"), false);
});

test("store ids are cleared for non-store roles and deduplicated for loja", () => {
  assert.deepEqual(
    normalizeStoreIdsForRole("administrador", ["store-a", "store-b"]),
    [],
  );

  assert.deepEqual(
    normalizeStoreIdsForRole("loja", ["store-a", "store-a", "", "store-b"]),
    ["store-a", "store-b"],
  );
});
