import assert from "node:assert/strict";
import test from "node:test";

import { resolveDayPrintDate } from "./day-print-date";

test("impressão do dia: filtro, hoje, próximo dia com OP, senão o último", () => {
  const dates = ["2026-09-26", "2026-10-25", "2026-10-27"];
  assert.equal(resolveDayPrintDate(dates, "2026-10-24", "2026-09-26"), "2026-09-26");
  assert.equal(resolveDayPrintDate([...dates, "2026-10-24"], "2026-10-24", "all"), "2026-10-24");
  assert.equal(resolveDayPrintDate(dates, "2026-10-24", "all"), "2026-10-25");
  assert.equal(resolveDayPrintDate(["2026-09-26", "2026-09-28"], "2026-10-24", "all"), "2026-09-28");
  assert.equal(resolveDayPrintDate([], "2026-10-24", "all"), "2026-10-24");
});
