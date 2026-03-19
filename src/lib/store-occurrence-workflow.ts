import type { DeliveryExecutionStatus } from "@/lib/delivery-workflow";

export type StoreOccurrenceStatus = "aberta" | "em_analise" | "resolvida" | "fechada";
export type StoreOccurrenceActorRole = "loja" | "gestor-fabrica" | "administrador";
export type StoreOccurrenceQuantityType = "percentual" | "kg" | "operacional";

export function validateStoreOccurrenceDraft(input: {
  problemType: string;
  quantityType: StoreOccurrenceQuantityType;
  quantity: number;
  quantityUnitSnapshot: string;
  productNameSnapshot: string;
  description: string;
}) {
  const problemType = input.problemType.trim();
  const quantityUnitSnapshot = input.quantityUnitSnapshot.trim();
  const productNameSnapshot = input.productNameSnapshot.trim();
  const description = input.description.trim();

  if (!problemType) {
    throw new Error("Problem type is required for occurrence");
  }

  if (!productNameSnapshot) {
    throw new Error("Product name is required for occurrence");
  }

  if (!quantityUnitSnapshot) {
    throw new Error("Quantity unit is required for occurrence");
  }

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("Invalid quantity for occurrence");
  }

  if (input.quantityType === "percentual" && input.quantity > 100) {
    throw new Error("Percentual occurrence quantity cannot exceed 100");
  }

  if (description.length < 20) {
    throw new Error("Occurrence description must contain at least 20 characters");
  }

  return {
    problemType,
    quantity: input.quantity,
    quantityType: input.quantityType,
    quantityUnitSnapshot,
    productNameSnapshot,
    description,
  };
}

export function normalizeStoreOccurrenceComment(content: string) {
  const normalized = content.trim();

  if (!normalized) {
    throw new Error("Occurrence comment cannot be empty");
  }

  return normalized;
}

export function buildStoreOccurrenceStatusUpdate(
  currentStatus: StoreOccurrenceStatus,
  nextStatus: StoreOccurrenceStatus,
  resolvedByProfileId: string | null,
  nowIso = new Date().toISOString(),
) {
  const payload: Record<string, string | null> = {
    status: nextStatus,
    updated_at: nowIso,
  };

  if (nextStatus === "resolvida") {
    payload.resolved_at = nowIso;
    payload.resolved_by_profile_id = resolvedByProfileId;
    return payload;
  }

  if (
    nextStatus === "aberta" &&
    (currentStatus === "resolvida" || currentStatus === "fechada")
  ) {
    payload.resolved_at = null;
    payload.resolved_by_profile_id = null;
  }

  return payload;
}

export function canOpenOccurrenceForDeliveryStatus(
  status: DeliveryExecutionStatus | null | undefined,
) {
  return status === "em_rota" || status === "no_destino" || status === "entregue";
}

export function canTransitionStoreOccurrenceStatus(
  currentStatus: StoreOccurrenceStatus,
  nextStatus: StoreOccurrenceStatus,
  actorRole: StoreOccurrenceActorRole,
) {
  if (currentStatus === nextStatus) {
    return true;
  }

  if (actorRole === "gestor-fabrica" || actorRole === "administrador") {
    return (
      (currentStatus === "aberta" && nextStatus === "em_analise") ||
      (currentStatus === "em_analise" && (nextStatus === "resolvida" || nextStatus === "aberta")) ||
      (currentStatus === "resolvida" && nextStatus === "aberta") ||
      (currentStatus === "fechada" && nextStatus === "aberta")
    );
  }

  return (
    (currentStatus === "resolvida" && (nextStatus === "fechada" || nextStatus === "aberta")) ||
    (currentStatus === "fechada" && nextStatus === "aberta")
  );
}
