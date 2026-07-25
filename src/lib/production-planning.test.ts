import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultRecipeStage,
  getRecipeStageInstructions,
  getRecipeStageOrder,
  hasStagedRecipe,
  normalizeRecipeStage,
  normalizeRecipeStageConfig,
  recipeStageLabels,
  recipeStages,
  resolveRecipeStageOrder,
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

/* -------------------------------------------------------------------------------------------------
 * Sequenciamento das etapas + modo de preparo por bloco (gestão de receita, ponto do Adriano).
 * -----------------------------------------------------------------------------------------------*/

test("ordem das etapas segue a CONFIG do produto, não a ordem canônica do enum", () => {
  // Cuca: montagem antes de cobertura, porque a ficha manda assim.
  const config = [
    { stage: "massa" as const, instructions: "Sovar 8 min." },
    { stage: "montagem" as const, instructions: "Rechear." },
    { stage: "cobertura" as const, instructions: "Farofa por cima." },
  ];
  const recipe = [
    { stage: "cobertura" as const },
    { stage: "massa" as const },
    { stage: "montagem" as const },
  ];

  assert.deepEqual(resolveRecipeStageOrder(config, recipe), ["massa", "montagem", "cobertura"]);
});

test("etapa com ingrediente mas fora da config entra depois, na ordem do enum — nunca some", () => {
  const config = [{ stage: "montagem" as const, instructions: "" }];
  const recipe = [
    { stage: "montagem" as const },
    { stage: "recheio" as const },
    { stage: "esponja" as const },
  ];

  // Configurada primeiro; o resto na ordem canônica (esponja vem antes de recheio).
  assert.deepEqual(resolveRecipeStageOrder(config, recipe), ["montagem", "esponja", "recheio"]);
});

test("sem config, cai na ordem canônica do enum (receita legada)", () => {
  const recipe = [{ stage: "cobertura" as const }, { stage: "massa" as const }];

  assert.deepEqual(resolveRecipeStageOrder(undefined, recipe), ["massa", "cobertura"]);
  assert.deepEqual(resolveRecipeStageOrder([], recipe), ["massa", "cobertura"]);
});

test("includeEmpty traz o bloco configurado ainda sem ingrediente (o cadastro precisa dele)", () => {
  const config = [
    { stage: "massa" as const, instructions: "" },
    { stage: "recheio" as const, instructions: "" },
  ];
  const recipe = [{ stage: "massa" as const }];

  assert.deepEqual(resolveRecipeStageOrder(config, recipe), ["massa"]);
  assert.deepEqual(resolveRecipeStageOrder(config, recipe, { includeEmpty: true }), [
    "massa",
    "recheio",
  ]);
});

test("normalizeRecipeStageConfig descarta lixo e etapa repetida, preservando a ordem", () => {
  const normalized = normalizeRecipeStageConfig([
    { stage: "massa", instructions: "primeira" },
    { stage: "inexistente", instructions: "ignorada" },
    null,
    "texto solto",
    { stage: "massa", instructions: "duplicata ignorada" },
    { stage: "recheio" },
  ]);

  assert.deepEqual(normalized, [
    { stage: "massa", instructions: "primeira" },
    { stage: "recheio", instructions: "" },
  ]);
  assert.deepEqual(normalizeRecipeStageConfig("não é array"), []);
});

test("instruções são resolvidas por etapa e vazias quando não configuradas", () => {
  const config = [{ stage: "esponja" as const, instructions: "Fermentar 12h." }];

  assert.equal(getRecipeStageInstructions(config, "esponja"), "Fermentar 12h.");
  assert.equal(getRecipeStageInstructions(config, "massa"), "");
  assert.equal(getRecipeStageInstructions(undefined, "massa"), "");
});
