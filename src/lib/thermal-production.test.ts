import assert from "node:assert/strict";
import test from "node:test";
import { buildThermalTickets } from "./thermal-production";
import { computePreWeighBatchSplit, planBatches } from "./production-batches";
import type { ProductionSheetDocument } from "./printing-documents";

test("250 unidades geram 100 + 100 + 50, complementar própria e ingredientes proporcionais", () => {
  const input = { totalKg: 125, capacityPerBatch: 100, salesToKgFactor: 0.5, salesUnit: "Un" };
  const doc: ProductionSheetDocument = { deliveryGap: { days: [], label: null }, ingredientSections: [], productSections: [{
    productId: "p1", productCode: "PR01", productName: "Bolo", plannedKg: 125, requestedQuantity: 250, requestedUnit: "Un", unitWeightKg: .5, unitsCount: 250,
    batchSplit: computePreWeighBatchSplit(input), items: [{ key: "farinha", sourceType: "ingrediente", kind: "ingrediente", stage: "massa", label: "Farinha", unit: "Kg", estimatedQuantity: 25, quantityPerUnit: .1 }],
  }] };
  const tickets = buildThermalTickets(doc);
  assert.deepEqual(tickets.map(t => t.quantity), planBatches(input).batchSizes);
  assert.deepEqual(tickets.map(t => t.complementary), [false, false, true]);
  assert.deepEqual(tickets.map(t => t.items[0].estimatedQuantity), [10, 10, 5]);
  assert.equal(new Set(tickets.map(t => t.key)).size, 3);
  assert.equal(tickets.reduce((sum, t) => sum + t.quantity, 0), 250);
});

test("capacidade menor que uma unidade é rejeitada sem loop infinito", () => {
  const input = { totalKg: 1, capacityPerBatch: .5, salesToKgFactor: 1, salesUnit: "Un" };
  assert.throws(() => planBatches(input), /unidade inteira/);
  assert.throws(() => computePreWeighBatchSplit(input), /unidade inteira/);
});
