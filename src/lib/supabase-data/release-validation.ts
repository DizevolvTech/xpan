export type OrderReleaseValidationReason =
  | "order_cancelled"
  | "order_not_planned"
  | "order_not_releasable";

export class OrderReleaseValidationError extends Error {
  readonly reason: OrderReleaseValidationReason;

  constructor(reason: OrderReleaseValidationReason, message: string) {
    // O route handler em /api/factory-planning/workflow detecta a palavra
    // "invalid" para devolver 400 — manter o prefixo.
    super(`Invalid release: ${message}`);
    this.name = "OrderReleaseValidationError";
    this.reason = reason;
  }
}

export interface OrderRowForValidation {
  id: string;
  legacy_id: string | null;
  management_status: string;
}

export interface PlanningSnapshotForValidation {
  orders: Array<{ id: string; availableForRelease: boolean }>;
}

export function assertPlanningAllowsRelease(
  orderRow: OrderRowForValidation,
  planning: PlanningSnapshotForValidation,
  orderInputId: string,
): { ok: true } | { ok: false; error: OrderReleaseValidationError } {
  if (orderRow.management_status === "cancelado") {
    return {
      ok: false,
      error: new OrderReleaseValidationError(
        "order_cancelled",
        "pedido cancelado não pode ser liberado para produção.",
      ),
    };
  }

  // A engine usa legacy_id como id estável; o parâmetro pode chegar como
  // uuid (DB) ou legacy. Cobrir as três formas.
  const planningId = orderRow.legacy_id ?? orderRow.id;
  const planningRow =
    planning.orders.find((row) => row.id === planningId) ??
    planning.orders.find((row) => row.id === orderRow.id) ??
    planning.orders.find((row) => row.id === orderInputId);

  if (!planningRow) {
    return {
      ok: false,
      error: new OrderReleaseValidationError(
        "order_not_planned",
        "pedido não aparece no planejamento da fábrica para hoje (verifique janela operacional, itens, sub-receita / MPI).",
      ),
    };
  }

  if (!planningRow.availableForRelease) {
    return {
      ok: false,
      error: new OrderReleaseValidationError(
        "order_not_releasable",
        "pedido contém item(ns) sem produção planejável hoje — capacidade ou data inviável.",
      ),
    };
  }

  return { ok: true };
}
