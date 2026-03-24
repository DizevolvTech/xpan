import type { ProductionItemStatus } from "@/lib/order-planning";
import {
  defaultProductPreparationStages,
  productPreparationStageLabels,
  type ProductPreparationStageKey,
} from "@/lib/production-planning";

const PREPARATION_STAGE_SET = new Set<ProductPreparationStageKey>(defaultProductPreparationStages);

const PRODUCTION_STATUS_LABELS: Record<ProductionItemStatus, string> = {
  nao_iniciado: "Não iniciado",
  em_preparacao: productPreparationStageLabels.em_preparacao,
  em_producao: productPreparationStageLabels.em_producao,
  em_forno: productPreparationStageLabels.em_forno,
  embalando: productPreparationStageLabels.embalando,
  concluido: "Concluído",
};

const NEXT_ACTION_LABELS: Record<ProductionItemStatus, string> = {
  nao_iniciado: "",
  em_preparacao: "Iniciar preparação",
  em_producao: "Iniciar produção",
  em_forno: "Enviar para forno",
  embalando: "Iniciar embalagem",
  concluido: "Marcar como concluído",
};

const PREVIOUS_ACTION_LABELS: Record<ProductionItemStatus, string> = {
  nao_iniciado: "Voltar para não iniciado",
  em_preparacao: "Voltar para preparação",
  em_producao: "Voltar para produção",
  em_forno: "Voltar para forno",
  embalando: "Voltar para embalagem",
  concluido: "",
};

export function normalizeProductPreparationStages(
  stages?: ProductPreparationStageKey[] | null,
): ProductPreparationStageKey[] {
  const normalized = (stages ?? []).filter(
    (stage, index, all): stage is ProductPreparationStageKey =>
      PREPARATION_STAGE_SET.has(stage) && all.indexOf(stage) === index,
  );

  return normalized.length > 0 ? normalized : [...defaultProductPreparationStages];
}

export function buildProductionStatusFlow(
  stages?: ProductPreparationStageKey[] | null,
): ProductionItemStatus[] {
  return ["nao_iniciado", ...normalizeProductPreparationStages(stages), "concluido"];
}

export function getProductionStatusLabel(status: ProductionItemStatus) {
  return PRODUCTION_STATUS_LABELS[status];
}

export function getNextProductionActionLabel(
  status: ProductionItemStatus,
  stages?: ProductPreparationStageKey[] | null,
) {
  const nextStatus = getNextProductionItemStatus(status, stages);
  return nextStatus ? NEXT_ACTION_LABELS[nextStatus] : null;
}

export function getPreviousProductionActionLabel(
  status: ProductionItemStatus,
  stages?: ProductPreparationStageKey[] | null,
) {
  const previousStatus = getPreviousProductionItemStatus(status, stages);
  return previousStatus ? PREVIOUS_ACTION_LABELS[previousStatus] : null;
}

export function canTransitionProductionItemStatus(
  currentStatus: ProductionItemStatus,
  nextStatus: ProductionItemStatus,
  stages?: ProductPreparationStageKey[] | null,
) {
  if (currentStatus === nextStatus) {
    return true;
  }

  const flow = buildProductionStatusFlow(stages);
  const currentIndex = flow.indexOf(currentStatus);
  const nextIndex = flow.indexOf(nextStatus);

  if (currentIndex < 0 || nextIndex < 0) {
    return false;
  }

  return Math.abs(nextIndex - currentIndex) === 1;
}

export function getNextProductionItemStatus(
  status: ProductionItemStatus,
  stages?: ProductPreparationStageKey[] | null,
) {
  const flow = buildProductionStatusFlow(stages);
  const currentIndex = flow.indexOf(status);
  if (currentIndex < 0 || currentIndex >= flow.length - 1) {
    return null;
  }

  return flow[currentIndex + 1];
}

export function getPreviousProductionItemStatus(
  status: ProductionItemStatus,
  stages?: ProductPreparationStageKey[] | null,
) {
  const flow = buildProductionStatusFlow(stages);
  const currentIndex = flow.indexOf(status);
  if (currentIndex <= 0) {
    return null;
  }

  return flow[currentIndex - 1];
}

export function getProductionStatusProgress(
  status: ProductionItemStatus,
  stages?: ProductPreparationStageKey[] | null,
) {
  const flow = buildProductionStatusFlow(stages);
  const currentIndex = flow.indexOf(status);
  if (currentIndex <= 0) {
    return 0;
  }
  if (currentIndex >= flow.length - 1) {
    return 100;
  }

  return Number(((currentIndex / (flow.length - 1)) * 100).toFixed(1));
}
