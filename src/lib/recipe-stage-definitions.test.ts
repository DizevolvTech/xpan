import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCustomRecipeStageKey,
  defaultCountsTowardMixer,
  getRecipeStageBase,
  getRecipeStageLabel,
  getRecipeStageOrder,
  getRecipeStageVessel,
  listRecipeStageOptions,
  normalizeRecipeStage,
  normalizeRecipeStageConfig,
  recipeStageAddsAfterBake,
  recipeStageCountsTowardDough,
  registerRecipeStageDefinitions,
  resolveRecipeStageOrder,
  type RecipeStageDefinition,
} from "@/lib/production-planning";
import { getAddableRecipeStages } from "@/lib/recipe-stage-editor";

// Cartão #173: etapa "Embalagem" cadastrada pela empresa, seguindo Insumos operacionais.
const embalagem: RecipeStageDefinition = {
  id: "1",
  key: "operacional__embalagem",
  label: "Embalagem",
  baseStage: "operacional",
  active: true,
  sortOrder: 1,
};

test("chave da etapa nova sai do nome, sem acento, e guarda a etapa que ela segue", () => {
  assert.equal(buildCustomRecipeStageKey("operacional", "Embalagem"), "operacional__embalagem");
  assert.equal(buildCustomRecipeStageKey("acabamento", "Decoração Final!"), "acabamento__decoracao_final");
  assert.equal(buildCustomRecipeStageKey("operacional", "   "), null);
});

test("etapa cadastrada é aceita e calcula como a etapa padrão que segue", () => {
  assert.equal(normalizeRecipeStage("operacional__embalagem"), "operacional__embalagem");
  assert.equal(normalizeRecipeStage("xyz__embalagem"), "massa");
  assert.equal(getRecipeStageBase("operacional__embalagem"), "operacional");
  assert.equal(recipeStageCountsTowardDough("operacional__embalagem"), false);
  assert.equal(defaultCountsTowardMixer("operacional__embalagem"), false);
  assert.equal(recipeStageAddsAfterBake("acabamento__glace"), true);
  assert.equal(recipeStageCountsTowardDough("massa__massa_mae"), true);
  assert.equal(getRecipeStageVessel("massa__massa_mae"), "massa");
  assert.equal(getRecipeStageVessel("recheio__creme"), "recheio__creme");
});

test("nome mostrado vem do cadastro; sem cadastro, do próprio nome da chave", () => {
  assert.equal(getRecipeStageLabel("operacional__caixa_presente"), "Caixa presente");
  registerRecipeStageDefinitions([embalagem, { ...embalagem, id: "2", key: "massa", label: "Outro nome" }]);
  assert.equal(getRecipeStageLabel("operacional__embalagem"), "Embalagem");
  // Etapa padrão não muda de nome.
  assert.equal(getRecipeStageLabel("massa"), "Massa");
});

test("opções: padrão na ordem, a cadastrada logo depois da que segue, inativas fora", () => {
  const options = listRecipeStageOptions([
    embalagem,
    { id: "3", key: "montagem", label: "Montagem", baseStage: "montagem", active: false, sortOrder: 0 },
  ]);
  assert.deepEqual(options, ["esponja", "massa", "recheio", "cobertura", "operacional", "operacional__embalagem", "acabamento"]);
  assert.ok(getRecipeStageOrder("operacional__embalagem") > getRecipeStageOrder("operacional"));
  assert.ok(getRecipeStageOrder("operacional__embalagem") < getRecipeStageOrder("acabamento"));
});

test("Adicionar etapa oferece a etapa cadastrada; ficha guarda e ordena o bloco dela", () => {
  const recipe = [{ id: "a", stage: "massa" as const }];
  const options = listRecipeStageOptions([embalagem]);
  assert.ok(getAddableRecipeStages(undefined, recipe, options).includes("operacional__embalagem"));
  const config = normalizeRecipeStageConfig([{ stage: "massa" }, { stage: "operacional__embalagem", instructions: "Embalar" }]);
  assert.deepEqual(config.map((entry) => entry.stage), ["massa", "operacional__embalagem"]);
  assert.deepEqual(
    resolveRecipeStageOrder(undefined, [{ stage: "operacional__embalagem" }, { stage: "massa" }]),
    ["massa", "operacional__embalagem"],
  );
});
