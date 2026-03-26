import assert from "node:assert/strict";
import test from "node:test";

import {
  applyColumnSort,
  toggleColumnSort,
  type ColumnSortState,
} from "@/lib/data-table-sort";

test("toggle column sort cycles asc, desc and cleared", () => {
  const first = toggleColumnSort(null, "name");
  const second = toggleColumnSort(first, "name");
  const third = toggleColumnSort(second, "name");

  assert.deepEqual(first, { key: "name", direction: "asc" });
  assert.deepEqual(second, { key: "name", direction: "desc" });
  assert.equal(third, null);
});

test("apply column sort sorts by derived value", () => {
  const rows = [
    { id: "2", name: "Brioches", total: 12 },
    { id: "1", name: "Alfajor", total: 4 },
    { id: "3", name: "Cookie", total: 7 },
  ];
  const sortState: ColumnSortState = { key: "name", direction: "asc" };

  const sorted = applyColumnSort(rows, sortState, {
    name: (item) => item.name,
  });

  assert.deepEqual(
    sorted.map((item) => item.id),
    ["1", "2", "3"],
  );
});
