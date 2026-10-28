import assert from "node:assert/strict";
import test from "node:test";

import { waitingBatchOrderHint, waitingBatchOrdersByCode } from "./waiting-batch-orders";

test("quadro #4: só pedidos não liberados de lotes no prazo ficam sem Liberar", () => {
  const map = waitingBatchOrdersByCode([
    {
      state: "aguardando_lojas",
      deliveryDate: "2026-10-31",
      deadline: { dateKey: "2026-10-29", time: "18:00" },
      orders: [
        { orderCode: "PD-1", released: false },
        { orderCode: "PD-2", released: true },
      ],
    },
    {
      state: "pronto_para_liberar",
      deliveryDate: "2026-10-28",
      deadline: { dateKey: "2026-10-26", time: "18:00" },
      orders: [{ orderCode: "PD-3", released: false }],
    },
  ]);
  assert.deepEqual([...map.keys()], ["PD-1"]);
  assert.match(waitingBatchOrderHint(map.get("PD-1")!), /entrega 31\/10.*até 29\/10 às 18:00/);
});
