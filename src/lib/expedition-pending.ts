/**
 * Expedição: o que falta para um pedido ficar pronto (reunião 22/10, bloco 4 —
 * "pedido com 83% tem que abrir e mostrar o que falta").
 * Regras puras: a tela só desenha.
 */
import type { OrderStatus, ProductionItemStatus, ProductionOrderRow } from "@/lib/factory-planning/types";

/** OP que já terminou a produção (pronta, a caminho ou entregue) conta como pronta para a expedição. */
const OP_READY_STATUSES: readonly OrderStatus[] = ["aguardando_expedicao", "rota_entrega", "entregue"];

export function isOpReadyForExpedition(status: OrderStatus): boolean {
  return OP_READY_STATUSES.includes(status);
}

export interface PendingOpProduct {
  productName: string;
  quantity: number;
  unit: string;
  status: ProductionItemStatus;
  progress: number;
}

export interface OrderOpProgress {
  opId: string;
  opCode: string;
  navOp: Pick<ProductionOrderRow, "productionDate" | "sectorId" | "lineId" | "scheduleId">;
  lineName: string;
  productionDateLabel: string;
  status: OrderStatus;
  ready: boolean;
  progress: number;
  /** Produtos DESTE pedido dentro da OP. */
  products: PendingOpProduct[];
}

/** OPs que alimentam o pedido; primeiro as que faltam, depois por data de produção. */
export function buildOrderOpProgress(orderId: string, productionOrders: readonly ProductionOrderRow[]): OrderOpProgress[] {
  const rows: OrderOpProgress[] = [];
  for (const op of productionOrders) {
    const sources = op.sourceItems.filter((source) => source.orderId === orderId);
    if (sources.length === 0) continue;
    rows.push({
      opId: op.id,
      opCode: op.code,
      navOp: { productionDate: op.productionDate, sectorId: op.sectorId, lineId: op.lineId, scheduleId: op.scheduleId },
      lineName: op.lineName,
      productionDateLabel: op.productionDateLabel,
      status: op.status,
      ready: isOpReadyForExpedition(op.status),
      progress: op.progress,
      products: sources.map((source) => ({
        productName: source.productName,
        quantity: source.requestedQuantity,
        unit: source.requestedUnit,
        status: source.productionItemStatus,
        progress: source.workflowProgress,
      })),
    });
  }
  return rows.sort((a, b) => {
    if (a.ready !== b.ready) return a.ready ? 1 : -1;
    const byDate = (a.navOp.productionDate ?? "").localeCompare(b.navOp.productionDate ?? "");
    return byDate !== 0 ? byDate : a.opCode.localeCompare(b.opCode);
  });
}

/** Contagem de OPs prontas / total por pedido (entregue conta como pronta). */
export function summarizeOpsByOrder(productionOrders: readonly ProductionOrderRow[]) {
  const summary = new Map<string, { readyOpsCount: number; totalOpsCount: number }>();
  for (const op of productionOrders) {
    const relatedOrderIds = new Set(op.sourceItems.map((source) => source.orderId));
    relatedOrderIds.forEach((orderId) => {
      const current = summary.get(orderId) ?? { readyOpsCount: 0, totalOpsCount: 0 };
      current.totalOpsCount += 1;
      if (isOpReadyForExpedition(op.status)) current.readyOpsCount += 1;
      summary.set(orderId, current);
    });
  }
  return summary;
}

export interface UnplannedOrderProduct {
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
}

/**
 * Produtos do pedido que não estão em OP nenhuma (sem data de produção possível — p.ex. o
 * cadastro do produto mudou depois da liberação). Eles seguram o % do pedido abaixo de 100
 * mesmo com todas as OPs prontas, então a Expedição precisa mostrá-los.
 */
export function listUnplannedOrderProducts(
  orderId: string,
  orderItems: ReadonlyArray<{
    orderId: string;
    opCode: string | null;
    productCode: string;
    productName: string;
    requestedQuantity: number;
    requestedUnit: string;
    isIntermediate?: boolean;
    demandSource?: string;
  }>,
): UnplannedOrderProduct[] {
  return orderItems
    .filter(
      (item) => item.orderId === orderId && !item.opCode && !item.isIntermediate && item.demandSource !== "cronograma",
    )
    .map((item) => ({
      productCode: item.productCode,
      productName: item.productName,
      quantity: item.requestedQuantity,
      unit: item.requestedUnit,
    }));
}
