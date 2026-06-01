import { createRequire } from "node:module";
import Module from "node:module";

// `workflow.ts` guards itself with `import "server-only"`, a Next.js-provided
// no-op marker module that isn't resolvable inside the tsx test runner. Stub it
// synchronously (CJS resolution + cache) BEFORE the dynamic import below, so we
// can import and test the pure helpers without dragging in the server runtime.
const require = createRequire(import.meta.url);
const ModuleAny = Module as unknown as {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
};
const STUB_ID = "\0server-only-stub";
const originalResolve = ModuleAny._resolveFilename;
ModuleAny._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return STUB_ID;
  return originalResolve.call(this, request, ...rest);
};
ModuleAny._cache[STUB_ID] = { id: STUB_ID, exports: {}, loaded: true };

import assert from "node:assert/strict";
import test from "node:test";

import type { ProductionItemStatus } from "@/lib/factory-planning/types";
import type * as WorkflowModule from "@/lib/supabase-data/workflow";

// Synchronous require (CJS) so the `server-only` resolver patch above takes
// effect before the module graph is loaded; a top-level dynamic import isn't
// available under tsx's CJS transform.
const { canonicalProductionItemKey, foldProductionItemStatuses } = require(
  "@/lib/supabase-data/workflow",
) as typeof WorkflowModule;

test("canonicalProductionItemKey — drops the schedule segment from a 4-part key", () => {
  assert.equal(
    canonicalProductionItemKey("2026-03-10|line-paes|schedule-paes|product-pao-frances"),
    "2026-03-10|line-paes|product-pao-frances",
  );
});

test("canonicalProductionItemKey — a 3-part key is returned unchanged", () => {
  assert.equal(
    canonicalProductionItemKey("2026-03-10|line-paes|product-pao-frances"),
    "2026-03-10|line-paes|product-pao-frances",
  );
});

test("canonicalProductionItemKey — keys with fewer than 3 parts are returned as-is", () => {
  assert.equal(canonicalProductionItemKey("only-one"), "only-one");
  assert.equal(canonicalProductionItemKey("date|line"), "date|line");
});

test("foldProductionItemStatuses — collision keeps the most advanced status", () => {
  // AJ root-cause: a recipe revision changes scheduleId, so the same operational
  // item is persisted under two different 4-part keys. After dropping scheduleId
  // both canonicalize to the same key — the fold must keep the work already done
  // (concluido beats em_preparacao), never regressing to "nao_iniciado".
  const rows: { production_item_key: string; status: ProductionItemStatus }[] = [
    {
      production_item_key: "2026-03-10|line-paes|schedule-old|product-pao-frances",
      status: "concluido",
    },
    {
      production_item_key: "2026-03-10|line-paes|schedule-new|product-pao-frances",
      status: "em_preparacao",
    },
  ];

  const result = foldProductionItemStatuses(rows);

  assert.deepEqual(result, {
    "2026-03-10|line-paes|product-pao-frances": "concluido",
  });
});

test("foldProductionItemStatuses — collision is order-independent (advanced still wins when listed first)", () => {
  const rows: { production_item_key: string; status: ProductionItemStatus }[] = [
    {
      production_item_key: "2026-03-10|line-paes|schedule-new|product-pao-frances",
      status: "em_forno",
    },
    {
      production_item_key: "2026-03-10|line-paes|schedule-old|product-pao-frances",
      status: "em_preparacao",
    },
  ];

  const result = foldProductionItemStatuses(rows);

  assert.deepEqual(result, {
    "2026-03-10|line-paes|product-pao-frances": "em_forno",
  });
});

test("foldProductionItemStatuses — recovers a legacy 4-part row under the canonical key", () => {
  const rows: { production_item_key: string; status: ProductionItemStatus }[] = [
    {
      production_item_key: "2026-03-10|line-paes|schedule-paes|product-pao-frances",
      status: "embalando",
    },
  ];

  assert.deepEqual(foldProductionItemStatuses(rows), {
    "2026-03-10|line-paes|product-pao-frances": "embalando",
  });
});

test("foldProductionItemStatuses — already-canonical 3-part rows pass through", () => {
  const rows: { production_item_key: string; status: ProductionItemStatus }[] = [
    {
      production_item_key: "2026-03-10|line-paes|product-pao-frances",
      status: "em_producao",
    },
  ];

  assert.deepEqual(foldProductionItemStatuses(rows), {
    "2026-03-10|line-paes|product-pao-frances": "em_producao",
  });
});
