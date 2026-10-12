import assert from "node:assert/strict";
import test from "node:test";
import { parseOrderQuantity } from "./order-quantity";

const ok = (raw: number | string, unit?: Parameters<typeof parseOrderQuantity>[1]) => {
  const result = parseOrderQuantity(raw, unit);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result as Extract<typeof result, { ok: true }>;
};
const bad = (raw: number | string, unit?: Parameters<typeof parseOrderQuantity>[1]) => {
  const result = parseOrderQuantity(raw, unit);
  assert.equal(result.ok, false, `deveria recusar ${JSON.stringify(raw)}`);
  return (result as Extract<typeof result, { ok: false }>).message;
};

test("DEFEITO ORIGINAL: '1.000' é mil, nunca um (erro silencioso de 1.000x)", () => {
  assert.equal(ok("1.000", "Un").value, 1000);
  assert.equal(ok("12.500", "Un").value, 12500);
  assert.equal(ok("1.000.000", "Un").value, 1_000_000);
});

test("milhar em produto contínuo vale mil, mas AVISA para conferência", () => {
  const result = ok("1.000", "Kg");
  assert.equal(result.value, 1000);
  assert.match(result.warning ?? "", /milhar/);
  assert.match(result.warning ?? "", /mil/, "diz 'mil' por extenso, sem depender de 1.000 vs 1,000");
  assert.match(result.warning ?? "", /1,000 Kg/, "mostra a leitura decimal alternativa com a unidade");
  assert.equal(ok("1.000", "Un").warning, undefined, "unidade inteira: sem ambiguidade");
});

test("padrão brasileiro: vírgula decimal, ponto de milhar", () => {
  assert.equal(ok("1,5", "Kg").value, 1.5);
  assert.equal(ok("0,250", "Kg").value, 0.25);
  assert.equal(ok("1.234,5", "Kg").value, 1234.5);
  assert.equal(ok("12.345,678", "Kg").value, 12345.678);
});

test("ponto com 1, 2 ou 4+ casas é decimal, não milhar", () => {
  assert.equal(ok("1.5", "Kg").value, 1.5);
  assert.equal(ok("2.25", "Kg").value, 2.25);
  assert.equal(ok("0.500", "Kg").value, 0.5, "zero à esquerda: nunca milhar");
});

test("número de verdade da célula passa direto, sem reinterpretar", () => {
  assert.equal(ok(1000, "Kg").value, 1000);
  assert.equal(ok(1000, "Kg").warning, undefined);
  assert.equal(ok(1.5, "Kg").value, 1.5);
});

test("unidade escrita junto do número só vale se bater com a do produto", () => {
  assert.equal(ok("12 un", "Un").value, 12);
  assert.equal(ok("12 UN", "Un").value, 12);
  assert.equal(ok("5 kg", "Kg").value, 5);
  assert.equal(ok("1,5 kg", "Kg").value, 1.5);
  assert.match(bad("5 kg", "Un"), /Kg.*Un|Converta/);
  assert.match(bad("12 caixas", "Un"), /não reconhecida/);
});

test("formatos ambíguos ou inválidos são recusados com explicação", () => {
  assert.match(bad("1.2.3", "Un"), /milhar/);
  assert.match(bad("1,2,3", "Un"), /vírgula/);
  assert.match(bad("1,234.5", "Kg"), /misto|ambíguo/);
  assert.match(bad("abc", "Un"), /inválida/);
  assert.match(bad("-3", "Un"), /inválida/);
  assert.match(bad("", "Un"), /branco/);
  assert.match(bad("   ", "Un"), /branco/);
  assert.match(bad(0, "Un"), /maior que zero/);
  assert.match(bad("0", "Un"), /maior que zero/);
  assert.match(bad("1,2345", "Kg"), /três casas/);
  assert.match(bad(1_000_000_000, "Un"), /limite/);
});

test("milhar com vírgula decimal só vale no padrão exato: grupos de três dígitos", () => {
  assert.match(bad("1.23,5", "Kg"), /misto|ambíguo/, "grupo de 2 dígitos não é milhar");
  assert.match(bad("12.3456,5", "Kg"), /misto|ambíguo/, "grupo de 4 dígitos não é milhar");
  assert.match(bad("1.2.3.4,5", "Kg"), /misto|ambíguo/);
  assert.match(bad("01.000,5", "Kg"), /misto|ambíguo/, "zero à esquerda não é milhar");
  assert.equal(ok("1.000,5", "Kg").value, 1000.5);
  assert.equal(ok("999.999,999", "Kg").value, 999999.999);
});
