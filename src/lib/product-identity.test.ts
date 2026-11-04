import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeProductCodeSource,
  resolveClientCode,
  getIngredientDisplayCode,
  getProductDisplayCode,
  canonicalGtin,
  checkGtin,
  computeGtinCheckDigit,
  isValidGtin,
  normalizeGtin,
  relabelRecipeLineWithClientCode,
} from "@/lib/product-identity";

test("getProductDisplayCode prefere o código da loja", () => {
  assert.equal(
    getProductDisplayCode({ code: "PR-0001", externalCode: "PDLCH150" }),
    "PDLCH150",
  );
});

test("getProductDisplayCode cai no código interno quando a loja está vazia", () => {
  assert.equal(getProductDisplayCode({ code: "PR-0001", externalCode: "  " }), "PR-0001");
  assert.equal(getProductDisplayCode({ code: "PR-0001" }), "PR-0001");
});

test("normalizeGtin remove tudo que não é dígito", () => {
  assert.equal(normalizeGtin("789.123 4567890"), "7891234567890");
});

test("isValidGtin aceita vazio, EAN-8 e EAN-13 válidos; recusa comprimentos fora do padrão", () => {
  assert.equal(isValidGtin(""), true);
  assert.equal(isValidGtin("96385074"), true);
  assert.equal(isValidGtin("7891000100103"), true);
  assert.equal(isValidGtin("789.1000.100103"), true);
  assert.equal(isValidGtin("12345678"), false);
  assert.equal(isValidGtin("abc"), true);
});

test("getIngredientDisplayCode segue a mesma regra do produto (ERP do cliente primeiro)", () => {
  assert.equal(getIngredientDisplayCode({ code: "IN-149982", externalCode: "ACU-01" }), "ACU-01");
  assert.equal(getIngredientDisplayCode({ code: "IN-149982", externalCode: "" }), "IN-149982");
  assert.equal(getIngredientDisplayCode({ code: "IN-149982" }), "IN-149982");
});

test("relabelRecipeLineWithClientCode troca só o prefixo da fábrica pelo código do cliente", () => {
  assert.equal(
    relabelRecipeLineWithClientCode("IN-149982 · Açúcar refinado", { code: "IN-149982", externalCode: "ACU-01" }),
    "ACU-01 · Açúcar refinado",
  );
});

test("relabelRecipeLineWithClientCode não mexe sem código do cliente, sem prefixo ou sem origem", () => {
  assert.equal(relabelRecipeLineWithClientCode("IN-1 · Sal", { code: "IN-1", externalCode: "" }), "IN-1 · Sal");
  assert.equal(relabelRecipeLineWithClientCode("Farinha de trigo", { code: "IN-1", externalCode: "FAR" }), "Farinha de trigo");
  assert.equal(relabelRecipeLineWithClientCode("IN-9 · Outro", { code: "IN-1", externalCode: "FAR" }), "IN-9 · Outro");
  assert.equal(relabelRecipeLineWithClientCode("IN-1 · Sal", undefined), "IN-1 · Sal");
});

test("resolveClientCode: ERP por padrão; GTIN quando o cliente escolhe; fábrica só se não tem nenhum", () => {
  const item = { code: "PR-1", externalCode: "703936", gtin: "7891234567895" };
  assert.equal(resolveClientCode(item), "703936");
  assert.equal(resolveClientCode(item, "erp"), "703936");
  assert.equal(resolveClientCode(item, "gtin"), "7891234567895");
});

test("resolveClientCode: sem o código escolhido cai no outro do cliente e só no fim na fábrica", () => {
  assert.equal(resolveClientCode({ code: "PR-1", externalCode: "703936", gtin: "" }, "gtin"), "703936");
  assert.equal(resolveClientCode({ code: "PR-1", externalCode: "", gtin: "7891234567895" }, "erp"), "7891234567895");
  assert.equal(resolveClientCode({ code: "PR-1", externalCode: " ", gtin: null }, "gtin"), "PR-1");
  assert.equal(resolveClientCode({ code: "PR-1" }), "PR-1");
});

test("getProductDisplayCode usa o código já resolvido pela configuração do cliente", () => {
  assert.equal(getProductDisplayCode({ code: "PR-1", externalCode: "703936", displayCode: "7891234567895" }), "7891234567895");
  assert.equal(getProductDisplayCode({ code: "PR-1", externalCode: "703936", displayCode: "" }), "703936");
});

test("normalizeProductCodeSource: valor estranho ou ausente vira erp (cliente antigo não muda)", () => {
  assert.equal(normalizeProductCodeSource("gtin"), "gtin");
  assert.equal(normalizeProductCodeSource("erp"), "erp");
  for (const bad of [undefined, null, "", "EAN", 3]) assert.equal(normalizeProductCodeSource(bad), "erp");
});

test("checkGtin: 4256 sem verificador é inválido e sugere 0000000042567", () => {
  const check = checkGtin("4256");
  assert.equal(check.status, "invalid");
  assert.equal(check.status === "invalid" ? check.suggestion : null, "0000000042567");
  assert.equal(checkGtin("0000000042567").status, "valid");
  assert.equal(checkGtin("42567").gtin, "0000000042567");
});

test("checkGtin: EAN-13 e EAN-8 válidos e inválidos", () => {
  assert.equal(checkGtin("7891000100103").status, "valid");
  assert.equal(checkGtin("7891000100104").status, "invalid");
  assert.equal(checkGtin("96385074").status, "valid");
  assert.equal(checkGtin("96385075").status, "invalid");
  assert.equal(checkGtin("12345678901134").status, "invalid");
  assert.equal(checkGtin("").status, "empty");
  assert.equal(computeGtinCheckDigit("400638133393"), 1);
});

test("isValidGtin: legado de 12/14 dígitos só passa se não for alterado", () => {
  assert.equal(isValidGtin("123456789011", "123456789011"), true);
  assert.equal(isValidGtin("123456789011"), false);
  assert.equal(isValidGtin("12345678901134", "12345678901134"), true);
  assert.equal(isValidGtin("12345678901135", "12345678901134"), false);
  assert.equal(canonicalGtin("42567"), "0000000042567");
  assert.equal(canonicalGtin("123456789011"), "123456789011");
});
