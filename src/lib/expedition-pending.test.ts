import assert from "node:assert/strict";
import test from "node:test";

import type { ProductionOrderRow } from "@/lib/factory-planning/types";

import { buildOrderOpProgress, isOpReadyForExpedition, listUnplannedOrderProducts, summarizeOpsByOrder } from "./expedition-pending";

function op(partial: Partial<ProductionOrderRow> & { id: string; status: ProductionOrderRow["status"]; orders: string[] }): ProductionOrderRow {
  return {
    code: partial.id.toUpperCase(),
    productionDate: partial.productionDate ?? "2026-10-24",
    productionDateLabel: "24/10",
    sectorId: "s",
    sectorName: "S",
    lineId: "l",
    lineName: partial.lineName ?? "Linha",
    scheduleId: "c",
    scheduleCode: "C",
    scheduleName: "C",
    itemsCount: 1,
    ordersCount: partial.orders.length,
    totalKg: 1,
    hasDemand: true,
    releasedToProduction: true,
    productionStarted: false,
    progress: partial.progress ?? 0,
    orderCodes: [],
    items: [],
    sourceItems: partial.orders.map((orderId, index) => ({
      id: `${partial.id}-${index}`,
      orderId,
      orderCode: orderId,
      storeName: "Loja",
      productId: "p",
      productCode: "P",
      productName: `Produto ${partial.id}`,
      requestedQuantity: 2,
      requestedUnit: "kg",
      internalKg: 2,
      deliveryDate: "2026-10-25",
      deliveryDateLabel: "25/10",
      saleDate: "2026-10-25",
      saleDateLabel: "25/10",
      expeditionUnit: "kg",
      expeditionQuantity: 2,
      productionItemKey: "k",
      productionSequence: null,
      releasedToProduction: true,
      productionItemStatus: "em_preparacao",
      workflowProgress: 20,
    })),
    ...partial,
  } as ProductionOrderRow;
}

test("OP entregue ou em rota conta como pronta (antes contava 0/4 nos entregues)", () => {
  assert.equal(isOpReadyForExpedition("aguardando_expedicao"), true);
  assert.equal(isOpReadyForExpedition("entregue"), true);
  assert.equal(isOpReadyForExpedition("rota_entrega"), true);
  assert.equal(isOpReadyForExpedition("em_producao"), false);
  const summary = summarizeOpsByOrder([
    op({ id: "a", status: "entregue", orders: ["p1"] }),
    op({ id: "b", status: "aguardando_expedicao", orders: ["p1", "p2"] }),
    op({ id: "c", status: "em_producao", orders: ["p2"] }),
  ]);
  assert.deepEqual(summary.get("p1"), { readyOpsCount: 2, totalOpsCount: 2 });
  assert.deepEqual(summary.get("p2"), { readyOpsCount: 1, totalOpsCount: 2 });
});

test("mostra só as OPs do pedido, as que faltam primeiro, com os produtos do pedido", () => {
  const rows = buildOrderOpProgress("p1", [
    op({ id: "pronta", status: "aguardando_expedicao", orders: ["p1"], productionDate: "2026-10-20" }),
    op({ id: "outra", status: "em_producao", orders: ["p9"] }),
    op({ id: "falta", status: "em_espera", orders: ["p1", "p2"], productionDate: "2026-10-23" }),
  ]);
  assert.deepEqual(rows.map((row) => [row.opId, row.ready]), [["falta", false], ["pronta", true]]);
  assert.equal(rows[0].products.length, 1);
  assert.equal(rows[0].products[0].productName, "Produto falta");
});

test("produto do pedido sem OP aparece em 'o que falta' (segura o % abaixo de 100)", () => {
  const rows = listUnplannedOrderProducts("o1", [
    { orderId: "o1", opCode: "OP-1", productCode: "A", productName: "Pão", requestedQuantity: 2, requestedUnit: "un" },
    { orderId: "o1", opCode: null, productCode: "B", productName: "Bolo", requestedQuantity: 3, requestedUnit: "un" },
    { orderId: "o1", opCode: null, productCode: "M", productName: "Massa", requestedQuantity: 1, requestedUnit: "kg", isIntermediate: true },
    { orderId: "o2", opCode: null, productCode: "C", productName: "Outro", requestedQuantity: 1, requestedUnit: "un" },
  ]);
  assert.deepEqual(rows, [{ productCode: "B", productName: "Bolo", quantity: 3, unit: "un" }]);
});
