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

/** Status efetivo de um produto batido a partir do nº de batidas concluídas. */
export function deriveBatchStatus(batchesDone: number, batchCount: number): ProductionItemStatus {
  if (batchesDone <= 0) return "nao_iniciado";
  if (batchesDone >= batchCount) return "concluido";
  return "em_producao";
}
