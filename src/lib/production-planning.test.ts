import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultRecipeStage,
  getRecipeStageOrder,
  hasStagedRecipe,
  normalizeRecipeStage,
  recipeStageLabels,
  recipeStages,
} from "@/lib/production-planning";

test("etapa da receita: ordem canônica é a do próprio enum (sem coluna de ordem)", () => {
  assert.deepEqual(recipeStages, [
    "esponja",
    "massa",
    "recheio",
    "cobertura",
    "acabamento",
    "montagem",
  ]);
  assert.equal(getRecipeStageOrder("esponja") < getRecipeStageOrder("massa"), true);
  assert.equal(getRecipeStageOrder("cobertura") < getRecipeStageOrder("acabamento"), true);
  assert.equal(getRecipeStageOrder("montagem"), recipeStages.length - 1);
});

test("etapa da receita: todo valor tem rótulo em português", () => {
  assert.deepEqual(Object.keys(recipeStageLabels).sort(), [...recipeStages].sort());
  assert.equal(recipeStageLabels.esponja, "Esponja / Pré-fermento");
  assert.equal(recipeStageLabels.acabamento, "Decoração / Acabamento");
});

test("normalizeRecipeStage: valor desconhecido/ausente cai na etapa legada (massa)", () => {
  assert.equal(defaultRecipeStage, "massa");
  assert.equal(normalizeRecipeStage(undefined), "massa");
  assert.equal(normalizeRecipeStage(null), "massa");
  assert.equal(normalizeRecipeStage("cobertura_final"), "massa");
  assert.equal(normalizeRecipeStage("recheio"), "recheio");
  assert.equal(getRecipeStageOrder(undefined), getRecipeStageOrder("massa"));
});

test("hasStagedRecipe: só é migrado quando existe linha fora de massa", () => {
  assert.equal(hasStagedRecipe([]), false);
  assert.equal(hasStagedRecipe([{ stage: "massa" }, { stage: undefined }]), false);
  assert.equal(hasStagedRecipe([{ stage: "massa" }, { stage: "recheio" }]), true);
});
