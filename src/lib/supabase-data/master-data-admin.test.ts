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

const { MasterDataValidationError, cloneProduct, confirmPendingScheduleRevision, createProduct, createStore, updateProduct, updateScheduleLineStatus, updateStore } = require(
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
    const notEqual: Array<[string, unknown]> = [];
    const inFilters: Array<[string, unknown[]]> = [];
    const likeFilters: Array<[string, RegExp]> = [];
    const applyFilters = () =>
      rows.filter(
        (row) =>
          filters.every(([column, value]) => row[column] === value) &&
          notEqual.every(([column, value]) => row[column] !== value) &&
          inFilters.every(([column, values]) => values.includes(row[column])) &&
          likeFilters.every(([column, regex]) => regex.test(String(row[column] ?? ""))),
      );

    const query: Record<string, unknown> = {
      select: () => query,
      order: () => query,
      limit: () => query,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return query;
      },
      neq: (column: string, value: unknown) => {
        notEqual.push([column, value]);
        return query;
      },
      in: (column: string, values: unknown[]) => {
        inFilters.push([column, values]);
        return query;
      },
      like: (column: string, pattern: string) => {
        const regex = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`);
        likeFilters.push([column, regex]);
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

test("createProduct grava lab_test da ficha amarela", async () => {
  const { client, writes } = createFakeSupabase({
    tables: { subcategories: [SUBCATEGORY_ROW], products: [] },
  });
  const labTest = {
    rawUnitWeightKg: null,
    rawDoughKg: 78.878,
    bakedKg: 73.525,
    leftoverBakedKg: 0,
    unitCount: 173,
    labelWeightKg: 0.4,
  };

  await createProduct(buildProductInput({ labTest, breakPercent: 6.79 }), { supabase: client });

  const [insert] = findWrite(writes, "products", "insert");
  assert.deepEqual(insert.payload?.lab_test, labTest);
  assert.equal(insert.payload?.break_percent, 6.79);
});

test("createProduct sobrevive a banco sem a coluna lab_test", async () => {
  const { client, writes } = createFakeSupabase({
    tables: { subcategories: [SUBCATEGORY_ROW], products: [] },
    missingColumns: ["lab_test"],
  });

  const { result, warnings } = await withCapturedWarnings(() =>
    createProduct(buildProductInput({ labTest: { bakedKg: 73.525, unitCount: 173 } as ProductInput["labTest"] }), {
      supabase: client,
    }),
  );

  assert.equal(result.code, "PR-00001");
  const inserts = findWrite(writes, "products", "insert");
  assert.equal("lab_test" in (inserts[0].payload ?? {}), false);
  assert.equal(inserts[0].payload?.name, "Cuca de maçã");
  assert.match(warnings[0], /lab_test/);
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

/* -------------------------------------------------------------------------------------------------
 * Versões do produto: o registro tinha um defeito silencioso — o autor chega como id de texto
 * ("user-...") e a coluna é uuid, então o insert falhava e a versão sumia sem erro nenhum.
 * -----------------------------------------------------------------------------------------------*/
const PROFILE_ROW: FakeRow = { id: "11111111-1111-4111-8111-111111111111", legacy_id: "user-ana", name: "Ana" };

test("updateProduct registra a versão com o autor resolvido (id de texto → uuid do perfil)", async () => {
  const { client, writes } = createFakeSupabase({
    tables: { subcategories: [SUBCATEGORY_ROW], products: [buildProductRow()], profiles: [PROFILE_ROW] },
  });

  const result = await updateProduct(
    "product-1",
    buildProductInput({ changeDescription: "Ajustou o peso da receita" }),
    { supabase: client, actingProfileId: "user-ana" },
  );

  const inserts = findWrite(writes, "product_changelog", "insert");
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].payload?.version_number, 1);
  assert.equal(inserts[0].payload?.change_description, "Ajustou o peso da receita");
  assert.equal(inserts[0].payload?.changed_by_profile_id, PROFILE_ROW.id, "uuid do perfil, não o id de texto");
  assert.equal(inserts[0].payload?.changed_by_name, "Ana");
  assert.equal((result as { versionRecorded?: boolean }).versionRecorded, true);
});

test("a foto da versão leva o cadastro de processo e NÃO leva código, GTIN, ativo nem o motivo", async () => {
  const { client, writes } = createFakeSupabase({
    tables: { subcategories: [SUBCATEGORY_ROW], products: [buildProductRow()], profiles: [PROFILE_ROW] },
  });

  await updateProduct(
    "product-1",
    buildProductInput({ changeDescription: "x", externalCode: "703936", gtin: "7891234567895", recipeStageConfig: CUCA_STAGE_CONFIG }),
    { supabase: client, actingProfileId: "user-ana" },
  );

  const snapshot = findWrite(writes, "product_changelog", "insert")[0].payload?.product_snapshot as Record<string, unknown>;
  assert.equal(snapshot.name, "Cuca de maçã");
  assert.deepEqual(snapshot.recipeStageConfig, CUCA_STAGE_CONFIG);
  assert.deepEqual(snapshot.productionDays, ["segunda"]);
  for (const key of ["id", "code", "externalCode", "gtin", "active", "availableForOrdering", "changeDescription", "versionBaseline"]) {
    assert.equal(key in snapshot, false, `${key} não pode ir na foto`);
  }
});

test("primeira edição de produto sem versões grava antes a versão base (estado anterior) e depois a nova", async () => {
  const { client, writes } = createFakeSupabase({
    tables: { subcategories: [SUBCATEGORY_ROW], products: [buildProductRow()], profiles: [PROFILE_ROW] },
  });

  await updateProduct(
    "product-1",
    buildProductInput({
      name: "Cuca de maçã V2",
      changeDescription: "Mudou o nome",
      versionBaseline: { name: "Cuca de maçã", validityDays: 5, recipe: [] },
    }),
    { supabase: client, actingProfileId: "user-ana" },
  );

  const inserts = findWrite(writes, "product_changelog", "insert");
  assert.equal(inserts.length, 2);
  assert.equal(inserts[0].payload?.version_number, 1);
  assert.equal(inserts[0].payload?.change_description, "Estado anterior ao primeiro registro de versões");
  assert.equal((inserts[0].payload?.product_snapshot as Record<string, unknown>).name, "Cuca de maçã");
  assert.equal(inserts[1].payload?.version_number, 2);
  assert.equal((inserts[1].payload?.product_snapshot as Record<string, unknown>).name, "Cuca de maçã V2");
});

test("produto que já tem versão com foto não ganha outra versão base", async () => {
  const { client, writes } = createFakeSupabase({
    tables: {
      subcategories: [SUBCATEGORY_ROW],
      products: [buildProductRow()],
      profiles: [PROFILE_ROW],
      product_changelog: [{ product_id: "db-product-1", version_number: 4, product_snapshot: { name: "antiga" } }],
    },
  });

  await updateProduct(
    "product-1",
    buildProductInput({ changeDescription: "Nova", versionBaseline: { name: "Cuca de maçã" } }),
    { supabase: client, actingProfileId: "user-ana" },
  );

  const inserts = findWrite(writes, "product_changelog", "insert");
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].payload?.version_number, 5);
});

test("falha ao registrar a versão NÃO desfaz o produto salvo e é sinalizada (versionRecorded=false)", async () => {
  const { client, writes } = createFakeSupabase({
    tables: { subcategories: [SUBCATEGORY_ROW], products: [buildProductRow()], profiles: [PROFILE_ROW] },
    missingColumns: ["product_snapshot"],
  });

  const originalError = console.error;
  const errors: string[] = [];
  console.error = (...args: unknown[]) => errors.push(args.map(String).join(" "));
  let result: Awaited<ReturnType<typeof updateProduct>>;
  try {
    result = await updateProduct("product-1", buildProductInput({ changeDescription: "x" }), {
      supabase: client,
      actingProfileId: "user-ana",
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(findWrite(writes, "products", "update").length, 1, "o produto foi salvo");
  assert.equal((result as { versionRecorded?: boolean }).versionRecorded, false);
  assert.equal(errors.length, 1, "a falha é registrada no log, não engolida");
});

test("sem motivo da alteração não grava versão e não devolve versionRecorded", async () => {
  const { client, writes } = createFakeSupabase({
    tables: { subcategories: [SUBCATEGORY_ROW], products: [buildProductRow()], profiles: [PROFILE_ROW] },
  });

  const result = await updateProduct("product-1", buildProductInput(), { supabase: client, actingProfileId: "user-ana" });

  assert.equal(findWrite(writes, "product_changelog", "insert").length, 0);
  assert.equal("versionRecorded" in result, false);
});

/* -------------------------------------------------------------------------------------------------
 * Mix de produtos por loja (cliente, 07/10): filtro de apresentação guardado em stores.product_mix.
 * null = todos os produtos. Quem salva a loja sem enviar o campo nunca apaga o mix existente.
 * -----------------------------------------------------------------------------------------------*/
type StoreInputType = MasterDataAdminModule.StoreInput;

function buildStoreRow(overrides: FakeRow = {}): FakeRow {
  return {
    id: "db-store-1",
    legacy_id: "store-1",
    code: "LJ-001",
    name: "Loja Centro",
    responsible_profile_id: null,
    product_mix: null,
    ...overrides,
  };
}

function buildStoreInput(overrides: Partial<StoreInputType> = {}): StoreInputType {
  return {
    name: "Loja Centro",
    responsible: "",
    responsibleProfileId: null,
    email: "loja@teste.com",
    phone: "85999999999",
    status: "ativo",
    receiveWindow: "07:00 - 10:00",
    orderingDays: ["segunda"],
    receivingDays: ["segunda"],
    orderingBlockedDays: [],
    receivingBlockedDays: [],
    deliveryZone: null,
    ...overrides,
  };
}

test("updateStore grava o mix escolhido (lista de produtos, sem repetidos)", async () => {
  const { client, writes } = createFakeSupabase({ tables: { stores: [buildStoreRow()] } });

  await updateStore("store-1", buildStoreInput({ productMix: ["p-1", "p-2", "p-1"] }), { supabase: client });

  const updates = findWrite(writes, "stores", "update");
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].payload?.product_mix, ["p-1", "p-2"]);
});

test("updateStore com productMix null volta a loja para 'todos os produtos'", async () => {
  const { client, writes } = createFakeSupabase({ tables: { stores: [buildStoreRow({ product_mix: ["p-1"] })] } });

  await updateStore("store-1", buildStoreInput({ productMix: null }), { supabase: client });

  const updates = findWrite(writes, "stores", "update");
  assert.ok("product_mix" in (updates[0].payload ?? {}), "o campo é enviado para limpar o mix");
  assert.equal(updates[0].payload?.product_mix, null);
});

test("updateStore SEM o campo productMix não mexe no mix existente", async () => {
  const { client, writes } = createFakeSupabase({ tables: { stores: [buildStoreRow({ product_mix: ["p-1"] })] } });

  await updateStore("store-1", buildStoreInput(), { supabase: client });

  const updates = findWrite(writes, "stores", "update");
  assert.equal(updates.length, 1);
  assert.equal("product_mix" in (updates[0].payload ?? {}), false, "payload não pode carregar product_mix");
});

test("updateStore recusa mix vazio ou inválido e não grava nada", async () => {
  for (const invalid of [[], [""], "p-1", 3] as unknown[]) {
    const { client, writes } = createFakeSupabase({ tables: { stores: [buildStoreRow()] } });

    await assert.rejects(
      () => updateStore("store-1", buildStoreInput({ productMix: invalid as string[] }), { supabase: client }),
      (error: unknown) => error instanceof MasterDataValidationError,
      JSON.stringify(invalid),
    );
    assert.equal(findWrite(writes, "stores", "update").length, 0, JSON.stringify(invalid));
  }
});

test("createStore grava o mix na criação e, sem o campo, não envia product_mix", async () => {
  const withMix = createFakeSupabase({ tables: { stores: [] } });
  await createStore(buildStoreInput({ productMix: ["p-9"] }), { supabase: withMix.client });
  assert.deepEqual(findWrite(withMix.writes, "stores", "insert")[0].payload?.product_mix, ["p-9"]);

  const withoutMix = createFakeSupabase({ tables: { stores: [] } });
  await createStore(buildStoreInput(), { supabase: withoutMix.client });
  assert.equal("product_mix" in (findWrite(withoutMix.writes, "stores", "insert")[0].payload ?? {}), false);
});


/* -------------------------------------------------------------------------------------------------
 * Simplificação do cronograma — updateScheduleLineStatus
 * -----------------------------------------------------------------------------------------------*/
const SCHEDULE_UUID = "11111111-1111-4111-8111-111111111111";
const SCHEDULE_TABLES = (status: string, itemDays: string[] = ["segunda", "quarta"]) => ({
  schedule_lines: [
    { id: SCHEDULE_UUID, legacy_id: "sl-1", tenant_id: "tenant-1", subcategory_id: "sub-1", status, audit_notes: null },
  ],
  schedule_line_item_snapshots: [{ id: "item-1", schedule_line_id: SCHEDULE_UUID, production_days: itemDays }],
  profiles: [{ id: "profile-1", legacy_id: "user-1", name: "Gestora Ana" }],
});

test("cronograma ATIVO: reordenar dentro do mesmo dia salva, não reaprova e grava o histórico", async () => {
  const { client, writes } = createFakeSupabase({ tables: SCHEDULE_TABLES("ativo") });
  await updateScheduleLineStatus(
    "sl-1",
    { status: "ativo", dayPrioritiesByItemId: { "item-1": { segunda: 2, quarta: 1 } } },
    { supabase: client, actingProfileId: "user-1" },
  );
  const lineUpdates = findWrite(writes, "schedule_lines", "update");
  assert.equal(lineUpdates.length, 0, "não mexe em status, aprovador nem data de aprovação");
  assert.equal(findWrite(writes, "schedule_line_item_snapshots", "update").length, 1);
  const events = findWrite(writes, "schedule_line_events", "insert");
  assert.equal(events.length, 1);
  assert.equal(events[0].payload?.event_type, "prioridades_atualizadas");
  assert.equal(events[0].payload?.actor_name, "Gestora Ana");
  assert.equal(events[0].payload?.tenant_id, "tenant-1");
});

test("cronograma ATIVO: mudar o DIA de produção é recusado (continua pela edição do produto)", async () => {
  const { client, writes } = createFakeSupabase({ tables: SCHEDULE_TABLES("ativo") });
  await assert.rejects(
    updateScheduleLineStatus(
      "sl-1",
      { status: "ativo", dayPrioritiesByItemId: { "item-1": { terca: 1 } } },
      { supabase: client, actingProfileId: "user-1" },
    ),
    /mesmo dia/,
  );
  assert.equal(findWrite(writes, "schedule_line_item_snapshots", "update").length, 0);
  assert.equal(findWrite(writes, "schedule_line_events", "insert").length, 0);
});

test("aprovar revisão PENDENTE grava o aprovador e o evento 'aprovado'", async () => {
  const { client, writes } = createFakeSupabase({ tables: SCHEDULE_TABLES("pendente") });
  await updateScheduleLineStatus("sl-1", { status: "ativo", auditNotes: "ok" }, { supabase: client, actingProfileId: "user-1" });
  const updates = findWrite(writes, "schedule_lines", "update");
  assert.equal(updates.at(-1)?.payload?.status, "ativo");
  assert.equal(updates.at(-1)?.payload?.audited_by_profile_id, "profile-1");
  assert.equal(findWrite(writes, "schedule_line_events", "insert")[0].payload?.event_type, "aprovado");
});

test("confirmar com ordens em andamento grava o evento próprio", async () => {
  const { client, writes } = createFakeSupabase({ tables: SCHEDULE_TABLES("pendente") });
  await updateScheduleLineStatus(
    "sl-1",
    { status: "ativo", confirmedWithCommittedWork: true },
    { supabase: client, actingProfileId: "user-1" },
  );
  assert.equal(
    findWrite(writes, "schedule_line_events", "insert")[0].payload?.event_type,
    "confirmado_com_ordens_em_andamento",
  );
});

test("devolver para ajuste e desativar gravam eventos distintos", async () => {
  const pending = createFakeSupabase({ tables: SCHEDULE_TABLES("pendente") });
  await updateScheduleLineStatus("sl-1", { status: "inativo", auditNotes: "refazer terça" }, { supabase: pending.client, actingProfileId: "user-1" });
  const returned = findWrite(pending.writes, "schedule_line_events", "insert")[0].payload;
  assert.equal(returned?.event_type, "devolvido_ajuste");
  assert.equal(returned?.note, "refazer terça");

  const active = createFakeSupabase({ tables: SCHEDULE_TABLES("ativo") });
  await updateScheduleLineStatus("sl-1", { status: "inativo" }, { supabase: active.client, actingProfileId: "user-1" });
  assert.equal(findWrite(active.writes, "schedule_line_events", "insert")[0].payload?.event_type, "desativado");
});

test("falha ao gravar o histórico NÃO desfaz a mudança do cronograma", async () => {
  const { client, writes } = createFakeSupabase({
    tables: SCHEDULE_TABLES("pendente"),
    missingColumns: ["event_type"],
  });
  const original = console.error;
  console.error = () => {};
  try {
    await updateScheduleLineStatus("sl-1", { status: "ativo" }, { supabase: client, actingProfileId: "user-1" });
  } finally {
    console.error = original;
  }
  assert.equal(findWrite(writes, "schedule_lines", "update").at(-1)?.payload?.status, "ativo");
});


/* -------------------------------------------------------------------------------------------------
 * Simplificação do cronograma — edição do produto que muda os dias de produção
 * -----------------------------------------------------------------------------------------------*/
const LINE_SUB: FakeRow = { id: "db-line-1", legacy_id: "line-1", name: "Linha Pães", tenant_id: "tenant-1" };
const ACTIVE_SCHEDULE: FakeRow = {
  id: "sched-active",
  name: "Cronograma Pães",
  code: "SL-0001",
  subcategory_id: "db-line-1",
  status: "ativo",
  created_at: "2026-09-01T10:00:00Z",
  audited_at: "2026-09-01T11:00:00Z",
};

function scheduleEditTables(extra: Record<string, FakeRow[]> = {}) {
  return {
    subcategories: [LINE_SUB],
    products: [
      buildProductRow({ operational_subcategory_id: "db-line-1" }),
    ],
    schedule_lines: [ACTIVE_SCHEDULE],
    schedule_line_item_snapshots: [],
    profiles: [{ id: "profile-1", legacy_id: "user-1", name: "Gestora Ana" }],
    workflow_production_items: [],
    workflow_production_starts: [],
    store_order_items: [],
    workflow_order_releases: [],
    ...extra,
  };
}

test("editar os dias do produto numa linha SEM ordens em andamento ativa o cronograma sozinho", async () => {
  const { client, writes } = createFakeSupabase({ tables: scheduleEditTables() });
  const result = await updateProduct(
    "product-1",
    buildProductInput({ productionDays: ["terca"] }),
    { supabase: client, actingProfileId: "user-1" },
  );
  assert.equal(result.scheduleRevisionImpact?.outcome, "activated");
  assert.deepEqual(result.scheduleRevisionImpact?.scheduleIdsAwaitingConfirmation, []);
  const scheduleUpdates = findWrite(writes, "schedule_lines", "update");
  assert.ok(scheduleUpdates.some((w) => w.payload?.status === "ativo" && w.payload?.audited_by_profile_id === "profile-1"));
  const events = findWrite(writes, "schedule_line_events", "insert").map((w) => w.payload?.event_type);
  assert.deepEqual(events, ["revisao_aberta", "ativado_automatico"]);
});

test("editar os dias do produto com ORDEM EM ANDAMENTO mantém o ativo e pede uma confirmação", async () => {
  const { client, writes } = createFakeSupabase({
    tables: scheduleEditTables({
      workflow_production_items: [{ production_item_key: "2026-10-12|line-1|product-1", status: "em_producao" }],
    }),
  });
  const result = await updateProduct(
    "product-1",
    buildProductInput({ productionDays: ["terca"] }),
    { supabase: client, actingProfileId: "user-1" },
  );
  assert.equal(result.scheduleRevisionImpact?.outcome, "awaiting_confirmation");
  assert.equal(result.scheduleRevisionImpact?.activeScheduleKept, true);
  assert.equal(result.scheduleRevisionImpact?.scheduleIdsAwaitingConfirmation?.length, 1);
  const scheduleUpdates = findWrite(writes, "schedule_lines", "update");
  assert.equal(scheduleUpdates.some((w) => w.payload?.status === "ativo"), false, "não ativa sem confirmar");
  assert.equal(scheduleUpdates.some((w) => w.payload?.status === "inativo"), false, "não derruba o ativo");
  const events = findWrite(writes, "schedule_line_events", "insert").map((w) => w.payload?.event_type);
  assert.deepEqual(events, ["revisao_aberta"]);
});

test("pedido liberado na linha também conta como trabalho comprometido", async () => {
  const { client } = createFakeSupabase({
    tables: scheduleEditTables({
      store_order_items: [{ product_id: "db-product-1", order_id: "order-1" }],
      workflow_order_releases: [{ order_id: "order-1" }],
    }),
  });
  const result = await updateProduct(
    "product-1",
    buildProductInput({ productionDays: ["terca"] }),
    { supabase: client, actingProfileId: "user-1" },
  );
  assert.equal(result.scheduleRevisionImpact?.outcome, "awaiting_confirmation");
});

test("edição que não toca o cronograma (só nome) não abre nem ativa revisão", async () => {
  const { client, writes } = createFakeSupabase({ tables: scheduleEditTables() });
  const result = await updateProduct(
    "product-1",
    buildProductInput({ name: "Cuca de maçã e canela" }),
    { supabase: client, actingProfileId: "user-1" },
  );
  assert.equal(result.scheduleRevisionImpact, null);
  assert.equal(findWrite(writes, "schedule_line_events", "insert").length, 0);
});


test("confirmar a revisão da edição do produto ativa só a PENDENTE e grava o evento próprio", async () => {
  const { client, writes } = createFakeSupabase({ tables: SCHEDULE_TABLES("pendente") });
  await confirmPendingScheduleRevision("sl-1", { supabase: client, actingProfileId: "user-1" });
  const updates = findWrite(writes, "schedule_lines", "update");
  assert.ok(updates.some((w) => w.payload?.status === "ativo" && w.payload?.audited_by_profile_id === "profile-1"));
  const events = findWrite(writes, "schedule_line_events", "insert");
  assert.equal(events.length, 1);
  assert.equal(events[0].payload?.event_type, "confirmado_com_ordens_em_andamento");
  assert.equal(events[0].payload?.actor_name, "Gestora Ana");
});

test("confirmar revisão que já não está pendente é recusado e não grava nada", async () => {
  for (const status of ["ativo", "inativo"]) {
    const { client, writes } = createFakeSupabase({ tables: SCHEDULE_TABLES(status) });
    await assert.rejects(
      confirmPendingScheduleRevision("sl-1", { supabase: client, actingProfileId: "user-1" }),
      /não está mais pendente/,
    );
    assert.equal(writes.length, 0, status);
  }
});
