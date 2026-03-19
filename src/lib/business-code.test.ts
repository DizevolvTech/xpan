import assert from "node:assert/strict";
import test from "node:test";

import {
  formatFallbackBusinessCode,
  formatMonotonicBusinessCode,
  getBusinessCodeScopeKey,
} from "@/lib/business-code";

test("business code scope key uses the YYMMDD portion of the reference date", () => {
  assert.equal(getBusinessCodeScopeKey("2026-03-19T14:25:33.000Z"), "260319");
});

test("monotonic business codes use a stable scoped format", () => {
  assert.equal(formatMonotonicBusinessCode("PD", 1, "2026-03-19T14:25:33.000Z"), "PD-260319-0001");
  assert.equal(formatMonotonicBusinessCode("OC", 37, "2026-03-19T14:25:33.000Z"), "OC-260319-0037");
});

test("fallback business codes preserve the scoped prefix and stay unique-friendly", () => {
  const code = formatFallbackBusinessCode("PD", "2026-03-19T14:25:33.000Z");

  assert.match(code, /^PD-260319-142533-[A-Z0-9]{6}$/);
});
