import {
  getExpeditionVisibleStatus,
  resolveEffectiveDeliveryExecutionStatus,
  type DeliveryExecutionStatus,
} from "@/lib/delivery-workflow";
import type { OrderStatus } from "@/lib/order-planning";

export type StoreOrderManagementStatus = "ativo" | "cancelado";

export function resolveStoreVisibleOrderStatus(
  orderStatus: OrderStatus,
  executionStatus: DeliveryExecutionStatus | null | undefined,
) {
  const effectiveExecutionStatus = resolveEffectiveDeliveryExecutionStatus(orderStatus, executionStatus);

  if (effectiveExecutionStatus !== "aguardando_expedicao") {
    return getExpeditionVisibleStatus(orderStatus, effectiveExecutionStatus);
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
  orderStatus: OrderStatus,
  executionStatus: DeliveryExecutionStatus | null | undefined,
) {
  const effectiveExecutionStatus = resolveEffectiveDeliveryExecutionStatus(orderStatus, executionStatus);

  return (
    effectiveExecutionStatus === "em_rota" ||
    effectiveExecutionStatus === "no_destino" ||
    effectiveExecutionStatus === "entregue"
  );
}

export function buildStoreOrderCapabilities(input: {
  orderStatus: OrderStatus;
  managementStatus: StoreOrderManagementStatus;
  isReleasedToProduction: boolean;
  executionStatus: DeliveryExecutionStatus | null | undefined;
}) {
  return {
    canEdit: canEditStoreOrder(input.managementStatus, input.isReleasedToProduction),
    canCancel: canCancelStoreOrder(input.managementStatus, input.isReleasedToProduction),
    canOpenOccurrence: canOpenOccurrenceForOrderExecution(input.orderStatus, input.executionStatus),
  };
}
