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
  em_preparacao: "Preparação",
  em_producao: "Em produção",
  em_forno: "Em forno",
  embalando: "Embalando",
  concluido: "Concluído",
};

export function getProductionStatusLabel(status: ProductionItemStatus) {
  return PRODUCTION_STATUS_LABELS[status];
}

export function getNextProductionActionLabel(status: ProductionItemStatus) {
  switch (status) {
    case "nao_iniciado":
      return "Iniciar preparação";
    case "em_preparacao":
      return "Iniciar produção";
    case "em_producao":
      return "Enviar para forno";
    case "em_forno":
      return "Iniciar embalagem";
    case "embalando":
      return "Marcar como concluído";
    default:
      return null;
  }
}

export function getPreviousProductionActionLabel(status: ProductionItemStatus) {
  switch (status) {
    case "em_preparacao":
      return "Voltar para não iniciado";
    case "em_producao":
      return "Voltar para preparação";
    case "em_forno":
      return "Voltar para produção";
    case "embalando":
      return "Voltar para forno";
    case "concluido":
      return "Voltar para embalagem";
    default:
      return null;
  }
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
