import assert from "node:assert/strict";
import test from "node:test";

import {
  ORDER_DAY_FIELDS,
  buildCoveredDaysFill,
  getCoveredDayFields,
  sumOrderDayQuantities,
} from "@/lib/store-order-coverage";

test("sumOrderDayQuantities — soma todos os dias preenchidos", () => {
  assert.equal(sumOrderDayQuantities({ ter: 10, qua: 8, qui: 12 }), 30);
});

test("sumOrderDayQuantities — record vazio/parcial = 0", () => {
  assert.equal(sumOrderDayQuantities({}), 0);
  assert.equal(sumOrderDayQuantities({ seg: 0, dom: 0 }), 0);
});

test("sumOrderDayQuantities — cobre todos os 7 campos de dia", () => {
  const all = ORDER_DAY_FIELDS.reduce<Record<string, number>>((acc, field) => {
    acc[field] = 1;
    return acc;
  }, {});
  assert.equal(sumOrderDayQuantities(all), 7);
});

test("getCoveredDayFields — retorna os N primeiros dias da ordem visual (cobertura)", () => {
  const order = ["ter", "qua", "qui", "sex", "sab", "dom", "seg"] as const;
  assert.deepEqual(getCoveredDayFields([...order], 3), ["ter", "qua", "qui"]);
  assert.deepEqual(getCoveredDayFields([...order], 1), ["ter"]);
  // cobertura maior que a semana é limitada ao tamanho disponível
  assert.deepEqual(getCoveredDayFields([...order], 99), [...order]);
});

test("buildCoveredDaysFill — replica o valor base nos dias cobertos (planejamento diário)", () => {
  const order = ["ter", "qua", "qui", "sex", "sab", "dom", "seg"] as const;
  const fill = buildCoveredDaysFill([...order], 3, 10);
  assert.deepEqual(fill, { ter: 10, qua: 10, qui: 10 });
});

test("buildCoveredDaysFill — valor 0 limpa os dias cobertos", () => {
  const order = ["ter", "qua", "qui"] as const;
  const fill = buildCoveredDaysFill([...order], 2, 0);
  assert.deepEqual(fill, { ter: 0, qua: 0 });
});
