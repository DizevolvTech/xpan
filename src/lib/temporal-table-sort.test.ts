import assert from "node:assert/strict";
import test from "node:test";

import {
  hasTemporalSortValue,
  parseTemporalSortValue,
  resolveTemporalSortKey,
  sortItemsByTemporalValue,
} from "@/lib/temporal-table-sort";

test("temporal sort parses ISO and BR date formats", () => {
  assert.notEqual(parseTemporalSortValue("2026-03-18"), null);
  assert.notEqual(parseTemporalSortValue("2026-03-18T14:30:00.000Z"), null);
  assert.notEqual(parseTemporalSortValue("18/03/2026"), null);
  assert.notEqual(parseTemporalSortValue("18/03/2026 14:30"), null);
  assert.notEqual(parseTemporalSortValue("18/03/2026, 14:30"), null);
});

test("temporal sort detects the best key by priority", () => {
  const items = [
    { code: "A", deliveryDate: "2026-03-18", orderedAtKey: "2026-03-17" },
    { code: "B", deliveryDate: "2026-03-19", orderedAtKey: "2026-03-18" },
  ];

  assert.equal(resolveTemporalSortKey(items), "orderedAtKey");
  assert.equal(hasTemporalSortValue(items), true);
});

test("temporal sort keeps most recent items first by default", () => {
  const items = [
    { code: "A", createdAt: "2026-03-17T10:00:00.000Z" },
    { code: "B", createdAt: "2026-03-18T10:00:00.000Z" },
    { code: "C", createdAt: "2026-03-16T10:00:00.000Z" },
  ];

  assert.deepEqual(sortItemsByTemporalValue(items, "recent_first").map((item) => item.code), [
    "B",
    "A",
    "C",
  ]);
});

test("temporal sort supports oldest first ordering", () => {
  const items = [
    { code: "A", deliveryDate: "2026-03-19" },
    { code: "B", deliveryDate: "2026-03-17" },
    { code: "C", deliveryDate: "2026-03-18" },
  ];

  assert.deepEqual(
    sortItemsByTemporalValue(items, "old_first", ["deliveryDate"]).map((item) => item.code),
    ["B", "C", "A"],
  );
});
