import type { ProductionItemStatus } from "@/lib/factory-planning/types";
import { getRecipeStageVessel, recipeItemCountsTowardMixer, type RecipeStage } from "@/lib/production-planning";
import { formatDisplayNumber, type WeightDisplayUnit } from "@/lib/weight-display";

export interface BatchPlan {
  batchCount: number;
  /** Tamanho de cada batida na unidade de venda (enche + sobra na última). */
  batchSizes: number[];
  /** Rótulo da unidade de venda (ex.: "Un", "Kg"). */
  unitLabel: string;
  /**
   * Cartão #42: há mínimo por batida e ele não foi atingido — o total é menor que o mínimo
   * (aviso na OP) ou não existe divisão com todas as batidas dentro do intervalo.
   */
  belowMinimumPerBatch: boolean;
}

export interface PlanBatchesInput {
  totalKg: number;
  capacityPerBatch: number | null;
  salesToKgFactor: number;
  salesUnit: string;
  /** Mínimo por batida na unidade de venda (cartão #42). Vazio/0 = sem mínimo (regra antiga). */
  minPerBatch?: number | null;
}

/**
 * Unidade de venda CONTÍNUA (peso): a quantidade da batida é um peso exato, não uma contagem.
 * Em unidade contada ("Un") a batida é inteira; em "Kg" o arredondamento para inteiro fazia a
 * soma das fichas diferir da carga da OP em até 0,5 kg (e um pedido pequeno virava ficha vazia).
 */
function isContinuousUnit(unit: string) {
  return unit.trim().toLowerCase() === "kg";
}

/** Quantidades em milésimos (inteiros): evita deriva de ponto flutuante ao dividir em batidas. */
const MILLI = 1000;

/**
 * Total e capacidade na unidade de venda, já em milésimos para unidade contínua e em unidades
 * inteiras para unidade contada. `scale` volta o valor para a unidade de venda.
 */
function resolveBatchQuantities(input: PlanBatchesInput) {
  const { totalKg, capacityPerBatch, salesToKgFactor, salesUnit } = input;
  const factor = salesToKgFactor > 0 ? salesToKgFactor : 1;
  const continuous = isContinuousUnit(salesUnit);
  const scale = continuous ? MILLI : 1;
  const total = Math.max(0, Math.round((totalKg / factor) * scale));
  let cap: number | null = null;
  if (capacityPerBatch && capacityPerBatch > 0) {
    cap = continuous ? Math.round(capacityPerBatch * scale) : Math.floor(capacityPerBatch);
    if (!Number.isFinite(cap) || cap < 1) {
      throw new Error(
        continuous
          ? "Capacidade da batida deve ser de pelo menos 0,001 kg."
          : "Capacidade da batida deve comportar pelo menos uma unidade inteira.",
      );
    }
  }
  let min = 0;
  const rawMin = input.minPerBatch;
  if (cap != null && rawMin != null && Number.isFinite(rawMin) && rawMin > 0) {
    min = Math.min(cap, continuous ? Math.round(rawMin * scale) : Math.ceil(rawMin));
  }
  return { factor, scale, total, cap, min };
}

/**
 * Cartão #42 — divide `total` em batidas entre `min` e `cap` (inteiros já escalados):
 * - menor número de batidas possível (ceil(total / cap));
 * - batidas maiores primeiro, guardando o mínimo para cada batida que ainda falta;
 * - soma sempre igual ao total. Ex.: mín. 4 / máx. 9 → 12 = 8 + 4; 28 = 9 + 9 + 6 + 4.
 * Sem mínimo (ou sem divisão possível dentro do intervalo) cai na regra antiga: enche até o
 * máximo e a última leva a sobra.
 */
export function distributeBatchSizes(total: number, cap: number, min = 0) {
  const batchCount = Math.max(1, Math.ceil(total / cap));
  const feasible = min > 0 && total >= min && batchCount * min <= total;
  const sizes: number[] = [];
  let remaining = total;
  for (let i = 0; i < batchCount; i += 1) {
    const reserve = feasible ? min * (batchCount - i - 1) : 0;
    const size = Math.min(cap, remaining - reserve);
    sizes.push(size);
    remaining -= size;
  }
  const belowMinimumPerBatch = min > 0 && sizes.some((size) => size < min);
  return { sizes, belowMinimumPerBatch };
}

/**
 * Calcula o plano de batidas de um item de OP.
 * - Converte o total (kg) para a unidade de venda via salesToKgFactor.
 * - Sem capacidade (null/<=0) → 1 batida com o total.
 * - Com capacidade → enche cada batida até o máximo; a última leva a sobra.
 */
export function planBatches(input: PlanBatchesInput): BatchPlan {
  const { salesUnit } = input;
  const { scale, total, cap, min } = resolveBatchQuantities(input);

  if (cap == null) {
    return { batchCount: 1, batchSizes: [total / scale], unitLabel: salesUnit, belowMinimumPerBatch: false };
  }

  const { sizes, belowMinimumPerBatch } = distributeBatchSizes(total, cap, min);
  return {
    batchCount: sizes.length,
    batchSizes: sizes.map((size) => size / scale),
    unitLabel: salesUnit,
    belowMinimumPerBatch,
  };
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
  /**
   * Todas as batidas menores que a cheia, da maior para a menor (cartão #42: com mínimo por
   * batida pode haver mais de uma, ex.: 9 + 9 + 6 + 4). `partialUnits`/`partialKg` = a primeira.
   */
  partials: { units: number; kg: number; count: number }[];
  /** total em unidades de venda. */
  totalUnits: number;
  unitLabel: string;
}

/**
 * Desdobra o total de um item de OP em batidas CHEIAS + uma PARCIAL (resto),
 * espelhando a matemática de `planBatches` (mesma conversão kg→un e mesmo cap).
 */
export function computePreWeighBatchSplit(input: PlanBatchesInput): PreWeighBatchSplit {
  const { totalKg, salesUnit } = input;
  const { factor, scale, total, cap, min } = resolveBatchQuantities(input);
  const totalUnits = total / scale;
  if (cap == null) {
    return { batched: false, fullBatchCount: 0, fullBatchUnits: 0, fullBatchKg: 0, partialUnits: totalUnits, partialKg: totalKg, partials: [], totalUnits, unitLabel: salesUnit };
  }
  const { sizes } = distributeBatchSizes(total, cap, min);
  const fullBatchCount = sizes.filter((size) => size === cap).length;
  const partialGroups = new Map<number, number>();
  for (const size of sizes) {
    if (size !== cap && size > 0) {
      partialGroups.set(size, (partialGroups.get(size) ?? 0) + 1);
    }
  }
  const toKg = (units: number) => Number((units * factor).toFixed(3));
  const partials = Array.from(partialGroups.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([size, count]) => ({ units: size / scale, kg: toKg(size / scale), count }));
  const fullBatchUnits = cap / scale;
  const partialUnits = partials[0]?.units ?? 0;
  return {
    batched: true,
    fullBatchCount,
    fullBatchUnits,
    fullBatchKg: toKg(fullBatchUnits),
    partialUnits,
    partialKg: partials[0]?.kg ?? 0,
    partials,
    totalUnits,
    unitLabel: salesUnit,
  };
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
  weight: WeightDisplayUnit = "kg",
): string {
  // `weight` = "g" converte SÓ o que é peso em Kg: a medida "kg" (carga) e a medida "units" quando a
  // unidade de venda do produto é o próprio Kg ("6 Kg" → "6.000 g"). Unidade contada ("1200 Un")
  // não é peso e nunca é convertida.
  const amount = (units: number, kg: number) =>
    measure === "kg"
      ? weight === "g"
        ? `${formatDisplayNumber(kg, "kg", "g")} g`
        : `${formatBatchAmount(kg)} kg`
      : weight === "g" && split.unitLabel.trim().toLowerCase() === "kg"
        ? `${formatDisplayNumber(units, "kg", "g")} g`
        : `${formatBatchAmount(units)} ${split.unitLabel}`;

  if (!split.batched) {
    return `1 corrida de ${amount(split.totalUnits, split.partialKg || split.totalUnits)}`;
  }

  const parts: string[] = [];
  if (split.fullBatchCount > 0) {
    const word = split.fullBatchCount === 1 ? "cheia" : "cheias";
    parts.push(`${split.fullBatchCount} ${word} de ${amount(split.fullBatchUnits, split.fullBatchKg)}`);
  }
  const partials = split.partials ?? (split.partialUnits > 0
    ? [{ units: split.partialUnits, kg: split.partialKg, count: 1 }]
    : []);
  for (const partial of partials) {
    const word = partial.count === 1 ? "parcial" : "parciais";
    parts.push(`${partial.count} ${word} de ${amount(partial.units, partial.kg)}`);
  }
  return parts.join(" + ");
}

/** Mesma frase a partir dos tamanhos já planejados (`planBatches.batchSizes`). */
export function formatBatchSizesPhrase(
  batchSizes: number[],
  unitLabel: string,
  weight: WeightDisplayUnit = "kg",
): string {
  if (batchSizes.length === 0) {
    return "";
  }
  if (batchSizes.length === 1) {
    return weight === "g" && unitLabel.trim().toLowerCase() === "kg"
      ? `1 corrida de ${formatDisplayNumber(batchSizes[0], "kg", "g")} g`
      : `1 corrida de ${formatBatchAmount(batchSizes[0])} ${unitLabel}`;
  }
  const cap = Math.max(...batchSizes);
  const fullCount = batchSizes.filter((size) => size === cap).length;
  const partialGroups = new Map<number, number>();
  for (const size of batchSizes) {
    if (size < cap && size > 0) {
      partialGroups.set(size, (partialGroups.get(size) ?? 0) + 1);
    }
  }
  const partials = Array.from(partialGroups.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([units, count]) => ({ units, kg: units, count }));
  return formatBatchSplitPhrase({
    batched: true,
    fullBatchCount: fullCount,
    fullBatchUnits: cap,
    fullBatchKg: cap,
    partialUnits: partials[0]?.units ?? 0,
    partialKg: partials[0]?.units ?? 0,
    partials,
    totalUnits: batchSizes.reduce((sum, size) => sum + size, 0),
    unitLabel,
  }, "units", weight);
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

/**
 * Colunas de parcial das folhas (pré-pesagem/produção). Uma parcial só = "Parcial", como
 * sempre; com mínimo por batida (cartão #42) cada tamanho ganha a sua coluna:
 * "Parcial 6 Un", "Parcial 4 Un ×2".
 */
export function listPartialColumns(split: PreWeighBatchSplit | null | undefined) {
  if (!split?.batched) {
    return [] as { index: number; label: string }[];
  }
  const partials = split.partials ?? (split.partialUnits > 0
    ? [{ units: split.partialUnits, kg: split.partialKg, count: 1 }]
    : []);
  if (partials.length === 1 && partials[0].count === 1) {
    return [{ index: 0, label: "Parcial" }];
  }
  return partials.map((partial, index) => ({
    index,
    label: `Parcial ${formatBatchAmount(partial.units)} ${split.unitLabel}${partial.count > 1 ? ` ×${partial.count}` : ""}`,
  }));
}

/** Quantidade de uma linha da receita na parcial `index` (cartão #42). */
export function partialQuantityAt(
  row: { partialQuantity?: number; partialQuantities?: number[] },
  index: number,
) {
  return row.partialQuantities?.[index] ?? (index === 0 ? row.partialQuantity : undefined);
}

/**
 * Texto do aviso "abaixo do mínimo por batida" (cartão #42). Só aviso: a OP não trava e sai
 * com a quantidade exata do pedido.
 */
export function describeBelowMinimumPerBatch(item: {
  batchSizes: number[];
  batchUnitLabel: string;
  minPerBatch?: number | null;
  capacityPerBatch?: number | null;
}) {
  const unit = item.batchUnitLabel;
  const total = Math.round(item.batchSizes.reduce((sum, size) => sum + size, 0) * 1000) / 1000;
  const min = item.minPerBatch ?? 0;
  if (total < min) {
    return `Pedido de ${formatBatchAmount(total)} ${unit} abaixo do mínimo por batida (${formatBatchAmount(min)} ${unit}). Sai em 1 batida com o total. É só um aviso — não trava a OP.`;
  }
  return `${formatBatchAmount(total)} ${unit} não fecha em batidas entre o mínimo (${formatBatchAmount(min)} ${unit}) e o máximo (${formatBatchAmount(item.capacityPerBatch ?? 0)} ${unit}); a última batida ficou abaixo do mínimo. É só um aviso — não trava a OP.`;
}
