import assert from "node:assert/strict";
import test from "node:test";

import { formatQuantityForPersona } from "@/lib/persona-units";

test("S2.4 loja e padeiro falam Un; dosimetria fala kg; expedição fala caixa", () => {
  const kg = 1.662; // 6 Un × 0,277 kg
  const loja = formatQuantityForPersona({
    persona: "loja",
    kg,
    salesUnit: "Un",
    salesToKgFactor: 0.277,
    expeditionUnit: "Cx",
    expeditionToKgFactor: 1.662,
  });
  const dosimetria = formatQuantityForPersona({
    persona: "dosimetria",
    kg,
    salesUnit: "Un",
    salesToKgFactor: 0.277,
    expeditionUnit: "Cx",
    expeditionToKgFactor: 1.662,
  });
  const padeiro = formatQuantityForPersona({
    persona: "padeiro",
    kg,
    salesUnit: "Un",
    salesToKgFactor: 0.277,
    expeditionUnit: "Cx",
    expeditionToKgFactor: 1.662,
  });
  const expedicao = formatQuantityForPersona({
    persona: "expedicao",
    kg,
    salesUnit: "Un",
    salesToKgFactor: 0.277,
    expeditionUnit: "Cx",
    expeditionToKgFactor: 1.662,
  });

  assert.equal(loja.unitLabel, "Un");
  assert.equal(loja.quantity, 6);
  assert.equal(padeiro.quantity, 6);
  assert.equal(dosimetria.unitLabel, "Kg");
  assert.equal(dosimetria.quantity, 1.662);
  assert.equal(expedicao.unitLabel, "Cx");
  assert.equal(expedicao.quantity, 1);
});
