import assert from "node:assert/strict";
import test from "node:test";

/* -------------------------------------------------------------------------------------------------
 * Parsing pt-BR da quantidade produzida (chão de fábrica, item 4 da call 24/07).
 *
 * Espelha `parseQuantityInput` de `chao-fabrica/ordens-producao/[opId]/page.tsx`, que é local
 * ao componente client. O caso que motivou o teste: `raw.replace(",", ".")` fazia "1.500"
 * (mil e quinhentos, formato pt-BR — e o campo mostra o previsto COM vírgula decimal,
 * reforçando o hábito) virar 1,5. Como esse número é exatamente o dado que o item 4 existe
 * para coletar, o erro viraria uma falta fantasma gigante marcada como "informada".
 * -----------------------------------------------------------------------------------------------*/

function parseQuantityInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || !/^[\d.,\s]+$/.test(trimmed)) {
    return null;
  }

  const compact = trimmed.replace(/\s/g, "");
  let normalized: string;

  if (compact.includes(",")) {
    normalized = compact.replaceAll(".", "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(compact)) {
    normalized = compact.replaceAll(".", "");
  } else {
    normalized = compact;
  }

  if (!/^\d*\.?\d*$/.test(normalized) || normalized === "" || normalized === ".") {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

test("ponto como separador de MILHAR em pt-BR não vira decimal", () => {
  assert.equal(parseQuantityInput("1.500"), 1500);
  assert.equal(parseQuantityInput("1.234.567"), 1234567);
  assert.equal(parseQuantityInput("980"), 980);
});

test("vírgula é o decimal, e o ponto junto dela é milhar", () => {
  assert.equal(parseQuantityInput("1.234,5"), 1234.5);
  assert.equal(parseQuantityInput("98,25"), 98.25);
  assert.equal(parseQuantityInput("0,5"), 0.5);
});

test("ponto decimal isolado continua aceito (quem digita em formato técnico)", () => {
  assert.equal(parseQuantityInput("1.5"), 1.5);
  assert.equal(parseQuantityInput("12.75"), 12.75);
});

test("zero é quantidade válida — produção que não rendeu nada é registro legítimo", () => {
  assert.equal(parseQuantityInput("0"), 0);
  assert.equal(parseQuantityInput(" 0 "), 0);
});

test("entrada inválida devolve null em vez de gravar número errado", () => {
  assert.equal(parseQuantityInput(""), null);
  assert.equal(parseQuantityInput("   "), null);
  assert.equal(parseQuantityInput("abc"), null);
  assert.equal(parseQuantityInput("-5"), null);
  assert.equal(parseQuantityInput("1,2,3"), null);
  assert.equal(parseQuantityInput("."), null);
});
