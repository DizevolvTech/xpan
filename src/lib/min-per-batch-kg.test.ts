import assert from "node:assert/strict";
import test from "node:test";

import { deriveMinPerBatchFromKg } from "@/lib/production-data-utils";

// Cartão #174: panetone com 380,8 g por unidade na batida.
const kgPerUnit = 0.3808;

test("mínimo por batida em kg vira unidades inteiras, sem fração", () => {
  assert.equal(deriveMinPerBatchFromKg(10, kgPerUnit), 26);
});

test("mesma conta da capacidade máxima: 80 kg -> 210 unidades", () => {
  assert.equal(deriveMinPerBatchFromKg(80, kgPerUnit), 210);
});

test("quilos exatos de N unidades dão N, sem perder uma por arredondamento", () => {
  assert.equal(deriveMinPerBatchFromKg(26 * kgPerUnit, kgPerUnit), 26);
});

test("sem kg, kg menor que uma unidade ou sem peso por unidade: sem mínimo", () => {
  assert.equal(deriveMinPerBatchFromKg(null, kgPerUnit), null);
  assert.equal(deriveMinPerBatchFromKg(0, kgPerUnit), null);
  assert.equal(deriveMinPerBatchFromKg(0.2, kgPerUnit), null);
  assert.equal(deriveMinPerBatchFromKg(10, 0), null);
});
