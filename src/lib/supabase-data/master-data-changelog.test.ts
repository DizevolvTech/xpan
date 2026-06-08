import assert from "node:assert/strict";
import test from "node:test";

import {
  reduceLatestChangelogByProduct,
  type ProductChangelogRow,
} from "@/lib/supabase-data/master-data-changelog";

function row(overrides: Partial<ProductChangelogRow>): ProductChangelogRow {
  return {
    product_id: "prod-db-1",
    version_number: 1,
    change_description: "motivo",
    changed_by_name: "Ana",
    created_at: "2026-06-01T00:00:00.000Z",
    snapshot_data: null,
    ...overrides,
  };
}

test("reduceLatestChangelogByProduct — mantém só a última versão (linhas ordenadas desc)", () => {
  const rows: ProductChangelogRow[] = [
    row({
      product_id: "prod-db-1",
      version_number: 3,
      change_description: "v3",
      changed_by_name: "Carlos",
      created_at: "2026-06-03T00:00:00.000Z",
      snapshot_data: {
        changedFields: [{ field: "name", label: "Nome", from: "A", to: "B" }],
      },
    }),
    row({ product_id: "prod-db-1", version_number: 2, change_description: "v2" }),
    row({ product_id: "prod-db-1", version_number: 1, change_description: "v1" }),
  ];

  const result = reduceLatestChangelogByProduct(rows, new Map());

  assert.deepEqual(Object.keys(result), ["prod-db-1"]);
  assert.deepEqual(result["prod-db-1"], {
    versionNumber: 3,
    changeDescription: "v3",
    changedByName: "Carlos",
    createdAt: "2026-06-03T00:00:00.000Z",
    changedFields: [{ field: "name", label: "Nome", from: "A", to: "B" }],
  });
});

test("reduceLatestChangelogByProduct — mapeia a chave por legacy_id quando presente", () => {
  const rows: ProductChangelogRow[] = [
    row({ product_id: "prod-db-1", version_number: 2, change_description: "novo" }),
    row({ product_id: "prod-db-1", version_number: 1, change_description: "antigo" }),
  ];
  const productLegacyById = new Map([["prod-db-1", "LEGACY-001"]]);

  const result = reduceLatestChangelogByProduct(rows, productLegacyById);

  assert.deepEqual(Object.keys(result), ["LEGACY-001"]);
  assert.equal(result["LEGACY-001"].versionNumber, 2);
  assert.equal(result["LEGACY-001"].changeDescription, "novo");
});

test("reduceLatestChangelogByProduct — sem legacy_id usa o product_id bruto como chave", () => {
  const rows: ProductChangelogRow[] = [row({ product_id: "prod-db-9", version_number: 5 })];

  const result = reduceLatestChangelogByProduct(rows, new Map());

  assert.deepEqual(Object.keys(result), ["prod-db-9"]);
});

test("reduceLatestChangelogByProduct — vários produtos preservam o último de cada", () => {
  const rows: ProductChangelogRow[] = [
    row({ product_id: "prod-a", version_number: 2, change_description: "a-novo" }),
    row({ product_id: "prod-a", version_number: 1, change_description: "a-antigo" }),
    row({ product_id: "prod-b", version_number: 4, change_description: "b-novo" }),
    row({ product_id: "prod-b", version_number: 3, change_description: "b-antigo" }),
  ];

  const result = reduceLatestChangelogByProduct(rows, new Map());

  assert.equal(result["prod-a"].changeDescription, "a-novo");
  assert.equal(result["prod-b"].changeDescription, "b-novo");
  assert.equal(result["prod-b"].versionNumber, 4);
});

test("reduceLatestChangelogByProduct — changedFields ausente vira lista vazia normalizada", () => {
  const rows: ProductChangelogRow[] = [
    row({ product_id: "prod-x", version_number: 1, snapshot_data: {} }),
    row({ product_id: "prod-y", version_number: 1, snapshot_data: null }),
  ];

  const result = reduceLatestChangelogByProduct(rows, new Map());

  assert.deepEqual(result["prod-x"].changedFields, []);
  assert.deepEqual(result["prod-y"].changedFields, []);
});

test("reduceLatestChangelogByProduct — entrada vazia retorna objeto vazio", () => {
  assert.deepEqual(reduceLatestChangelogByProduct([], new Map()), {});
});
