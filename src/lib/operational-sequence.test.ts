import assert from "node:assert/strict";
import test from "node:test";

import { summarizeOperationalDates } from "@/lib/operational-sequence";

test("summarizeOperationalDates returns the empty state when there are no valid dates", () => {
  assert.deepEqual(
    summarizeOperationalDates([null, undefined], {
      emptyValue: "Escolha os itens abaixo",
      emptyHelper: "Cada produto mostra sua própria data.",
    }),
    {
      value: "Escolha os itens abaixo",
      helper: "Cada produto mostra sua própria data.",
      count: 0,
    },
  );
});

test("summarizeOperationalDates formats a single date for direct reading", () => {
  assert.deepEqual(summarizeOperationalDates(["2026-03-26"]), {
    value: "26/03/2026",
    helper: null,
    count: 1,
  });
});

test("summarizeOperationalDates groups multiple dates into a simple range summary", () => {
  assert.deepEqual(
    summarizeOperationalDates(["2026-03-29", "2026-03-27", "2026-03-27"], {
      mixedValue: "Varia por item",
    }),
    {
      value: "Varia por item",
      helper: "2 datas possíveis: 27/03/2026 a 29/03/2026.",
      count: 2,
    },
  );
});
