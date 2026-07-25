import assert from "node:assert/strict";
import test from "node:test";

import { type RecipeStage, type RecipeStageConfigEntry } from "@/lib/production-planning";
import {
  addRecipeStage,
  canRemoveRecipeStage,
  getAddableRecipeStages,
  getRecipeStageBlockOrder,
  getRecipeStageBlocks,
  insertRecipeItemInStage,
  moveRecipeItemToStage,
  moveRecipeItemWithinStage,
  moveRecipeStage,
  removeRecipeStage,
  setRecipeStageInstructions,
  syncRecipeStageConfig,
} from "@/lib/recipe-stage-editor";

type Item = { id: string; stage?: RecipeStage };

/** Ficha da cuca do Adriano: massa → recheio → montagem, com farofa por cima. */
const cucaRecipe: Item[] = [
  { id: "farinha-massa", stage: "massa" },
  { id: "ovo", stage: "massa" },
  { id: "acucar-recheio", stage: "recheio" },
  { id: "canela", stage: "recheio" },
  { id: "farofa", stage: "montagem" },
];
const cucaConfig: RecipeStageConfigEntry[] = [
  { stage: "massa", instructions: "Sovar 8 min." },
  { stage: "recheio", instructions: "Misturar açúcar e canela." },
  { stage: "montagem", instructions: "Rechear e cobrir com farofa." },
];

/* -------------------------------------------------------------------------------------------------
 * Blocos: o que a tela renderiza
 * -----------------------------------------------------------------------------------------------*/

test("blocos saem na ordem da config, com as instruções e os itens de cada etapa", () => {
  const blocks = getRecipeStageBlocks(cucaConfig, cucaRecipe);

  assert.deepEqual(
    blocks.map((block) => block.stage),
    ["massa", "recheio", "montagem"],
  );
  assert.equal(blocks[1].instructions, "Misturar açúcar e canela.");
  assert.deepEqual(
    blocks[1].items.map((item) => item.id),
    ["acucar-recheio", "canela"],
  );
});

test("RETROCOMPAT: produto legado (tudo em massa, sem config) abre num bloco Massa único", () => {
  const legacy: Item[] = [{ id: "farinha" }, { id: "fermento" }, { id: "sal", stage: "massa" }];

  const blocks = getRecipeStageBlocks(undefined, legacy);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].stage, "massa");
  assert.equal(blocks[0].instructions, "");
  // Mesma ordem da receita de hoje — o bloco não reordena nada.
  assert.deepEqual(
    blocks[0].items.map((item) => item.id),
    ["farinha", "fermento", "sal"],
  );
});

test("produto novo (receita vazia, sem config) abre com o bloco default pra receber item", () => {
  assert.deepEqual(getRecipeStageBlockOrder([], []), ["massa"]);
  const blocks = getRecipeStageBlocks([], []);
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0].items, []);
});

test("bloco configurado sem ingrediente continua na tela; etapa fora da config entra depois", () => {
  const config: RecipeStageConfigEntry[] = [
    { stage: "montagem", instructions: "" },
    { stage: "cobertura", instructions: "" },
  ];
  const recipe: Item[] = [{ id: "farinha", stage: "massa" }, { id: "farofa", stage: "montagem" }];

  // montagem/cobertura porque a config manda (cobertura ainda vazia), massa depois (enum).
  assert.deepEqual(getRecipeStageBlockOrder(config, recipe), ["montagem", "cobertura", "massa"]);
  assert.deepEqual(getAddableRecipeStages(config, recipe), ["esponja", "recheio", "acabamento"]);
});

/* -------------------------------------------------------------------------------------------------
 * Sequenciamento dos blocos
 * -----------------------------------------------------------------------------------------------*/

test("mover bloco reordena a config e preserva as instruções digitadas", () => {
  const next = moveRecipeStage(cucaConfig, cucaRecipe, "montagem", "up");

  assert.deepEqual(next, [
    { stage: "massa", instructions: "Sovar 8 min." },
    { stage: "montagem", instructions: "Rechear e cobrir com farofa." },
    { stage: "recheio", instructions: "Misturar açúcar e canela." },
  ]);
  assert.deepEqual(
    getRecipeStageBlocks(next, cucaRecipe).map((block) => block.stage),
    ["massa", "montagem", "recheio"],
  );
});

test("mover bloco de receita SEM config materializa a ordem visível antes de trocar", () => {
  const recipe: Item[] = [{ id: "farinha", stage: "massa" }, { id: "farofa", stage: "cobertura" }];

  const next = moveRecipeStage(undefined, recipe, "cobertura", "up");
  assert.deepEqual(next, [
    { stage: "cobertura", instructions: "" },
    { stage: "massa", instructions: "" },
  ]);
});

test("mover bloco no limite não muda a sequência (só materializa)", () => {
  assert.deepEqual(moveRecipeStage(cucaConfig, cucaRecipe, "massa", "up"), cucaConfig);
  assert.deepEqual(moveRecipeStage(cucaConfig, cucaRecipe, "montagem", "down"), cucaConfig);
});

test("adicionar etapa abre bloco vazio no fim; etapa já visível não duplica", () => {
  const withStage = addRecipeStage(cucaConfig, cucaRecipe, "esponja");
  assert.deepEqual(
    withStage.map((entry) => entry.stage),
    ["massa", "recheio", "montagem", "esponja"],
  );
  assert.deepEqual(addRecipeStage(cucaConfig, cucaRecipe, "recheio"), cucaConfig);

  // O bloco novo aparece na tela mesmo sem ingrediente — senão não haveria onde adicionar.
  const blocks = getRecipeStageBlocks(withStage, cucaRecipe);
  assert.equal(blocks[3].stage, "esponja");
  assert.deepEqual(blocks[3].items, []);
});

test("remover etapa só vale pro bloco vazio — e nunca pro último bloco da ficha", () => {
  const config = addRecipeStage(cucaConfig, cucaRecipe, "esponja");

  assert.equal(canRemoveRecipeStage(config, cucaRecipe, "esponja"), true);
  assert.deepEqual(
    removeRecipeStage(config, cucaRecipe, "esponja").map((entry) => entry.stage),
    ["massa", "recheio", "montagem"],
  );

  // Bloco com ingrediente dentro não sai: apagaria peso da receita num clique de organização.
  assert.equal(canRemoveRecipeStage(config, cucaRecipe, "recheio"), false);
  assert.deepEqual(removeRecipeStage(config, cucaRecipe, "recheio"), config);

  // Último bloco também não sai (o cadastro ficaria sem onde adicionar item).
  assert.equal(canRemoveRecipeStage([], [], "massa"), false);
  assert.deepEqual(removeRecipeStage([], [], "massa"), [{ stage: "massa", instructions: "" }]);
});

/* -------------------------------------------------------------------------------------------------
 * Modo de preparo por bloco
 * -----------------------------------------------------------------------------------------------*/

test("instrução vai pro bloco certo e congela a ordem visível da ficha", () => {
  const recipe: Item[] = [{ id: "farinha", stage: "massa" }, { id: "farofa", stage: "cobertura" }];

  const next = setRecipeStageInstructions(undefined, recipe, "cobertura", "Esfarelar na mão.");
  assert.deepEqual(next, [
    { stage: "massa", instructions: "" },
    { stage: "cobertura", instructions: "Esfarelar na mão." },
  ]);
});

test("RETROCOMPAT: digitar e apagar num produto sem config não deixa config sobrando", () => {
  const legacy: Item[] = [{ id: "farinha" }];

  assert.deepEqual(setRecipeStageInstructions([], legacy, "massa", ""), []);
  assert.deepEqual(setRecipeStageInstructions(undefined, legacy, "massa", "   "), []);
});

/* -------------------------------------------------------------------------------------------------
 * Sequenciamento dos ingredientes dentro do bloco
 * -----------------------------------------------------------------------------------------------*/

test("mover item dentro do bloco troca com o vizinho da MESMA etapa", () => {
  const next = moveRecipeItemWithinStage(cucaRecipe, "canela", "up");

  assert.deepEqual(
    getRecipeStageBlocks(cucaConfig, next)[1].items.map((item) => item.id),
    ["canela", "acucar-recheio"],
  );
});

test("mover item dentro do bloco não bagunça as outras etapas", () => {
  // ovo (massa, índice 1) sobe: troca com farinha (massa, índice 0). Recheio/montagem intactos.
  const next = moveRecipeItemWithinStage(cucaRecipe, "ovo", "up");

  assert.deepEqual(
    next.map((item) => item.id),
    ["ovo", "farinha-massa", "acucar-recheio", "canela", "farofa"],
  );
});

test("mover item intercalado pula os itens de outra etapa no array plano", () => {
  // Array plano intercalado (receita antiga, editada aos poucos): massa, recheio, massa.
  const recipe: Item[] = [
    { id: "farinha", stage: "massa" },
    { id: "creme", stage: "recheio" },
    { id: "sal", stage: "massa" },
  ];

  const next = moveRecipeItemWithinStage(recipe, "sal", "up");
  assert.deepEqual(
    next.map((item) => item.id),
    ["sal", "creme", "farinha"],
  );
  // O recheio segue na mesma posição — a troca é entre os dois itens de massa.
  assert.equal(next[1].id, "creme");
});

test("mover item no topo/fim do bloco não faz nada (mesmo com outra etapa em volta)", () => {
  assert.deepEqual(moveRecipeItemWithinStage(cucaRecipe, "farinha-massa", "up"), cucaRecipe);
  assert.deepEqual(moveRecipeItemWithinStage(cucaRecipe, "canela", "down"), cucaRecipe);
  assert.deepEqual(moveRecipeItemWithinStage(cucaRecipe, "farofa", "up"), cucaRecipe);
  assert.deepEqual(moveRecipeItemWithinStage(cucaRecipe, "inexistente", "down"), cucaRecipe);
});

test("item novo entra no fim do bloco em que foi criado, não no fim da receita", () => {
  const next = insertRecipeItemInStage(cucaRecipe, { id: "leite", stage: "massa" });

  assert.deepEqual(
    next.map((item) => item.id),
    ["farinha-massa", "ovo", "leite", "acucar-recheio", "canela", "farofa"],
  );
});

test("item de etapa ainda sem bloco preenchido vai pro fim do array", () => {
  const next = insertRecipeItemInStage(cucaRecipe, { id: "acucar-cobertura", stage: "cobertura" });

  assert.equal(next[next.length - 1].id, "acucar-cobertura");
});

test("RETROCOMPAT: item novo em receita legada continua sendo apenas um append", () => {
  const legacy: Item[] = [{ id: "farinha" }, { id: "sal" }];

  assert.deepEqual(
    insertRecipeItemInStage(legacy, { id: "fermento", stage: "massa" }).map((item) => item.id),
    ["farinha", "sal", "fermento"],
  );
});

test("trocar o item de bloco leva ele pro fim da etapa de destino", () => {
  const next = moveRecipeItemToStage(cucaRecipe, "ovo", "recheio");

  assert.deepEqual(
    next.map((item) => item.id),
    ["farinha-massa", "acucar-recheio", "canela", "ovo", "farofa"],
  );
  assert.deepEqual(
    getRecipeStageBlocks(cucaConfig, next).map((block) => block.items.map((item) => item.id)),
    [["farinha-massa"], ["acucar-recheio", "canela", "ovo"], ["farofa"]],
  );
});

/* -------------------------------------------------------------------------------------------------
 * Config materializada
 * -----------------------------------------------------------------------------------------------*/

test("syncRecipeStageConfig congela exatamente a ordem visível dos blocos", () => {
  const config: RecipeStageConfigEntry[] = [{ stage: "montagem", instructions: "Montar." }];
  const recipe: Item[] = [{ id: "farofa", stage: "montagem" }, { id: "farinha", stage: "massa" }];

  const synced = syncRecipeStageConfig(config, recipe);
  assert.deepEqual(synced, [
    { stage: "montagem", instructions: "Montar." },
    { stage: "massa", instructions: "" },
  ]);
  // Materializar não pode mudar o que a tela mostra.
  assert.deepEqual(getRecipeStageBlockOrder(synced, recipe), getRecipeStageBlockOrder(config, recipe));
});

test("RETROCOMPAT: fluxo legado inteiro sem tocar em bloco mantém config vazia", () => {
  // Abrir produto legado, adicionar um ingrediente na massa e salvar: nada de config nova.
  let config: RecipeStageConfigEntry[] = [];
  let recipe: Item[] = [{ id: "farinha" }, { id: "sal" }];

  recipe = insertRecipeItemInStage(recipe, { id: "fermento", stage: "massa" });
  recipe = moveRecipeItemWithinStage(recipe, "fermento", "up");
  config = setRecipeStageInstructions(config, recipe, "massa", "");

  assert.deepEqual(config, []);
  assert.deepEqual(
    recipe.map((item) => item.id),
    ["farinha", "fermento", "sal"],
  );
  assert.deepEqual(getRecipeStageBlockOrder(config, recipe), ["massa"]);
});
