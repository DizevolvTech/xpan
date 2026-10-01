import assert from "node:assert/strict";
import test from "node:test";

import { isChunkLoadError, shouldAutoReload } from "@/lib/chunk-error-recovery";

test("isChunkLoadError reconhece as variações de falha de chunk do Next/Turbopack/navegadores", () => {
  assert.equal(isChunkLoadError({ name: "ChunkLoadError", message: "x" }), true);
  assert.equal(isChunkLoadError(new Error("Loading chunk 123 failed.")), true);
  assert.equal(isChunkLoadError(new Error("Failed to load chunk /_next/static/chunks/abc.js")), true);
  assert.equal(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x/a.js")), true);
  assert.equal(isChunkLoadError(new TypeError("Importing a module script failed.")), true);
});

test("isChunkLoadError não confunde erro comum de código com falha de chunk", () => {
  assert.equal(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')")), false);
  assert.equal(isChunkLoadError(null), false);
  assert.equal(isChunkLoadError(undefined), false);
  assert.equal(isChunkLoadError("Loading chunk 1 failed"), false);
});

test("shouldAutoReload recarrega uma vez e bloqueia loop dentro da janela", () => {
  const now = 1_000_000;
  assert.equal(shouldAutoReload(null, now), true);
  assert.equal(shouldAutoReload(String(now - 5_000), now), false);
  assert.equal(shouldAutoReload(String(now - 61_000), now), true);
  assert.equal(shouldAutoReload("lixo", now), true);
});
