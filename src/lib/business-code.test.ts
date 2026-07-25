import assert from "node:assert/strict";
import test from "node:test";

import {
  formatFallbackBusinessCode,
  formatMonotonicBusinessCode,
  getBusinessCodeScopeKey,
} from "@/lib/business-code";

test("business code scope key uses the YYMMDD portion of the reference date", () => {
  assert.equal(getBusinessCodeScopeKey("2026-03-19T14:25:33.000Z"), "260319");
});

test("monotonic business codes use a stable scoped format", () => {
  assert.equal(formatMonotonicBusinessCode("PD", 1, "2026-03-19T14:25:33.000Z"), "PD-260319-0001");
  assert.equal(formatMonotonicBusinessCode("OC", 37, "2026-03-19T14:25:33.000Z"), "OC-260319-0037");
});

test("fallback business codes preserve the scoped prefix and stay unique-friendly", () => {
  const code = formatFallbackBusinessCode("PD", "2026-03-19T14:25:33.000Z");

  assert.match(code, /^PD-260319-142533-[A-Z0-9]{6}$/);
});


/* -------------------------------------------------------------------------------------------------
 * O código de negócio carrega a DATA e é lido por gente. Fatiar o ISO em UTC fazia o código
 * nascer com a data de amanhã a partir das 21h em Brasília — visto ao vivo: ocorrências
 * criadas na noite de 24/07 saíram como `OC-260725-*`.
 * -----------------------------------------------------------------------------------------------*/

test("noite em Brasília não adianta o código para o dia seguinte", () => {
  // 24/07 23:00 BRT = 25/07 02:00 UTC. O código tem que ser de 24.
  assert.equal(getBusinessCodeScopeKey("2026-07-25T02:00:00.000Z"), "260724");
  // 24/07 21:30 BRT = 25/07 00:30 UTC.
  assert.equal(getBusinessCodeScopeKey("2026-07-25T00:30:00.000Z"), "260724");
});

test("madrugada em Brasília usa o dia corrente, não o anterior", () => {
  // 25/07 01:00 BRT = 25/07 04:00 UTC.
  assert.equal(getBusinessCodeScopeKey("2026-07-25T04:00:00.000Z"), "260725");
});

test("horário comercial é idêntico ao comportamento anterior", () => {
  assert.equal(getBusinessCodeScopeKey("2026-07-24T13:00:00.000Z"), "260724");
  assert.equal(getBusinessCodeScopeKey("2026-03-09T12:00:00.000Z"), "260309");
});

test("data sem hora é tratada como chave de data, não convertida de fuso", () => {
  // `new Date("2026-07-24")` é meia-noite UTC = 23/07 21h em São Paulo. Converter aqui
  // devolveria o dia anterior; uma chave `AAAA-MM-DD` já é a data operacional.
  assert.equal(getBusinessCodeScopeKey("2026-07-24"), "260724");
  assert.equal(getBusinessCodeScopeKey("2026-01-01"), "260101");
});
