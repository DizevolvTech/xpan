import assert from "node:assert/strict";
import test from "node:test";

import { isTestEnvironmentHost } from "./test-environment";

test("faixa de teste aparece no endereço do sistema de teste", () => {
  assert.equal(isTestEnvironmentHost("preview-xpan.dizevolv.com"), true);
  assert.equal(isTestEnvironmentHost("teste-xpan.dizevolv.com"), true);
});

test("faixa de teste nunca aparece na produção", () => {
  assert.equal(isTestEnvironmentHost("xpan.dizevolv.com"), false);
  assert.equal(isTestEnvironmentHost(""), false);
  assert.equal(isTestEnvironmentHost(null), false);
});
