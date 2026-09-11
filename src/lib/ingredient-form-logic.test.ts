import assert from "node:assert/strict";
import test from "node:test";

import {
  findDuplicateExternalCode,
  validateIngredientFormState,
} from "@/lib/ingredient-form-logic";

test("validateIngredientFormState exige código ERP antes do nome", () => {
  const result = validateIngredientFormState({ name: "", externalCode: "" });
  assert.equal(result.error, "Informe o código ERP do cliente antes de continuar o cadastro.");
  assert.deepEqual(result.invalidFields, ["externalCode", "name"]);
});

test("validateIngredientFormState avisa duplicidade imediatamente", () => {
  const result = validateIngredientFormState(
    { name: "Farinha", externalCode: "ERP-01" },
    { duplicateExternalCode: true },
  );
  assert.equal(
    result.error,
    "Este código ERP já está cadastrado. Informe outro código para continuar.",
  );
  assert.deepEqual(result.invalidFields, ["externalCode"]);
});

test("validateIngredientFormState não exige ERP na edição de cadastro legado", () => {
  const result = validateIngredientFormState(
    { name: "Farinha", externalCode: "" },
    { requireExternalCode: false },
  );
  assert.equal(result.error, null);
  assert.deepEqual(result.invalidFields, []);
});

test("findDuplicateExternalCode ignora o próprio registro e compara sem case", () => {
  const catalog = [
    { id: "a", externalCode: "erp-01" },
    { id: "b", externalCode: "ERP-02" },
  ];

  assert.equal(findDuplicateExternalCode("ERP-01", catalog, "a"), null);
  assert.equal(findDuplicateExternalCode("erp-02", catalog, "a")?.id, "b");
  assert.equal(findDuplicateExternalCode("   ", catalog), null);
});
