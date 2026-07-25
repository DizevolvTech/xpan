import { createRequire } from "node:module";
import Module from "node:module";

// `master-data-admin.ts` se protege com `import "server-only"`, um módulo marcador do Next
// que não resolve dentro do runner tsx. Stub síncrono (resolução CJS + cache) ANTES do require
// abaixo, mesmo padrão de `workflow.test.ts`.
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

import type { SupabaseDataClient } from "@/lib/supabase-data/common";
import type * as MasterDataAdminModule from "@/lib/supabase-data/master-data-admin";

const { cloneProduct, createProduct, updateProduct } = require(
  "@/lib/supabase-data/master-data-admin",
) as typeof MasterDataAdminModule;

type ProductInput = MasterDataAdminModule.ProductInput;
type FakeRow = Record<string, unknown>;
type RecordedWrite = { table: string; op: "insert" | "update" | "delete"; payload: FakeRow | null };

/* -------------------------------------------------------------------------------------------------
 * Supabase falso: chainable + thenable, com uma lista de colunas que "não existem" no banco.
 * É assim que simulamos um tenant sem a migration 20260725110000 — o PostgREST responde
 * PGRST204 "Could not find the '<coluna>' column ... in the schema cache" para o INSERT/UPDATE
 * que menciona a coluna nova.
 * -----------------------------------------------------------------------------------------------*/
function createFakeSupabase(
  options: { tables?: Record<string, FakeRow[]>; missingColumns?: string[] } = {},
) {
  const tables = options.tables ?? {};
  const missingColumns = options.missingColumns ?? [];
  const writes: RecordedWrite[] = [];

  function missingColumnError(table: string, payload: FakeRow) {
    const offending = missingColumns.find((column) => column in payload);
    if (!offending) {
      return null;
    }
    return {
      code: "PGRST204",
      message: `Could not find the '${offending}' column of '${table}' in the schema cache`,
      details: null,
      hint: null,
    };
  }

  function makeQuery(table: string) {
    let rows = [...(tables[table] ?? [])];
    let error: ReturnType<typeof missingColumnError> = null;
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
      insert: (payload: FakeRow | FakeRow[]) => {
        const inserted = Array.isArray(payload) ? payload : [payload];
        error = inserted.map((row) => missingColumnError(table, row)).find(Boolean) ?? null;
        if (!error) {
          for (const row of inserted) {
            writes.push({ table, op: "insert", payload: row });
          }
        }
        // O `.select("id").single()` do create/clone lê daqui.
        rows = error ? [] : [{ id: `${table}-inserted` }];
        return query;
      },
      update: (payload: FakeRow) => {
        error = missingColumnError(table, payload);
        if (!error) {
          writes.push({ table, op: "update", payload });
        }
        rows = [];
        return query;
      },
      delete: () => {
        writes.push({ table, op: "delete", payload: null });
        rows = [];
        return query;
      },
      single: async () => ({ data: error ? null : rows[0] ?? null, error }),
      maybeSingle: async () => ({ data: error ? null : applyFilters()[0] ?? null, error }),
      then: (resolve: (value: { data: FakeRow[] | null; error: unknown }) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve({ data: error ? null : applyFilters(), error }).then(resolve, reject),
    };

    return query;
  }

  return {
    client: { from: (table: string) => makeQuery(table) } as unknown as SupabaseDataClient,
    writes,
  };
}

function findWrite(writes: RecordedWrite[], table: string, op: RecordedWrite["op"]) {
  return writes.filter((write) => write.table === table && write.op === op);
}

/** Silencia (e captura) o console.warn do fallback sem migration. */
async function withCapturedWarnings<T>(run: () => Promise<T>) {
  const original = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };
  try {
    return { result: await run(), warnings };
  } finally {
    console.warn = original;
  }
}

const SUBCATEGORY_ROW: FakeRow = { id: "db-line-1", legacy_id: "line-1" };

/**
 * Produto de referência já persistido. Os campos cronograma-relevantes (`active`,
 * `available_for_ordering`, `production_days`, `expedition_lead_days`, `minimum_production_kg`,
 * `capacity_per_batch`) batem com o input abaixo de propósito: assim o `updateProduct` não
 * dispara reconstrução de revisão de cronograma e o teste fica focado na coluna nova.
 */
function buildProductRow(overrides: FakeRow = {}): FakeRow {
  return {
    id: "db-product-1",
    legacy_id: "product-1",
    code: "PR-00001",
    tenant_id: "tenant-1",
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
    sale_lead_days: 1,
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
    is_mpi_ingredient: false,
    weight_label: "1,000 Kg",
    production_unit: "Kg",
    sales_unit: "Kg",
    sales_to_kg_factor: 1,
    expedition_unit: "Kg",
    expedition_to_kg_factor: 1,
    ...overrides,
  };
}

function buildProductInput(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    name: "Cuca de maçã",
    shortName: "Cuca",
    description: "",
    lineId: "line-1",
    active: true,
    availableForOrdering: true,
    validityDays: 5,
    minimumProductionKg: 0,
    economicProductionKg: 0,
    allowsStorage: false,
    productionDays: ["segunda"],
    expeditionLeadDays: 1,
    unitProfiles: {
      sales: { unit: "Kg", description: "Venda", weightKg: 1 },
      production: { unit: "Kg", description: "Produção", weightKg: 1 },
      expedition: { unit: "Kg", description: "Expedição", weightKg: 1 },
    },
    isSoldLoose: false,
    recipe: [],
    preparationStages: ["em_preparacao"],
    preparationMode: "Instrução geral do produto.",
    breakPercent: 0,
    breakStage: "depois_divisao",
    breakComment: "",
    canBeIngredient: false,
    weight: "1,000 Kg",
    productionUnit: "Kg",
    salesUnit: "Kg",
    salesToKgFactor: 1,
    expeditionUnit: "Kg",
    expeditionToKgFactor: 1,
    isMpiIngredient: false,
    capacityPerBatch: null,
    economicBatchUnit: null,
    mainIngredientLimitKg: null,
    ...overrides,
  };
}

const CUCA_STAGE_CONFIG: ProductInput["recipeStageConfig"] = [
  { stage: "massa", instructions: "Sovar 8 min e descansar." },
  { stage: "recheio", instructions: "Cozinhar a maçã com açúcar." },
  { stage: "montagem", instructions: "Rechear e cobrir com farofa." },
];

test("createProduct grava recipe_stage_config na ordem da ficha", async () => {
  const { client, writes } = createFakeSupabase({
    tables: { subcategories: [SUBCATEGORY_ROW], products: [] },
  });

  await createProduct(buildProductInput({ recipeStageConfig: CUCA_STAGE_CONFIG }), {
    supabase: client,
  });

  const [insert] = findWrite(writes, "products", "insert");
  assert.deepEqual(insert.payload?.recipe_stage_config, CUCA_STAGE_CONFIG);
  // A instrução geral do produto não muda de significado nem é substituída.
  assert.equal(insert.payload?.preparation_mode, "Instrução geral do produto.");
});

test("createProduct normaliza o JSONB (etapa desconhecida/duplicada não é gravada)", async () => {
  const { client, writes } = createFakeSupabase({
    tables: { subcategories: [SUBCATEGORY_ROW], products: [] },
  });

  await createProduct(
    buildProductInput({
      recipeStageConfig: [
        { stage: "esponja", instructions: "Fermentar 12h." },
        { stage: "inexistente", instructions: "lixo" },
        { stage: "esponja", instructions: "duplicada" },
      ] as ProductInput["recipeStageConfig"],
    }),
    { supabase: client },
  );

  const [insert] = findWrite(writes, "products", "insert");
  assert.deepEqual(insert.payload?.recipe_stage_config, [
    { stage: "esponja", instructions: "Fermentar 12h." },
  ]);
});

// Retrocompatibilidade: produto legado (form sem a config) grava array vazio — mesmo valor do
// default da coluna, ou seja, ordem canônica do enum e sem instrução por bloco.
test("createProduct de produto sem config grava recipe_stage_config vazio", async () => {
  const { client, writes } = createFakeSupabase({
    tables: { subcategories: [SUBCATEGORY_ROW], products: [] },
  });

  await createProduct(buildProductInput(), { supabase: client });

  const [insert] = findWrite(writes, "products", "insert");
  assert.deepEqual(insert.payload?.recipe_stage_config, []);
});

// Sem a migration aplicada, o save INTEIRO do produto quebraria por causa da coluna nova.
// O INSERT é atômico (nada foi gravado), então repetimos sem ela: perde-se só a config.
test("createProduct sobrevive a banco sem a coluna recipe_stage_config", async () => {
  const { client, writes } = createFakeSupabase({
    tables: { subcategories: [SUBCATEGORY_ROW], products: [] },
    missingColumns: ["recipe_stage_config"],
  });

  const { result, warnings } = await withCapturedWarnings(() =>
    createProduct(buildProductInput({ recipeStageConfig: CUCA_STAGE_CONFIG }), { supabase: client }),
  );

  assert.equal(result.code, "PR-00001");
  const inserts = findWrite(writes, "products", "insert");
  assert.equal(inserts.length, 1, "só a segunda tentativa (sem a coluna) chega a gravar");
  assert.equal("recipe_stage_config" in (inserts[0].payload ?? {}), false);
  // O resto do cadastro tem de estar intacto na regravação.
  assert.equal(inserts[0].payload?.name, "Cuca de maçã");
  assert.equal(inserts[0].payload?.preparation_mode, "Instrução geral do produto.");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /recipe_stage_config/);
});

test("updateProduct grava recipe_stage_config", async () => {
  const { client, writes } = createFakeSupabase({
    tables: { subcategories: [SUBCATEGORY_ROW], products: [buildProductRow()] },
  });

  await updateProduct("product-1", buildProductInput({ recipeStageConfig: CUCA_STAGE_CONFIG }), {
    supabase: client,
  });

  const [update] = findWrite(writes, "products", "update");
  assert.deepEqual(update.payload?.recipe_stage_config, CUCA_STAGE_CONFIG);
});

test("updateProduct sobrevive a banco sem a coluna recipe_stage_config", async () => {
  const { client, writes } = createFakeSupabase({
    tables: { subcategories: [SUBCATEGORY_ROW], products: [buildProductRow()] },
    missingColumns: ["recipe_stage_config"],
  });

  const { warnings } = await withCapturedWarnings(() =>
    updateProduct("product-1", buildProductInput({ recipeStageConfig: CUCA_STAGE_CONFIG }), {
      supabase: client,
    }),
  );

  const updates = findWrite(writes, "products", "update");
  assert.equal(updates.length, 1, "só a segunda tentativa (sem a coluna) chega a gravar");
  assert.equal("recipe_stage_config" in (updates[0].payload ?? {}), false);
  assert.equal(updates[0].payload?.name, "Cuca de maçã");
  assert.equal(warnings.length, 1);
});

// Produto legado sem etapa configurada tem de continuar salvando igual: nada de config,
// nenhuma reconstrução de revisão de cronograma disparada pela coluna nova.
test("updateProduct de produto legado grava config vazia e não mexe no cronograma", async () => {
  const { client, writes } = createFakeSupabase({
    tables: { subcategories: [SUBCATEGORY_ROW], products: [buildProductRow()] },
  });

  const result = await updateProduct("product-1", buildProductInput(), { supabase: client });

  const [update] = findWrite(writes, "products", "update");
  assert.deepEqual(update.payload?.recipe_stage_config, []);
  assert.deepEqual(result, { scheduleRevisionImpact: null });
  assert.equal(findWrite(writes, "schedule_lines", "insert").length, 0);
});

// A cópia enumera colunas na mão e já perdeu campo antes (observação da receita).
test("cloneProduct leva recipe_stage_config junto", async () => {
  const { client, writes } = createFakeSupabase({
    tables: {
      products: [buildProductRow({ recipe_stage_config: CUCA_STAGE_CONFIG })],
      product_recipe_items: [],
      product_preparation_steps: [],
    },
  });

  await cloneProduct("product-1", { supabase: client });

  const [insert] = findWrite(writes, "products", "insert");
  assert.deepEqual(insert.payload?.recipe_stage_config, CUCA_STAGE_CONFIG);
  assert.equal(insert.payload?.name, "[Cópia] Cuca de maçã");
});

test("cloneProduct de produto legado copia config vazia", async () => {
  const { client, writes } = createFakeSupabase({
    tables: {
      products: [buildProductRow()],
      product_recipe_items: [],
      product_preparation_steps: [],
    },
  });

  await cloneProduct("product-1", { supabase: client });

  const [insert] = findWrite(writes, "products", "insert");
  assert.deepEqual(insert.payload?.recipe_stage_config, []);
});

test("cloneProduct sobrevive a banco sem a coluna recipe_stage_config", async () => {
  const { client, writes } = createFakeSupabase({
    tables: {
      products: [buildProductRow()],
      product_recipe_items: [],
      product_preparation_steps: [],
    },
    missingColumns: ["recipe_stage_config"],
  });

  const { result, warnings } = await withCapturedWarnings(() =>
    cloneProduct("product-1", { supabase: client }),
  );

  assert.equal(result.code, "PR-00002");
  const inserts = findWrite(writes, "products", "insert");
  assert.equal(inserts.length, 1);
  assert.equal("recipe_stage_config" in (inserts[0].payload ?? {}), false);
  assert.equal(inserts[0].payload?.name, "[Cópia] Cuca de maçã");
  assert.equal(warnings.length, 1);
});
