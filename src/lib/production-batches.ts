import type { ProductionItemStatus } from "@/lib/factory-planning/types";
import { getRecipeStageVessel, recipeItemCountsTowardMixer, type RecipeStage } from "@/lib/production-planning";

export interface BatchPlan {
  batchCount: number;
  /** Tamanho de cada batida na unidade de venda (enche + sobra na última). */
  batchSizes: number[];
  /** Rótulo da unidade de venda (ex.: "Un", "Kg"). */
  unitLabel: string;
}

export interface PlanBatchesInput {
  totalKg: number;
  capacityPerBatch: number | null;
  salesToKgFactor: number;
  salesUnit: string;
}

/**
 * Calcula o plano de batidas de um item de OP.
 * - Converte o total (kg) para a unidade de venda via salesToKgFactor.
 * - Sem capacidade (null/<=0) → 1 batida com o total.
 * - Com capacidade → enche cada batida até o máximo; a última leva a sobra.
 */
export function planBatches(input: PlanBatchesInput): BatchPlan {
  const { totalKg, capacityPerBatch, salesToKgFactor, salesUnit } = input;
  const factor = salesToKgFactor > 0 ? salesToKgFactor : 1;
  const totalUnits = Math.max(0, Math.round(totalKg / factor));

  if (!capacityPerBatch || capacityPerBatch <= 0) {
    return { batchCount: 1, batchSizes: [totalUnits], unitLabel: salesUnit };
  }

  const cap = Math.floor(capacityPerBatch);
  if (!Number.isFinite(cap) || cap < 1) throw new Error("Capacidade da batida deve comportar pelo menos uma unidade inteira.");
  const batchCount = Math.max(1, Math.ceil(totalUnits / cap));
  const batchSizes: number[] = [];
  let remaining = totalUnits;
  for (let i = 0; i < batchCount; i += 1) {
    const size = Math.min(cap, remaining);
    batchSizes.push(size);
    remaining -= size;
  }
  return { batchCount, batchSizes, unitLabel: salesUnit };
}

export interface PreWeighBatchSplit {
  /** true quando o produto é batido (capacityPerBatch > 0). */
  batched: boolean;
  /** nº de batidas CHEIAS. */
  fullBatchCount: number;
  /** unidades por batida cheia (= floor(capacityPerBatch)); 0 se não batido. */
  fullBatchUnits: number;
  /** kg de saída de UMA batida cheia. */
  fullBatchKg: number;
  /** unidades da parcial (resto); 0 se não há parcial. */
  partialUnits: number;
  /** kg de saída da parcial. */
  partialKg: number;
  /** total em unidades de venda. */
  totalUnits: number;
  unitLabel: string;
}

/**
 * Desdobra o total de um item de OP em batidas CHEIAS + uma PARCIAL (resto),
 * espelhando a matemática de `planBatches` (mesma conversão kg→un e mesmo cap).
 */
export function computePreWeighBatchSplit(input: PlanBatchesInput): PreWeighBatchSplit {
  const { totalKg, capacityPerBatch, salesToKgFactor, salesUnit } = input;
  const factor = salesToKgFactor > 0 ? salesToKgFactor : 1;
  const totalUnits = Math.max(0, Math.round(totalKg / factor));
  if (!capacityPerBatch || capacityPerBatch <= 0) {
    return { batched: false, fullBatchCount: 0, fullBatchUnits: 0, fullBatchKg: 0, partialUnits: totalUnits, partialKg: totalKg, totalUnits, unitLabel: salesUnit };
  }
  const cap = Math.floor(capacityPerBatch);
  if (!Number.isFinite(cap) || cap < 1) throw new Error("Capacidade da batida deve comportar pelo menos uma unidade inteira.");
  const fullBatchCount = Math.floor(totalUnits / cap);
  const partialUnits = totalUnits - fullBatchCount * cap;
  return { batched: true, fullBatchCount, fullBatchUnits: cap, fullBatchKg: Number((cap * factor).toFixed(3)), partialUnits, partialKg: Number((partialUnits * factor).toFixed(3)), totalUnits, unitLabel: salesUnit };
}

function formatBatchAmount(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

/**
 * Frase da OP/pré-pesagem no formato da planilha Chama: "3 cheias de 1200 Un + 1 parcial de 519 Un".
 * `measure: "kg"` é a língua da dosimetria (kg de cada MP / da carga).
 */
export function formatBatchSplitPhrase(
  split: PreWeighBatchSplit,
  measure: "units" | "kg" = "units",
): string {
  const amount = (units: number, kg: number) =>
    measure === "kg" ? `${formatBatchAmount(kg)} kg` : `${formatBatchAmount(units)} ${split.unitLabel}`;

  if (!split.batched) {
    return `1 corrida de ${amount(split.totalUnits, split.partialKg || split.totalUnits)}`;
  }

  const parts: string[] = [];
  if (split.fullBatchCount > 0) {
    const word = split.fullBatchCount === 1 ? "cheia" : "cheias";
    parts.push(`${split.fullBatchCount} ${word} de ${amount(split.fullBatchUnits, split.fullBatchKg)}`);
  }
  if (split.partialUnits > 0) {
    parts.push(`1 parcial de ${amount(split.partialUnits, split.partialKg)}`);
  }
  return parts.join(" + ");
}

/** Mesma frase a partir dos tamanhos já planejados (`planBatches.batchSizes`). */
export function formatBatchSizesPhrase(batchSizes: number[], unitLabel: string): string {
  if (batchSizes.length === 0) {
    return "";
  }
  if (batchSizes.length === 1) {
    return `1 corrida de ${formatBatchAmount(batchSizes[0])} ${unitLabel}`;
  }
  const cap = Math.max(...batchSizes);
  const fullCount = batchSizes.filter((size) => size === cap).length;
  const partial = batchSizes.find((size) => size < cap) ?? 0;
  return formatBatchSplitPhrase({
    batched: true,
    fullBatchCount: fullCount,
    fullBatchUnits: cap,
    fullBatchKg: cap,
    partialUnits: partial,
    partialKg: partial,
    totalUnits: batchSizes.reduce((sum, size) => sum + size, 0),
    unitLabel,
  });
}

/**
 * Fator kg por unidade de venda. Prefere o peso cadastrado no perfil (Un = 170 g do pão de ló)
 * quando `salesToKgFactor` ficou no default 1.
 */
export function productSalesToKgFactor(product: {
  salesUnit: string;
  salesToKgFactor: number;
  unitProfiles: { sales: { unit: string; weightKg: number } };
}): number {
  if (product.salesUnit === "Kg" || product.salesUnit === "L") {
    return 1;
  }
  const profileKg = product.unitProfiles.sales.weightKg;
  if (Number.isFinite(profileKg) && profileKg > 0 && profileKg !== 1) {
    return profileKg;
  }
  return product.salesToKgFactor > 0 ? product.salesToKgFactor : 1;
}

/** Kg de uma batida cheia = capacidade × peso da Un. É a base econômica unificada (S2.1). */
export function deriveEconomicProductionKg(
  capacityPerBatch: number | null | undefined,
  salesToKgFactor: number,
): number {
  if (capacityPerBatch == null || capacityPerBatch <= 0) {
    return 0;
  }
  const factor = salesToKgFactor > 0 ? salesToKgFactor : 1;
  return Number((capacityPerBatch * factor).toFixed(3));
}

/** Status efetivo de um produto batido a partir do nº de batidas concluídas. */
export function deriveBatchStatus(batchesDone: number, batchCount: number): ProductionItemStatus {
  if (batchesDone <= 0) return "nao_iniciado";
  if (batchesDone >= batchCount) return "concluido";
  return "em_producao";
}

/**
 * XPAN-8 — Deriva a capacidade por batida (em unidades de venda) a partir do limite
 * físico do ingrediente principal (ex.: kg de trigo que a masseira comporta).
 *
 * A receita base usa `mainIngredientKgInRecipe` do ingrediente principal e rende
 * `recipeYieldUnits` unidades de venda. Se a masseira comporta `mainIngredientLimitKg`
 * do ingrediente principal, a batida escala a receita por (limite / kgNaReceita) e
 * rende: limite × rendimento / kgNaReceita unidades (arredondado p/ baixo).
 *
 * Retorna `null` quando os insumos são inválidos (zero/negativos) ou o resultado
 * seria < 1 unidade — nesse caso o limite é pequeno demais para uma batida viável.
 */
export function deriveCapacityPerBatchFromMainIngredient(input: {
  mainIngredientKgInRecipe: number;
  recipeYieldUnits: number;
  mainIngredientLimitKg: number;
}): number | null {
  const { mainIngredientKgInRecipe, recipeYieldUnits, mainIngredientLimitKg } = input;

  if (
    !Number.isFinite(mainIngredientKgInRecipe) ||
    mainIngredientKgInRecipe <= 0 ||
    !Number.isFinite(recipeYieldUnits) ||
    recipeYieldUnits <= 0 ||
    !Number.isFinite(mainIngredientLimitKg) ||
    mainIngredientLimitKg <= 0
  ) {
    return null;
  }

  const capacity = Math.floor(
    (mainIngredientLimitKg * recipeYieldUnits) / mainIngredientKgInRecipe,
  );

  return capacity >= 1 ? capacity : null;
}

/**
 * XPAN-8 — Orquestra a derivação a partir da RECEITA do produto: acha o ingrediente
 * marcado como principal (`isMain`), exige que ele esteja em Kg (para casar com o
 * limite físico em kg da masseira) e delega para `deriveCapacityPerBatchFromMainIngredient`.
 *
 * Este é o único ponto que a UI (e futuros consumidores) chamam. Retorna `null` quando:
 * - `mainIngredientLimitKg` não está definido (não dá para derivar → capacidade manual);
 * - nenhum ingrediente da receita está marcado como principal;
 * - o ingrediente principal não está em Kg (sem conversão automática — evita cálculo errado);
 * - o rendimento/quantidade são inválidos ou o resultado seria < 1 unidade.
 */
export function deriveCapacityFromProductRecipe(input: {
  recipe: Array<{
    unit: string;
    quantity: number;
    isMain?: boolean;
    sourceType?: string;
    sourceId?: string;
    stage?: RecipeStage;
    countsTowardMixer?: boolean;
  }>;
  recipeYieldUnits: number;
  mainIngredientLimitKg: number | null | undefined;
}): number | null {
  const { recipe, recipeYieldUnits, mainIngredientLimitKg } = input;

  if (mainIngredientLimitKg == null || !Number.isFinite(mainIngredientLimitKg) || mainIngredientLimitKg <= 0) {
    return null;
  }

  const mainItem = recipe.find((item) => item.isMain);
  if (!mainItem || mainItem.unit !== "Kg") {
    return null;
  }

  // O limite é FÍSICO: quanto do ingrediente principal cabe num carregamento da masseira.
  // Logo o que importa é o maior volume presente em UM MESMO recipiente de cada vez — não o
  // total da ficha nem uma linha isolada.
  //
  //  - Somar tudo subdimensiona a batida quando as etapas são tigelas separadas. Caso real
  //    da call: cuca com farofa — farinha na massa E farinha na farofa de cobertura, que
  //    nunca se encontram.
  //  - Contar só a linha marcada superdimensiona quando as etapas convergem: a esponja é
  //    batida à parte, fermenta e depois entra INTEIRA na massa, então a massa final carrega
  //    a farinha das duas linhas — e a batida estouraria a masseira.
  //
  // Por isso agrupamos por RECIPIENTE, somamos dentro do grupo e tomamos o MAIOR grupo.
  // Receita legada (tudo em `massa`) cai num grupo só → resultado idêntico ao de antes.
  const kgByVessel = new Map<string, number>();
  for (const item of recipe) {
    // Linhas em outra unidade ficam de fora: sem conversão automática, para não inventar
    // número (mesma regra do principal fora de Kg).
    if (item.unit !== "Kg") {
      continue;
    }
    if (!recipeItemCountsTowardMixer(item)) {
      continue;
    }
    const isSameSource =
      mainItem.sourceId == null
        ? item === mainItem
        : item.sourceId === mainItem.sourceId && item.sourceType === mainItem.sourceType;
    if (!isSameSource) {
      continue;
    }
    const vessel = getRecipeStageVessel(item.stage);
    kgByVessel.set(vessel, (kgByVessel.get(vessel) ?? 0) + Number(item.quantity ?? 0));
  }

  const mainIngredientKgInRecipe = Math.max(0, ...kgByVessel.values());

  return deriveCapacityPerBatchFromMainIngredient({
    mainIngredientKgInRecipe,
    recipeYieldUnits,
    mainIngredientLimitKg,
  });
}
