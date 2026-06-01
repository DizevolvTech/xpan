import type { OrderStatus } from "@/lib/factory-planning/types";

export type DeliveryExecutionStatus =
  | "aguardando_expedicao"
  | "pronto_coleta"
  | "em_rota"
  | "no_destino"
  | "entregue"
  | "tentativa_falha";

export type DeliveryChecklistState = Record<string, boolean>;
export type ExpeditionVisibleStatus = OrderStatus | DeliveryExecutionStatus;

const DELIVERY_STATUS_GRAPH: Record<DeliveryExecutionStatus, DeliveryExecutionStatus[]> = {
  aguardando_expedicao: ["pronto_coleta"],
  pronto_coleta: ["em_rota"],
  em_rota: ["no_destino", "tentativa_falha"],
  no_destino: ["entregue", "tentativa_falha"],
  entregue: [],
  tentativa_falha: ["em_rota"],
};

export function canTransitionDeliveryStatus(
  currentStatus: DeliveryExecutionStatus,
  nextStatus: DeliveryExecutionStatus,
) {
  if (currentStatus === nextStatus) {
    return true;
  }

  return DELIVERY_STATUS_GRAPH[currentStatus].includes(nextStatus);
}

export function getNextDeliveryAction(status: DeliveryExecutionStatus) {
  if (status === "pronto_coleta") {
    return { label: "Iniciar rota", nextStatus: "em_rota" as const };
  }
  if (status === "em_rota") {
    return { label: "Cheguei no destino", nextStatus: "no_destino" as const };
  }
  if (status === "no_destino") {
    return { label: "Confirmar entrega", nextStatus: "entregue" as const };
  }
  if (status === "tentativa_falha") {
    return { label: "Retomar rota", nextStatus: "em_rota" as const };
  }

  return null;
}

export function canRegisterDeliveryFailure(status: DeliveryExecutionStatus) {
  return status === "em_rota" || status === "no_destino" || status === "tentativa_falha";
}

export function isOrderReadyForDeliveryExecution(orderStatus: OrderStatus) {
  return orderStatus === "aguardando_expedicao";
}

export function resolveEffectiveDeliveryExecutionStatus(
  orderStatus: OrderStatus,
  executionStatus: DeliveryExecutionStatus | null | undefined,
) {
  // Uma execução de entrega já avançada é a fonte da verdade — o orderStatus
  // derivado da produção NÃO pode arrastá-la de volta para aguardando_expedicao.
  if (executionStatus && executionStatus !== "aguardando_expedicao") {
    return executionStatus;
  }
  if (!isOrderReadyForDeliveryExecution(orderStatus)) {
    return "aguardando_expedicao";
  }
  return executionStatus ?? "aguardando_expedicao";
}

export function areAllChecklistItemsChecked(
  checklistItemKeys: string[],
  checklistState: DeliveryChecklistState | null | undefined,
) {
  return checklistItemKeys.length > 0 && checklistItemKeys.every((key) => checklistState?.[key] === true);
}

export function getExpeditionVisibleStatus(
  orderStatus: OrderStatus,
  executionStatus: DeliveryExecutionStatus | null | undefined,
): ExpeditionVisibleStatus {
  const effectiveExecutionStatus = resolveEffectiveDeliveryExecutionStatus(orderStatus, executionStatus);

  if (effectiveExecutionStatus !== "aguardando_expedicao") {
    return effectiveExecutionStatus;
  }

  return orderStatus;
}
