import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultRecipeStage,
  getRecipeStageInstructions,
  getRecipeStageOrder,
  hasStagedRecipe,
  normalizeRecipeStage,
  normalizeRecipeStageConfig,
  nonMixerRecipeStages,
  recipeItemCountsTowardMixer,
  recipeStageAddsAfterBake,
  recipeStageCountsTowardDough,
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
    "operacional",
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

test("etapa operacional: fora da massa, da quebra e da masseira; acabamento soma depois do forno", () => {
  assert.equal(normalizeRecipeStage("operacional"), "operacional");
  assert.equal(recipeStageLabels.operacional, "Insumos operacionais");
  assert.equal(nonMixerRecipeStages.includes("operacional"), true);
  assert.equal(recipeItemCountsTowardMixer({ stage: "operacional" }), false);
  // Massa: só operacional e acabamento saem; cobertura/montagem/recheio continuam (não mudam).
  for (const stage of ["esponja", "massa", "recheio", "cobertura", "montagem"] as const) {
    assert.equal(recipeStageCountsTowardDough(stage), true, stage);
  }
  assert.equal(recipeStageCountsTowardDough("operacional"), false);
  assert.equal(recipeStageCountsTowardDough("acabamento"), false);
  assert.equal(recipeStageCountsTowardDough(undefined), true);
  assert.equal(recipeStageAddsAfterBake("acabamento"), true);
  assert.equal(recipeStageAddsAfterBake("operacional"), false);
  assert.equal(recipeStageAddsAfterBake("cobertura"), false);
});

// ── Classe do insumo (MP / ME / MC; MPI é produto) ──────────────────────────────────────────────
import {
  defaultSupplyClass,
  normalizeSupplyClass,
  supplyClassLabels,
  supplyClassStageWarning,
  supplyClasses,
  suggestedRecipeStageForSupplyClass,
} from "./production-planning";

test("classe do insumo: só MP, ME e MC são gravadas; MPI é rótulo de produto", () => {
  assert.deepEqual(supplyClasses, ["MP", "ME", "MC"]);
  assert.equal(supplyClassLabels.MPI, "Matéria-prima intermediária");
  assert.equal(supplyClassLabels.ME, "Material de embalagem");
  assert.equal(supplyClassLabels.MC, "Material de consumo");
  assert.equal(supplyClassLabels.MP, "Matéria-prima");
});

test("classe do insumo: valor desconhecido, vazio ou MPI cai em MP (nunca quebra o cadastro antigo)", () => {
  // Valor literal "MP": o insumo que já existe é matéria-prima. Comparar só com a constante
  // não pegaria a troca do padrão.
  assert.equal(defaultSupplyClass, "MP");
  for (const value of [undefined, null, "", "mp", "MPI", "XX", 3, {}]) {
    assert.equal(normalizeSupplyClass(value), "MP", String(value));
  }
  assert.equal(normalizeSupplyClass("ME"), "ME");
  assert.equal(normalizeSupplyClass("MC"), "MC");
  assert.equal(normalizeSupplyClass("MP"), "MP");
});

test("classe do insumo: ME e MC sugerem a etapa operacional; MP não sugere nada", () => {
  assert.equal(suggestedRecipeStageForSupplyClass("ME"), "operacional");
  assert.equal(suggestedRecipeStageForSupplyClass("MC"), "operacional");
  assert.equal(suggestedRecipeStageForSupplyClass("MP"), null);
  assert.equal(suggestedRecipeStageForSupplyClass(undefined), null);
});

test("aviso de etapa: ME/MC em etapa de massa avisa; fora da massa ou MP não avisa", () => {
  // Toda etapa que conta como massa na quebra (inclui recheio, cobertura e montagem) avisa.
  for (const stage of ["esponja", "massa", "recheio", "cobertura", "montagem"] as const) {
    assert.match(supplyClassStageWarning("ME", stage) ?? "", /Material de embalagem.*massa.*quebra.*batida/, stage);
    assert.match(supplyClassStageWarning("MC", stage) ?? "", /Material de consumo/, stage);
  }
  assert.match(supplyClassStageWarning("ME", "massa") ?? "", /Insumos operacionais/);
  // Só as etapas que já ficam fora da massa não avisam.
  for (const stage of ["operacional", "acabamento"] as const) {
    assert.equal(supplyClassStageWarning("ME", stage), null, `ME em ${stage}`);
  }
  assert.equal(supplyClassStageWarning("MP", "massa"), null);
  assert.equal(supplyClassStageWarning(undefined, "massa"), null);
});
