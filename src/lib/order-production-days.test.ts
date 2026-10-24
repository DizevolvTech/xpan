import assert from "node:assert/strict";
import test from "node:test";

import { summarizeOrderProductionDays } from "./order-production-days";

test("datas de produção do pedido: únicas, ordenadas, sem slots do cronograma", () => {
  assert.deepEqual(summarizeOrderProductionDays([]), { dates: [], label: "" });
  assert.equal(
    summarizeOrderProductionDays([{ productionDate: "2026-10-27" }, { productionDate: "2026-10-27" }]).label,
    "Produz 27/10",
  );
  const many = summarizeOrderProductionDays([
    { productionDate: "2026-10-27" },
    { productionDate: "2026-10-25" },
    { productionDate: null },
    { productionDate: "2026-10-20", demandSource: "cronograma" },
    { productionDate: "2026-10-26" },
  ]);
  assert.deepEqual(many.dates, ["2026-10-25", "2026-10-26", "2026-10-27"]);
  assert.equal(many.label, "Produz 25/10 a 27/10 (3 dias)");
});
