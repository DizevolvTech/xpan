import assert from "node:assert/strict";
import test from "node:test";

import {
  getProductDisplayCode,
  isValidGtin,
  normalizeGtin,
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

test("isValidGtin aceita vazio e comprimentos EAN/UPC/GTIN", () => {
  assert.equal(isValidGtin(""), true);
  assert.equal(isValidGtin("12345670"), true);
  assert.equal(isValidGtin("123456789012"), true);
  assert.equal(isValidGtin("1234567890123"), true);
  assert.equal(isValidGtin("12345678901234"), true);
  assert.equal(isValidGtin("123"), false);
  assert.equal(isValidGtin("abc"), false);
  assert.equal(isValidGtin("789.1234.567890"), true);
});
