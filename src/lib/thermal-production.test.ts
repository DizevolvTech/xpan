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

import { buildThermalTicketCode, splitRecipeLabel, sumTicketWeightKg } from "./thermal-production";

test("código da ficha segue o formato do cliente e nunca repete entre seções", () => {
  assert.equal(buildThermalTicketCode("260902-011", 0, 1, 1), "OP260902011-B01");
  assert.equal(buildThermalTicketCode("260902-011", 0, 1, 5), "OP260902011-B05");
  assert.equal(buildThermalTicketCode("261013-001", 0, 3, 12), "OP261013001-P1-B12");
  assert.equal(buildThermalTicketCode("OP-261013-001", 0, 1, 1), "OP261013001-B01", "código real da OP já traz o prefixo: não duplica");
  assert.equal(buildThermalTicketCode("op-261013-001", 0, 1, 1), "OP261013001-B01", "prefixo em minúsculas também");
  const codes = new Set([0, 1, 2].flatMap((section) => [1, 2].map((batch) => buildThermalTicketCode("260902-011", section, 3, batch))));
  assert.equal(codes.size, 6);
});

test("rótulo 'COD · Nome' separa código e nome; sem código fica só o nome", () => {
  assert.deepEqual(splitRecipeLabel("22022 · Açucar refinado"), { code: "22022", name: "Açucar refinado" });
  assert.deepEqual(splitRecipeLabel("Farinha"), { code: "", name: "Farinha" });
  assert.deepEqual(splitRecipeLabel("A · B · C"), { code: "A", name: "B · C" });
});

test("peso da ficha soma só massa (Kg e g); Un não é peso", () => {
  assert.equal(sumTicketWeightKg([{ estimatedQuantity: 33.08, unit: "Kg" }, { estimatedQuantity: 16, unit: "Kg" }, { estimatedQuantity: 500, unit: "g" }, { estimatedQuantity: 3, unit: "Un" }]), 49.58);
  assert.equal(sumTicketWeightKg([]), 0);
});

test("fichas de uma OP trazem o código lido pelo leitor, uma por batida", () => {
  const input = { totalKg: 125, capacityPerBatch: 100, salesToKgFactor: 0.5, salesUnit: "Un" };
  const doc = { deliveryGap: { days: [], label: null }, ingredientSections: [], productSections: [{
    productId: "p1", productCode: "PR01", productName: "Bolo", plannedKg: 125, requestedQuantity: 250, requestedUnit: "Un", unitWeightKg: .5, unitsCount: 250,
    batchSplit: computePreWeighBatchSplit(input), items: [],
  }] } as unknown as ProductionSheetDocument;
  assert.deepEqual(buildThermalTickets(doc, "260902-011").map((t) => t.barcode), ["OP260902011-B01", "OP260902011-B02", "OP260902011-B03"]);
});

test("Qtd OP por ficha: cada batida mostra só a sua; a soma das fichas fecha o pedido (1.000 un, masseira 230)", () => {
  const input = { totalKg: 425, capacityPerBatch: 230, salesToKgFactor: 0.425, salesUnit: "Un" };
  const doc = { deliveryGap: { days: [], label: null }, ingredientSections: [], productSections: [{
    productId: "p1", productCode: "PR01", productName: "Panetone", plannedKg: 425, requestedQuantity: 1000, requestedUnit: "Un", unitWeightKg: 0.425, unitsCount: 1000,
    batchSplit: computePreWeighBatchSplit(input), items: [],
  }] } as unknown as ProductionSheetDocument;
  const tickets = buildThermalTickets(doc, "260902-011");
  assert.deepEqual(tickets.map((t) => t.quantity), [230, 230, 230, 230, 80]);
  assert.equal(tickets.reduce((sum, t) => sum + t.quantity, 0), 1000, "a soma das OPs é o total do pedido");
  assert.deepEqual(tickets.map((t) => t.complementary), [false, false, false, false, true]);
});
