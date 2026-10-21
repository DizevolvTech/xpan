import assert from "node:assert/strict";
import test from "node:test";

import { classifyOpDay, groupOpsByProductionDay, summarizeOpDates } from "@/lib/op-day-groups";

const TODAY = "2026-10-13";
type Op = { id: string; productionDate: string; done?: boolean };
const isFinished = (op: Op) => op.done === true;

test("classifyOpDay: atrasada só se o dia passou e a OP não terminou", () => {
  assert.equal(classifyOpDay("2026-10-12", TODAY, false), "atrasada");
  assert.equal(classifyOpDay("2026-10-12", TODAY, true), "encerrada");
  assert.equal(classifyOpDay(TODAY, TODAY, false), "hoje");
  assert.equal(classifyOpDay("2026-10-14", TODAY, false), "futura");
});

test("agrupa por dia preservando a ordem e conta atraso em dias", () => {
  const ops: Op[] = [
    { id: "a", productionDate: "2026-10-11" },
    { id: "b", productionDate: "2026-10-11" },
    { id: "c", productionDate: "2026-10-13" },
  ];
  const { groups, hiddenFuture } = groupOpsByProductionDay(ops, TODAY, { showFuture: false, isFinished });
  assert.equal(hiddenFuture, 0);
  assert.deepEqual(groups.map((g) => [g.date, g.kind, g.daysLate, g.ops.map((o) => o.id)]), [
    ["2026-10-11", "atrasada", 2, ["a", "b"]],
    ["2026-10-13", "hoje", 0, ["c"]],
  ]);
});

test("futuras ficam escondidas por padrão e voltam com showFuture", () => {
  const ops: Op[] = [
    { id: "a", productionDate: TODAY },
    { id: "f1", productionDate: "2026-10-15" },
    { id: "f2", productionDate: "2026-10-16" },
  ];
  const hidden = groupOpsByProductionDay(ops, TODAY, { showFuture: false, isFinished });
  assert.equal(hidden.hiddenFuture, 2);
  assert.deepEqual(hidden.groups.map((g) => g.date), [TODAY]);
  const shown = groupOpsByProductionDay(ops, TODAY, { showFuture: true, isFinished });
  assert.equal(shown.hiddenFuture, 0);
  assert.deepEqual(shown.groups.map((g) => g.kind), ["hoje", "futura", "futura"]);
});

test("dia com OP encerrada e OP atrasada vira atrasado", () => {
  const ops: Op[] = [
    { id: "a", productionDate: "2026-10-10", done: true },
    { id: "b", productionDate: "2026-10-10" },
  ];
  const { groups } = groupOpsByProductionDay(ops, TODAY, { showFuture: false, isFinished });
  assert.equal(groups[0].kind, "atrasada");
  assert.equal(groups[0].daysLate, 3);
});

test("summarizeOpDates: única, mais próxima +N, ou nada", () => {
  assert.equal(summarizeOpDates([]), null);
  assert.equal(summarizeOpDates([{ date: "2026-10-14", label: "14/10" }, { date: "2026-10-14", label: "14/10" }]), "14/10");
  assert.equal(
    summarizeOpDates([{ date: "2026-10-15", label: "15/10" }, { date: "2026-10-14", label: "14/10" }]),
    "14/10 +1",
  );
});
