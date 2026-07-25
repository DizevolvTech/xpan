import { createRequire } from "node:module";
import Module from "node:module";

// `master-data.ts` se protege com `import "server-only"`, um módulo marcador do Next que não
// resolve dentro do runner tsx. Stub síncrono (resolução CJS + cache) ANTES do require abaixo,
// mesmo padrão de `workflow.test.ts`.
const require = createRequire(import.meta.url);
const ModuleAny = Module as unknown as {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
};
const STUB_ID = "\0server-only-stub";
const originalResolve = ModuleAny._resolveFilename;
ModuleAny._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return STUB_ID;
  return originalResolve.call(this, request, ...rest);
};
ModuleAny._cache[STUB_ID] = { id: STUB_ID, exports: {}, loaded: true };

import assert from "node:assert/strict";
import test from "node:test";

import {
  getRecipeStageInstructions,
  resolveRecipeStageOrder,
} from "@/lib/production-planning";
import type { SupabaseDataClient } from "@/lib/supabase-data/common";
import type * as MasterDataModule from "@/lib/supabase-data/master-data";

const { getMasterDataSnapshot } = require(
  "@/lib/supabase-data/master-data",
) as typeof MasterDataModule;

type FakeRow = Record<string, unknown>;

/** Supabase falso: chainable + thenable, filtrando por `.eq()` (basta para o snapshot). */
function createFakeSupabase(tables: Record<string, FakeRow[]>) {
  function makeQuery(table: string) {
    const rows = tables[table] ?? [];
    const filters: Array<[string, unknown]> = [];
    const applyFilters = () => rows.filter((row) => filters.every(([column, value]) => row[column] === value));

    const query: Record<string, unknown> = {
      select: () => query,
      order: () => query,
      limit: () => query,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return query;
      },
      maybeSingle: async () => ({ data: applyFilters()[0] ?? null, error: null }),
      then: (
        resolve: (value: { data: FakeRow[]; error: null }) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: applyFilters(), error: null }).then(resolve, reject),
    };

    return query;
  }

  return { from: (table: string) => makeQuery(table) } as unknown as SupabaseDataClient;
}

const TENANT = "tenant-1";

function buildTables(productOverrides: FakeRow, recipeRows: FakeRow[] = []) {
  return {
    operational_settings: [
      {
        tenant_id: TENANT,
        order_cutoff_time: "12:00:00",
        expedition_lead_days: 1,
        sale_lead_days: 1,
      },
    ],
    subcategories: [
      {
        tenant_id: TENANT,
        id: "db-line-1",
        legacy_id: "line-1",
        code: "LP-001",
        name: "Panificação",
        category_id: "db-cat-1",
        type: "Seco",
        operating_hours: "05:00 - 14:00",
        capacity_per_day_kg: 900,
        status: "ativo",
      },
    ],
    products: [
      {
        tenant_id: TENANT,
        id: "db-product-1",
        legacy_id: "product-1",
        code: "PR-00001",
        name: "Cuca de maçã",
        short_name: "Cuca",
        description: "",
        subcategory_id: "db-line-1",
        operational_subcategory_id: null,
        external_code: null,
        active: true,
        available_for_ordering: true,
        validity_days: 5,
        minimum_production_kg: 0,
        economic_production_kg: 0,
        capacity_per_batch: null,
        economic_batch_unit: null,
        main_ingredient_limit_kg: null,
        allows_storage: false,
        production_days: ["segunda"],
        expedition_lead_days: 1,
        unit_profiles: {},
        packaging_profile: null,
        is_sold_loose: false,
        preparation_mode: "Instrução geral do produto.",
        break_percent: 0,
        break_stage: "depois_divisao",
        break_comment: "",
        can_be_ingredient: false,
        ingredient_profile: null,
        weight_label: "1,000 Kg",
        production_unit: "Kg",
        sales_unit: "Kg",
        sales_to_kg_factor: 1,
        expedition_unit: "Kg",
        expedition_to_kg_factor: 1,
        is_mpi_ingredient: false,
        ...productOverrides,
      },
    ],
    product_recipe_items: recipeRows.map((row) => ({
      tenant_id: TENANT,
      product_id: "db-product-1",
      source_type: "ingrediente",
      ingredient_source_id: null,
      product_source_id: null,
      quantity: 1,
      unit: "Kg",
      observation: "",
      ...row,
    })),
  } satisfies Record<string, FakeRow[]>;
}

async function loadProduct(tables: Record<string, FakeRow[]>, tenantId = TENANT) {
  const snapshot = await getMasterDataSnapshot({
    supabase: createFakeSupabase(tables),
    tenantId,
    forceRefresh: true,
  });
  return snapshot.products[0];
}

test("recipe_stage_config vira recipeStageConfig preservando a ordem da ficha", async () => {
  const config = [
    { stage: "massa", instructions: "Sovar 8 min." },
    { stage: "recheio", instructions: "Cozinhar a maçã." },
    { stage: "montagem", instructions: "Rechear e cobrir com farofa." },
  ];

  const product = await loadProduct(
    buildTables({ recipe_stage_config: config }, [
      { id: "ri-1", label: "Farinha", stage: "massa" },
      { id: "ri-2", label: "Maçã", stage: "recheio" },
      { id: "ri-3", label: "Farofa", stage: "montagem" },
    ]),
  );

  assert.deepEqual(product.recipeStageConfig, config);
  // A ordem da ficha manda: `montagem` vem antes de `acabamento` no enum, mas aqui o que
  // vale é a sequência configurada.
  assert.deepEqual(resolveRecipeStageOrder(product.recipeStageConfig, product.recipe), [
    "massa",
    "recheio",
    "montagem",
  ]);
  assert.equal(getRecipeStageInstructions(product.recipeStageConfig, "recheio"), "Cozinhar a maçã.");
  // A instrução geral do produto continua sendo `preparationMode`.
  assert.equal(product.preparationMode, "Instrução geral do produto.");
});

// RETROCOMPATIBILIDADE: base sem a migration 20260725110000 (coluna ausente no row) + receita
// toda em `massa` tem de se comportar EXATAMENTE como hoje.
test("produto sem a coluna recipe_stage_config se comporta como hoje", async () => {
  const tables = buildTables({}, [
    { id: "ri-1", label: "Farinha", stage: "massa" },
    { id: "ri-2", label: "Água", stage: "massa" },
  ]);
  assert.equal("recipe_stage_config" in tables.products[0], false);

  const product = await loadProduct(tables);

  assert.deepEqual(product.recipeStageConfig, []);
  assert.deepEqual(resolveRecipeStageOrder(product.recipeStageConfig, product.recipe), ["massa"]);
  assert.equal(getRecipeStageInstructions(product.recipeStageConfig, "massa"), "");
  assert.equal(product.preparationMode, "Instrução geral do produto.");
  assert.equal(product.recipe.length, 2);
});

test("recipe_stage_config nulo ou com lixo é normalizado sem quebrar a carga", async () => {
  const product = await loadProduct(
    buildTables(
      {
        recipe_stage_config: [
          { stage: "montagem", instructions: "Rechear." },
          { stage: "inexistente", instructions: "lixo" },
          { stage: "montagem", instructions: "duplicada" },
          null,
          "texto solto",
          { stage: "massa" },
        ],
      },
      [{ id: "ri-1", label: "Farinha", stage: "massa" }],
    ),
  );

  assert.deepEqual(product.recipeStageConfig, [
    { stage: "montagem", instructions: "Rechear." },
    { stage: "massa", instructions: "" },
  ]);
  // `montagem` está configurada mas não tem ingrediente: sem `includeEmpty` ela não entra.
  assert.deepEqual(resolveRecipeStageOrder(product.recipeStageConfig, product.recipe), ["massa"]);
});

test("recipe_stage_config = null (coluna existe, valor nulo) vira array vazio", async () => {
  const product = await loadProduct(
    buildTables({ recipe_stage_config: null }, [{ id: "ri-1", label: "Farinha", stage: "massa" }]),
  );

  assert.deepEqual(product.recipeStageConfig, []);
});
