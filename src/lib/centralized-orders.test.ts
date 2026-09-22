import assert from "node:assert/strict";
import test from "node:test";
import { reviewOrderEntries, type OrderEntryCatalog } from "./centralized-orders";

const catalog: OrderEntryCatalog = {
  stores: [{ id: "s1", code: "001", name: "Loja Centro" }, { id: "s2", code: "002", name: "Loja Praia" }],
  products: [{ id: "p1", code: "PR-01", externalCode: "0009", name: "Bolo de Laranja", unit: "Un" }],
};
test("centralizado preserva produto e quantidades distintas por loja", () => {
  const result = reviewOrderEntries([{ row: 2, store: "001", product: "0009", quantity: 100 }, { row: 3, store: "Loja Praia", product: "PR-01", quantity: 50 }], catalog);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows.map(r => [r.storeId, r.productId, r.quantity]), [["s1", "p1", 100], ["s2", "p1", 50]]);
});
test("importação identifica linhas desconhecidas, duplicadas e fracionárias", () => {
  const result = reviewOrderEntries([
    { row: 2, store: "001", product: "0009", quantity: 1 },
    { row: 3, store: "001", product: "0009", quantity: 2 },
    { row: 4, store: "002", product: "0009", quantity: "1,5" },
    { row: 5, store: "outra", product: "novo", quantity: 1 },
    { row: 6, store: "002", product: "0009", quantity: -1 },
  ], catalog);
  assert.deepEqual([...new Set(result.errors.map(e => e.row))], [3, 4, 5, 6]);
});
test("nomes ambíguos não selecionam arbitrariamente uma loja", () => {
  const result = reviewOrderEntries([{ row: 2, store: "Loja Centro", product: "0009", quantity: 1 }], { ...catalog, stores: [...catalog.stores, { id: "s3", code: "003", name: "Loja Centro" }] });
  assert.match(result.errors[0].message, /ambígua/);
});
