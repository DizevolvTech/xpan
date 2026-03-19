import {
  getExpeditionVisibleStatus,
  type DeliveryExecutionStatus,
} from "@/lib/delivery-workflow";
import type { OrderStatus } from "@/lib/order-planning";

export type StoreOrderManagementStatus = "ativo" | "cancelado";

export function resolveStoreVisibleOrderStatus(
  orderStatus: OrderStatus,
  executionStatus: DeliveryExecutionStatus | null | undefined,
) {
  if (executionStatus && executionStatus !== "aguardando_expedicao") {
    return getExpeditionVisibleStatus(orderStatus, executionStatus);
  }

  return orderStatus;
}

export function canEditStoreOrder(
  managementStatus: StoreOrderManagementStatus,
  isReleasedToProduction: boolean,
) {
  return managementStatus === "ativo" && !isReleasedToProduction;
}

export function canCancelStoreOrder(
  managementStatus: StoreOrderManagementStatus,
  isReleasedToProduction: boolean,
) {
  return canEditStoreOrder(managementStatus, isReleasedToProduction);
}

export function canOpenOccurrenceForOrderExecution(
  executionStatus: DeliveryExecutionStatus | null | undefined,
) {
  return (
    executionStatus === "em_rota" ||
    executionStatus === "no_destino" ||
    executionStatus === "entregue"
  );
}

export function buildStoreOrderCapabilities(input: {
  managementStatus: StoreOrderManagementStatus;
  isReleasedToProduction: boolean;
  executionStatus: DeliveryExecutionStatus | null | undefined;
}) {
  return {
    canEdit: canEditStoreOrder(input.managementStatus, input.isReleasedToProduction),
    canCancel: canCancelStoreOrder(input.managementStatus, input.isReleasedToProduction),
    canOpenOccurrence: canOpenOccurrenceForOrderExecution(input.executionStatus),
  };
}
