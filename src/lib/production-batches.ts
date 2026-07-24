import type { ProductionItemStatus } from "@/lib/factory-planning/types";

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
  const fullBatchCount = Math.floor(totalUnits / cap);
  const partialUnits = totalUnits - fullBatchCount * cap;
  return { batched: true, fullBatchCount, fullBatchUnits: cap, fullBatchKg: Number((cap * factor).toFixed(3)), partialUnits, partialKg: Number((partialUnits * factor).toFixed(3)), totalUnits, unitLabel: salesUnit };
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
  recipe: Array<{ unit: string; quantity: number; isMain?: boolean; sourceType?: string; sourceId?: string }>;
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

  // Etapa na receita: o mesmo insumo pode entrar em mais de uma etapa (farinha na
  // esponja + farinha na massa). A masseira é limitada pelo TOTAL do principal, então
  // somamos TODAS as linhas da mesma fonte — contar só a linha marcada superestimaria a
  // batida. Linhas em outra unidade ficam de fora (mesma regra do principal fora de Kg:
  // sem conversão automática, para não gerar cálculo errado).
  const mainIngredientKgInRecipe = recipe
    .filter(
      (item) =>
        item.unit === "Kg" &&
        (mainItem.sourceId == null
          ? item === mainItem
          : item.sourceId === mainItem.sourceId && item.sourceType === mainItem.sourceType),
    )
    .reduce((total, item) => total + Number(item.quantity ?? 0), 0);

  return deriveCapacityPerBatchFromMainIngredient({
    mainIngredientKgInRecipe,
    recipeYieldUnits,
    mainIngredientLimitKg,
  });
}
