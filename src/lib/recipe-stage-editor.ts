import {
  defaultRecipeStage,
  getRecipeStageInstructions,
  normalizeRecipeStage,
  normalizeRecipeStageConfig,
  recipeStages,
  resolveRecipeStageOrder,
  type RecipeStage,
  type RecipeStageConfigEntry,
} from "@/lib/production-planning";

/**
 * Edição da ficha técnica em BLOCOS por etapa (call 24/07, ficha da cuca do Adriano).
 *
 * O cliente não lê a receita como uma lista plana com uma coluna "Etapa": ele lê
 * "ingredientes", "ingredientes do recheio", "ingredientes para a montagem" — blocos, cada um
 * com seus insumos e seu modo de preparo, numa sequência que a ficha define. Este módulo é a
 * parte PURA dessa edição (agrupar, reordenar item dentro do bloco, mover o bloco inteiro,
 * criar/remover bloco, materializar a config); o componente só liga em eventos.
 *
 * Duas estruturas se combinam:
 *  - `recipe` (array plano, a ordem É o `sort_order` persistido) → ordem DENTRO do bloco;
 *  - `recipeStageConfig` (array ordenado {stage, instructions}) → ordem DOS blocos + o modo
 *    de preparo de cada um.
 *
 * Config vazia = comportamento legado (ordem canônica do enum, sem instrução por etapa), então
 * nenhuma função aqui materializa config à toa: só quando o usuário mexe de fato nos blocos.
 */

/** Mínimo que uma linha de receita precisa ter para ser posicionada por este módulo. */
export interface RecipeStageEditorItem {
  id: string;
  stage?: RecipeStage;
}

/** Um bloco da ficha: cabeçalho (etapa), modo de preparo do bloco e os ingredientes dele. */
export interface RecipeStageBlock<T extends RecipeStageEditorItem = RecipeStageEditorItem> {
  stage: RecipeStage;
  instructions: string;
  items: T[];
}

/**
 * Ordem dos blocos NO CADASTRO — igual à de `resolveRecipeStageOrder(..., includeEmpty)`, com
 * uma diferença: nunca devolve lista vazia. Produto novo (receita vazia, sem config) precisa
 * abrir com um bloco pronto pra receber ingrediente, senão não existe onde clicar em "adicionar".
 * Esse bloco default é `massa`, a mesma etapa das receitas legadas — e como ele não entra na
 * config, o produto continua salvando `recipeStageConfig` vazio enquanto ninguém mexer nos blocos.
 */
export function getRecipeStageBlockOrder(
  config: RecipeStageConfigEntry[] | undefined,
  recipe: RecipeStageEditorItem[],
): RecipeStage[] {
  const order = resolveRecipeStageOrder(config, recipe, { includeEmpty: true });
  return order.length > 0 ? order : [defaultRecipeStage];
}

/** Blocos prontos pra renderizar: etapa, instruções do bloco e os itens daquela etapa em ordem. */
export function getRecipeStageBlocks<T extends RecipeStageEditorItem>(
  config: RecipeStageConfigEntry[] | undefined,
  recipe: T[],
): RecipeStageBlock<T>[] {
  return getRecipeStageBlockOrder(config, recipe).map((stage) => ({
    stage,
    instructions: getRecipeStageInstructions(config, stage),
    items: recipe.filter((item) => normalizeRecipeStage(item.stage) === stage),
  }));
}

/** Etapas que ainda não viraram bloco — as opções do "adicionar etapa". */
export function getAddableRecipeStages(
  config: RecipeStageConfigEntry[] | undefined,
  recipe: RecipeStageEditorItem[],
): RecipeStage[] {
  const visible = new Set(getRecipeStageBlockOrder(config, recipe));
  return recipeStages.filter((stage) => !visible.has(stage));
}

/**
 * Congela a ordem VISÍVEL dos blocos dentro da config, preservando as instruções já digitadas.
 *
 * Necessário antes de qualquer reordenação: numa receita legada a config está vazia e a ordem
 * visível vem do enum; sem materializar, "mover bloco pra cima" não teria o que reordenar.
 */
export function syncRecipeStageConfig(
  config: RecipeStageConfigEntry[] | undefined,
  recipe: RecipeStageEditorItem[],
): RecipeStageConfigEntry[] {
  const normalized = normalizeRecipeStageConfig(config);
  return getRecipeStageBlockOrder(config, recipe).map((stage) => ({
    stage,
    instructions: normalized.find((entry) => entry.stage === stage)?.instructions ?? "",
  }));
}

/** Move o BLOCO inteiro na sequência da ficha (reordena a config, não a receita). */
export function moveRecipeStage(
  config: RecipeStageConfigEntry[] | undefined,
  recipe: RecipeStageEditorItem[],
  stage: RecipeStage,
  direction: "up" | "down",
): RecipeStageConfigEntry[] {
  const synced = syncRecipeStageConfig(config, recipe);
  const currentIndex = synced.findIndex((entry) => entry.stage === stage);
  if (currentIndex === -1) {
    return synced;
  }

  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= synced.length) {
    return synced;
  }

  const next = [...synced];
  const [moved] = next.splice(currentIndex, 1);
  next.splice(nextIndex, 0, moved);
  return next;
}

/** Abre um bloco novo no fim da ficha (etapa que ainda não tem ingrediente nem posição). */
export function addRecipeStage(
  config: RecipeStageConfigEntry[] | undefined,
  recipe: RecipeStageEditorItem[],
  stage: RecipeStage,
): RecipeStageConfigEntry[] {
  const synced = syncRecipeStageConfig(config, recipe);
  if (synced.some((entry) => entry.stage === stage)) {
    return synced;
  }
  return [...synced, { stage, instructions: "" }];
}

/**
 * Bloco só sai da ficha quando está VAZIO — remover com ingrediente dentro apagaria peso da
 * receita por um clique de organização. E o último bloco também não sai: o cadastro voltaria a
 * não ter onde adicionar item (`getRecipeStageBlockOrder` reabriria o bloco default na hora).
 */
export function canRemoveRecipeStage(
  config: RecipeStageConfigEntry[] | undefined,
  recipe: RecipeStageEditorItem[],
  stage: RecipeStage,
): boolean {
  const order = getRecipeStageBlockOrder(config, recipe);
  if (order.length <= 1 || !order.includes(stage)) {
    return false;
  }
  return !recipe.some((item) => normalizeRecipeStage(item.stage) === stage);
}

export function removeRecipeStage(
  config: RecipeStageConfigEntry[] | undefined,
  recipe: RecipeStageEditorItem[],
  stage: RecipeStage,
): RecipeStageConfigEntry[] {
  const synced = syncRecipeStageConfig(config, recipe);
  if (!canRemoveRecipeStage(config, recipe, stage)) {
    return synced;
  }
  return synced.filter((entry) => entry.stage !== stage);
}

/**
 * Modo de preparo DAQUELE bloco. Não confundir com `products.preparation_mode`, que continua
 * sendo a instrução geral do produto — aqui é a instrução que anda junto dos ingredientes.
 *
 * Escrever no bloco materializa a config (a ficha deixou de ser "a default do sistema"), mas
 * digitar e apagar não deixa lixo: instrução vazia num produto sem config volta ao estado vazio.
 */
export function setRecipeStageInstructions(
  config: RecipeStageConfigEntry[] | undefined,
  recipe: RecipeStageEditorItem[],
  stage: RecipeStage,
  instructions: string,
): RecipeStageConfigEntry[] {
  const normalized = normalizeRecipeStageConfig(config);
  if (normalized.length === 0 && !instructions.trim()) {
    return normalized;
  }

  return syncRecipeStageConfig(config, recipe).map((entry) =>
    entry.stage === stage ? { ...entry, instructions } : entry,
  );
}

/**
 * Reordena o ingrediente DENTRO do bloco: troca de lugar com o vizinho da MESMA etapa.
 *
 * A troca é posicional (swap nos dois índices do array plano), então os itens das outras etapas
 * ficam exatamente onde estavam — mover a farinha dentro da massa não pode mexer no recheio.
 */
export function moveRecipeItemWithinStage<T extends RecipeStageEditorItem>(
  recipe: T[],
  itemId: string,
  direction: "up" | "down",
): T[] {
  const currentIndex = recipe.findIndex((item) => item.id === itemId);
  if (currentIndex === -1) {
    return recipe;
  }

  const stage = normalizeRecipeStage(recipe[currentIndex].stage);
  const siblingIndexes = recipe.reduce<number[]>((indexes, item, index) => {
    if (normalizeRecipeStage(item.stage) === stage) {
      indexes.push(index);
    }
    return indexes;
  }, []);

  const position = siblingIndexes.indexOf(currentIndex);
  const nextPosition = direction === "up" ? position - 1 : position + 1;
  if (nextPosition < 0 || nextPosition >= siblingIndexes.length) {
    return recipe;
  }

  const targetIndex = siblingIndexes[nextPosition];
  const next = [...recipe];
  next[currentIndex] = recipe[targetIndex];
  next[targetIndex] = recipe[currentIndex];
  return next;
}

/**
 * Insere o item logo DEPOIS do último da mesma etapa — o novo ingrediente aparece no fim do
 * bloco em que foi criado, e não no fim da receita inteira (que visualmente seria outro bloco).
 */
export function insertRecipeItemInStage<T extends RecipeStageEditorItem>(
  recipe: T[],
  item: T,
): T[] {
  const stage = normalizeRecipeStage(item.stage);
  let lastIndex = -1;
  recipe.forEach((entry, index) => {
    if (normalizeRecipeStage(entry.stage) === stage) {
      lastIndex = index;
    }
  });

  if (lastIndex === -1) {
    return [...recipe, item];
  }

  const next = [...recipe];
  next.splice(lastIndex + 1, 0, item);
  return next;
}

/** Troca o item de bloco: sai de onde estava e entra no fim da etapa de destino. */
export function moveRecipeItemToStage<T extends RecipeStageEditorItem>(
  recipe: T[],
  itemId: string,
  stage: RecipeStage,
): T[] {
  const currentIndex = recipe.findIndex((item) => item.id === itemId);
  if (currentIndex === -1) {
    return recipe;
  }

  // O spread de um genérico devolve `T & { stage }`; a asserção mantém a lista homogênea em T.
  const moved = { ...recipe[currentIndex], stage } as T;
  const remaining = recipe.filter((_, index) => index !== currentIndex);
  return insertRecipeItemInStage(remaining, moved);
}
