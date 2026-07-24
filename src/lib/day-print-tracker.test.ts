import assert from "node:assert/strict";
import test from "node:test";

import { dayPrintStorageKey, wasDayPrinted, getDayPrintedAt } from "@/lib/day-print-tracker";

test("XPAN-5: dayPrintStorageKey namespaces por data", () => {
  assert.equal(dayPrintStorageKey("2026-07-23"), "xpan.production-sheets-printed.2026-07-23");
  assert.notEqual(dayPrintStorageKey("2026-07-23"), dayPrintStorageKey("2026-07-24"));
});

test("XPAN-5: leitura sem window (SSR) não quebra e retorna vazio", () => {
  // No ambiente de teste (node) não há window → best-effort retorna null/false.
  assert.equal(getDayPrintedAt("2026-07-23"), null);
  assert.equal(wasDayPrinted("2026-07-23"), false);
});
