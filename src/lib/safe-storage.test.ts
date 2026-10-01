import assert from "node:assert/strict";
import test from "node:test";

import { safeStorageGet, safeStorageSet } from "@/lib/safe-storage";

type FakeWindow = { localStorage?: unknown; sessionStorage?: unknown };

function withWindow(fake: FakeWindow, run: () => void) {
  const g = globalThis as unknown as { window?: FakeWindow };
  const previous = g.window;
  g.window = fake;
  try {
    run();
  } finally {
    if (previous === undefined) {
      delete g.window;
    } else {
      g.window = previous;
    }
  }
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

test("safe-storage: sem window (SSR) devolve vazio sem lançar", () => {
  assert.equal(safeStorageGet("k"), null);
  assert.equal(safeStorageSet("k", "v"), false);
});

test("safe-storage: lê e grava quando o storage funciona", () => {
  withWindow({ localStorage: memoryStorage() }, () => {
    assert.equal(safeStorageSet("k", "v"), true);
    assert.equal(safeStorageGet("k"), "v");
  });
});

test("safe-storage: acesso à propriedade lançando SecurityError não derruba (navegador bloqueando storage)", () => {
  const blocked: FakeWindow = {};
  Object.defineProperty(blocked, "localStorage", {
    get() {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
  });

  withWindow(blocked, () => {
    assert.equal(safeStorageGet("k"), null);
    assert.equal(safeStorageSet("k", "v"), false);
  });
});

test("safe-storage: getItem/setItem lançando (cota cheia/modo privado) não derruba", () => {
  const throwing = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new DOMException("quota", "QuotaExceededError");
    },
    removeItem() {},
  };

  withWindow({ localStorage: throwing }, () => {
    assert.equal(safeStorageGet("k"), null);
    assert.equal(safeStorageSet("k", "v"), false);
  });
});

test("safe-storage: sessionStorage é independente do localStorage", () => {
  withWindow({ localStorage: memoryStorage(), sessionStorage: memoryStorage() }, () => {
    safeStorageSet("k", "local", "local");
    safeStorageSet("k", "session", "session");
    assert.equal(safeStorageGet("k", "local"), "local");
    assert.equal(safeStorageGet("k", "session"), "session");
  });
});
