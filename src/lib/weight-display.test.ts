import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDisplayNumber,
  formatDisplayQuantity,
  isWeightDisplayUnit,
  kgToGrams,
  normalizeWeightDisplayUnit,
  resolveWeightDisplayUnit,
  toDisplayQuantity,
} from "@/lib/weight-display";

const PRODUCTION_SHEET = { minimumFractionDigits: 3, maximumFractionDigits: 3 };

test("kg → g: a conta é feita na exibição e não carrega ruído de ponto flutuante", () => {
  assert.equal(kgToGrams(0.234), 234);
  assert.equal(kgToGrams(1.005), 1005); // 1,005 × 1000 = 1004,9999… em ponto flutuante cru
  assert.equal(kgToGrams(0.001), 1);
  assert.equal(kgToGrams(12.5), 12500);
  assert.equal(kgToGrams(0), 0);
});

test("modo g converte SÓ Kg; qualquer outra unidade passa intacta", () => {
  assert.deepEqual(toDisplayQuantity(0.234, "Kg", "g"), { value: 234, unit: "g", converted: true });
  assert.deepEqual(toDisplayQuantity(0.234, "kg", "g"), { value: 234, unit: "g", converted: true });
  for (const unit of ["g", "L", "ml", "Un", "Dz", "Forma", "Pacote"]) {
    assert.deepEqual(toDisplayQuantity(3, unit, "g"), { value: 3, unit, converted: false }, unit);
  }
});

test("modo kg não muda nada, nem o texto da unidade", () => {
  assert.deepEqual(toDisplayQuantity(0.234, "Kg", "kg"), { value: 0.234, unit: "Kg", converted: false });
  assert.deepEqual(toDisplayQuantity(0.234, "kg", "kg"), { value: 0.234, unit: "kg", converted: false });
});

test("formato em kg é o que a folha já usava (3 casas, rótulo da linha)", () => {
  assert.equal(formatDisplayQuantity(0.234, "Kg", "kg", PRODUCTION_SHEET), "0,234 Kg");
  assert.equal(formatDisplayQuantity(12.5, "Kg", "kg", PRODUCTION_SHEET), "12,500 Kg");
  assert.equal(formatDisplayQuantity(2, "Un", "kg", PRODUCTION_SHEET), "2,000 Un");
});

test("formato em g: inteiro de gramas, milhar com ponto, até 1 casa para fração de grama", () => {
  assert.equal(formatDisplayQuantity(0.234, "Kg", "g", PRODUCTION_SHEET), "234 g");
  assert.equal(formatDisplayQuantity(1.25, "Kg", "g", PRODUCTION_SHEET), "1.250 g");
  assert.equal(formatDisplayQuantity(0.0004, "Kg", "g", PRODUCTION_SHEET), "0,4 g");
  assert.equal(formatDisplayQuantity(0, "Kg", "g", PRODUCTION_SHEET), "0 g");
  assert.equal(formatDisplayQuantity(0.5, "g", "g", PRODUCTION_SHEET), "0,500 g"); // já era g: não converte de novo
  assert.equal(formatDisplayQuantity(2, "Un", "g", PRODUCTION_SHEET), "2,000 Un");
});

test("valor ausente/inválido vira '-' nos dois modos (não vira '0 g')", () => {
  for (const mode of ["kg", "g"] as const) {
    assert.equal(formatDisplayQuantity(null, "Kg", mode), "-");
    assert.equal(formatDisplayQuantity(undefined, "Kg", mode), "-");
    assert.equal(formatDisplayQuantity(Number.NaN, "Kg", mode), "-");
    assert.equal(formatDisplayNumber(Number.POSITIVE_INFINITY, "Kg", mode), "-");
  }
});

test("formatDisplayNumber devolve só o número (para colunas cujo título já traz a unidade)", () => {
  assert.equal(formatDisplayNumber(0.234, "Kg", "g"), "234");
  assert.equal(formatDisplayNumber(0.234, "Kg", "kg", PRODUCTION_SHEET), "0,234");
});

test("configuração do cliente: padrão kg; aceita g/gr; lixo cai em kg (nunca quebra)", () => {
  assert.equal(normalizeWeightDisplayUnit(undefined), "kg");
  assert.equal(normalizeWeightDisplayUnit(null), "kg");
  assert.equal(normalizeWeightDisplayUnit(""), "kg");
  assert.equal(normalizeWeightDisplayUnit("kg"), "kg");
  assert.equal(normalizeWeightDisplayUnit("g"), "g");
  assert.equal(normalizeWeightDisplayUnit("gr"), "g");
  assert.equal(normalizeWeightDisplayUnit(" GR "), "g");
  assert.equal(normalizeWeightDisplayUnit("mg"), "kg");
  assert.equal(normalizeWeightDisplayUnit(42), "kg");
  assert.equal(isWeightDisplayUnit("g"), true);
  assert.equal(isWeightDisplayUnit("gr"), false);
  assert.equal(isWeightDisplayUnit(undefined), false);
});

test("escolha na emissão (?unit=) ganha da configuração do cliente; valor inválido na URL é ignorado", () => {
  assert.equal(resolveWeightDisplayUnit("g", "kg"), "g");
  assert.equal(resolveWeightDisplayUnit("kg", "g"), "kg");
  assert.equal(resolveWeightDisplayUnit(null, "g"), "g");
  assert.equal(resolveWeightDisplayUnit(undefined, "kg"), "kg");
  assert.equal(resolveWeightDisplayUnit("gr", "g"), "g"); // 'gr' não é aceito na URL: cai na config
  assert.equal(resolveWeightDisplayUnit("mg", "kg"), "kg");
  assert.equal(resolveWeightDisplayUnit("", undefined), "kg");
});
