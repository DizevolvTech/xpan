import assert from "node:assert/strict";
import test from "node:test";

import { clusterRowsByGroup } from "./cluster-rows-by-group";

test("quadro #4: pedidos do mesmo lote ficam juntos, na posição do primeiro", () => {
  const rows = [
    { id: "a", g: "28" },
    { id: "x", g: null },
    { id: "b", g: "31" },
    { id: "c", g: "28" },
    { id: "d", g: "31" },
  ];
  assert.deepEqual(
    clusterRowsByGroup(rows, (row) => row.g).map((row) => row.id),
    ["a", "c", "x", "b", "d"],
  );
});
