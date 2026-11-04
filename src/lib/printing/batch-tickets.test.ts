import assert from "node:assert/strict";
import test from "node:test";

import { closeTicketToBatchKg, type BatchTicket } from "@/lib/printing/batch-tickets";

function ticket(batchKg: number, rows: Array<[number, string]>): BatchTicket {
  return {
    key: "1-B01", barcode: "OP1-B01", kind: "ingredient", productId: "m", productCode: "mpi008", productName: "Massa",
    number: 1, count: 1, quantity: batchKg, unit: "Kg", totalQuantity: batchKg, complementary: false, batchKg,
    unitWeightKg: null,
    items: rows.map(([q, unit], i) => ({ estimatedQuantity: q, unit } as never as BatchTicket["items"][number] & { id: string, i: number })),
  } as BatchTicket;
}

const sumKg = (t: BatchTicket) =>
  Math.round(t.items.reduce((s, r) => s + (r.unit === "Kg" ? r.estimatedQuantity : r.unit === "g" ? r.estimatedQuantity / 1000 : 0), 0) * 1000) / 1000;

test("cartao #236: bloco da MPI fecha a soma dos insumos com a carga ao grama (6,898 x 6,897)", () => {
  const t = ticket(6.897, [[4.33749, "Kg"], [0.04364, "Kg"], [2.51749, "Kg"]]);
  closeTicketToBatchKg(t);
  assert.equal(sumKg(t), 6.897);
  assert.equal(t.items[0].estimatedQuantity, 4.336);
});

test("cartao #236: diferenca acima de 5 g nao e escondida", () => {
  const t = ticket(7, [[4, "Kg"], [2.9, "Kg"]]);
  closeTicketToBatchKg(t);
  assert.equal(sumKg(t), 6.9);
});
