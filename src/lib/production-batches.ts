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
