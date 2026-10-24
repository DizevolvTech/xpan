import assert from "node:assert/strict";
import test from "node:test";

import { advanceableItemsOf } from "./production-workflow";

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
