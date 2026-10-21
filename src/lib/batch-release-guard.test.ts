import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDeliveryAlreadyReleasedMessage,
  buildPendingStoresMessage,
  findPendingBatchStores,
} from "@/lib/batch-release-guard";

const slots = [
  { storeId: "s1", deliveryDate: "2026-10-19" },
  { storeId: "s2", deliveryDate: "2026-10-19" },
  { storeId: "s3", deliveryDate: "2026-10-19" },
  { storeId: "s1", deliveryDate: "2026-10-20" },
  { storeId: "s2", deliveryDate: "2026-10-20" },
];

test("lojas pendentes: só a entrega pedida, descontando quem já tem pedido", () => {
  assert.deepEqual(findPendingBatchStores(slots, "2026-10-19", ["s1"]), ["s2", "s3"]);
  assert.deepEqual(findPendingBatchStores(slots, "2026-10-20", ["s1", "s2"]), []);
  assert.deepEqual(findPendingBatchStores(slots, "2026-10-21", []), []);
});

test("lojas pendentes: slot duplicado não duplica a loja", () => {
  const dup = [...slots, { storeId: "s2", deliveryDate: "2026-10-19" }];
  assert.deepEqual(findPendingBatchStores(dup, "2026-10-19", []), ["s1", "s2", "s3"]);
});

test("mensagens citam data, lojas e singular/plural", () => {
  assert.match(buildPendingStoresMessage(["Loja 4"], "2026-10-19"), /^1 loja do lote ainda não fez .*19\/10\/2026: Loja 4\./);
  assert.match(buildPendingStoresMessage(["A", "B"], "2026-10-19"), /^2 lojas do lote ainda não fizeram .*: A, B\./);
  assert.match(buildPendingStoresMessage(["Loja 4"], "2026-10-19"), /ela não conseguirá/);
  assert.match(buildPendingStoresMessage(["A", "B"], "2026-10-19"), /elas não conseguirão/);
  assert.match(buildDeliveryAlreadyReleasedMessage("2026-10-19"), /19\/10\/2026 já foi liberada/);
});
