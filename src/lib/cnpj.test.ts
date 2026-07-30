import assert from "node:assert/strict";
import test from "node:test";

import {
  computeCnpjCheckDigits,
  formatCnpj,
  isValidCnpj,
  maskCnpjInput,
  normalizeCnpj,
  resolveCnpjForStorage,
} from "@/lib/cnpj";

test("normalizeCnpj remove máscara, espaço e caixa baixa", () => {
  assert.equal(normalizeCnpj("12.ABC.345/01DE-35"), "12ABC34501DE35");
  assert.equal(normalizeCnpj(" 12.abc.345/01de-35 "), "12ABC34501DE35");
  assert.equal(normalizeCnpj("00.394.460/0058-87"), "00394460005887");
  assert.equal(normalizeCnpj(""), "");
});

test("computeCnpjCheckDigits reproduz o exemplo oficial da Receita (IN RFB 2.229/2024)", () => {
  // Exemplo do documento "CNPJ alfanumérico — Perguntas & Respostas", pergunta 14.
  assert.equal(computeCnpjCheckDigits("12ABC34501DE"), "35");
});

test("computeCnpjCheckDigits continua correto para CNPJ numérico legado", () => {
  // Receita Federal: 00.394.460/0058-87
  assert.equal(computeCnpjCheckDigits("003944600058"), "87");
  // Banco do Brasil: 00.000.000/0001-91
  assert.equal(computeCnpjCheckDigits("000000000001"), "91");
});

test("isValidCnpj aceita alfanumérico e numérico, com e sem máscara", () => {
  assert.equal(isValidCnpj("12.ABC.345/01DE-35"), true);
  assert.equal(isValidCnpj("12ABC34501DE35"), true);
  assert.equal(isValidCnpj("12abc34501de35"), true);
  assert.equal(isValidCnpj("00.394.460/0058-87"), true);
  assert.equal(isValidCnpj("00000000000191"), true);
});

test("isValidCnpj rejeita DV errado, tamanho errado e caractere inválido", () => {
  assert.equal(isValidCnpj("12ABC34501DE34"), false, "DV errado");
  assert.equal(isValidCnpj("12ABC34501DE3"), false, "13 posições");
  assert.equal(isValidCnpj("12ABC34501DE355"), false, "15 posições");
  assert.equal(isValidCnpj("12ABC34501DEXY"), false, "DV não numérico");
  assert.equal(isValidCnpj("12-ABC-345/01DE-35!"), true, "separadores são ignorados");
  assert.equal(isValidCnpj("12ÁBC34501DE35"), false, "acento não é caractere de CNPJ");
  assert.equal(isValidCnpj(""), false);
});

test("isValidCnpj rejeita repetição total mesmo quando o DV fecha", () => {
  // 00000000000000 fecha o módulo 11, mas não é CNPJ real.
  assert.equal(isValidCnpj("00000000000000"), false);
  assert.equal(isValidCnpj("AAAAAAAAAAAA00"), false);
});

test("formatCnpj aplica a máscara XX.XXX.XXX/XXXX-DD nos dois formatos", () => {
  assert.equal(formatCnpj("12ABC34501DE35"), "12.ABC.345/01DE-35");
  assert.equal(formatCnpj("00394460005887"), "00.394.460/0058-87");
  assert.equal(formatCnpj("12abc34501de35"), "12.ABC.345/01DE-35");
});

test("formatCnpj devolve a entrada quando não há 14 posições", () => {
  assert.equal(formatCnpj("12ABC"), "12ABC");
  assert.equal(formatCnpj(""), "");
});

test("resolveCnpjForStorage normaliza, trata vazio como null e recusa inválido", () => {
  assert.equal(resolveCnpjForStorage("12.ABC.345/01DE-35"), "12ABC34501DE35");
  assert.equal(resolveCnpjForStorage("00.394.460/0058-87"), "00394460005887");
  assert.equal(resolveCnpjForStorage(""), null);
  assert.equal(resolveCnpjForStorage("   "), null);
  assert.equal(resolveCnpjForStorage(null), null);
  assert.equal(resolveCnpjForStorage(undefined), null);
  assert.throws(() => resolveCnpjForStorage("12ABC34501DE34"), /CNPJ válido/);
  assert.throws(() => resolveCnpjForStorage("123"), /CNPJ válido/);
});

test("maskCnpjInput formata progressivamente durante a digitação", () => {
  assert.equal(maskCnpjInput("12"), "12");
  assert.equal(maskCnpjInput("12A"), "12.A");
  assert.equal(maskCnpjInput("12ABC34"), "12.ABC.34");
  assert.equal(maskCnpjInput("12ABC3450"), "12.ABC.345/0");
  assert.equal(maskCnpjInput("12ABC34501DE3"), "12.ABC.345/01DE-3");
  assert.equal(maskCnpjInput("12ABC34501DE3599"), "12.ABC.345/01DE-35", "descarta excedente");
  assert.equal(maskCnpjInput("12abc"), "12.ABC");
});
