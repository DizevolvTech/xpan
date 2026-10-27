import assert from "node:assert/strict";
import test from "node:test";

import { advanceableItemsOf, pendingBatchItemsOf } from "./production-workflow";

test("avanço pela fila: só produtos pendentes, não batidos, cada um para a sua próxima etapa", () => {
  const items = advanceableItemsOf({
    items: [
      { productionItemKey: "a", status: "nao_iniciado", capacityPerBatch: null, preparationStages: [] },
      { productionItemKey: "b", status: "concluido", capacityPerBatch: null, preparationStages: [] },
      { productionItemKey: "c", status: "nao_iniciado", capacityPerBatch: 76, preparationStages: [] },
      { productionItemKey: "d", status: "em_preparacao", capacityPerBatch: 0, preparationStages: [] },
    ],
  });
  assert.deepEqual(
    items.map((item) => item.productionItemKey),
    ["a", "d"],
  );
  assert.ok(items.every((item) => item.status !== "nao_iniciado"));
});

test("quadro #5: OP só com produtos por batida tem a próxima batida para avançar", () => {
  const op = {
    items: [
      { productionItemKey: "a", status: "nao_iniciado" as const, capacityPerBatch: 10, batchCount: 2, batchesDone: 0 },
      { productionItemKey: "b", status: "em_producao" as const, capacityPerBatch: 10, batchCount: 3, batchesDone: 2 },
      { productionItemKey: "c", status: "concluido" as const, capacityPerBatch: 10, batchCount: 1, batchesDone: 1 },
      { productionItemKey: "d", status: "nao_iniciado" as const, capacityPerBatch: null, batchCount: 1, batchesDone: 0 },
    ],
  };
  assert.deepEqual(pendingBatchItemsOf(op), [
    { productionItemKey: "a", batchCount: 2 },
    { productionItemKey: "b", batchCount: 3 },
  ]);
});
