import type { ProductionItemStatus } from "@/lib/order-planning";

export const PRODUCTION_ITEM_STATUS_FLOW: ProductionItemStatus[] = [
  "nao_iniciado",
  "em_preparacao",
  "em_producao",
  "em_forno",
  "embalando",
  "concluido",
];

const PRODUCTION_STATUS_LABELS: Record<ProductionItemStatus, string> = {
  nao_iniciado: "Não iniciado",
  em_preparacao: "Em preparação",
  em_producao: "Em produção",
  em_forno: "Em forno",
  embalando: "Embalando",
  concluido: "Concluído",
};

export function getProductionStatusLabel(status: ProductionItemStatus) {
  return PRODUCTION_STATUS_LABELS[status];
}

export function canTransitionProductionItemStatus(
  currentStatus: ProductionItemStatus,
  nextStatus: ProductionItemStatus,
) {
  if (currentStatus === nextStatus) {
    return true;
  }

  const currentIndex = PRODUCTION_ITEM_STATUS_FLOW.indexOf(currentStatus);
  const nextIndex = PRODUCTION_ITEM_STATUS_FLOW.indexOf(nextStatus);

  if (currentIndex < 0 || nextIndex < 0) {
    return false;
  }

  return Math.abs(nextIndex - currentIndex) === 1;
}

export function getNextProductionItemStatus(status: ProductionItemStatus) {
  const currentIndex = PRODUCTION_ITEM_STATUS_FLOW.indexOf(status);
  if (currentIndex < 0 || currentIndex >= PRODUCTION_ITEM_STATUS_FLOW.length - 1) {
    return null;
  }

  return PRODUCTION_ITEM_STATUS_FLOW[currentIndex + 1];
}

export function getPreviousProductionItemStatus(status: ProductionItemStatus) {
  const currentIndex = PRODUCTION_ITEM_STATUS_FLOW.indexOf(status);
  if (currentIndex <= 0) {
    return null;
  }

  return PRODUCTION_ITEM_STATUS_FLOW[currentIndex - 1];
}
