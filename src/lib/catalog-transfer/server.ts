import "server-only";

import { buildProductVersionSnapshot, BASELINE_VERSION_DESCRIPTION } from "@/lib/product-version-snapshot";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { getMasterDataSnapshot } from "@/lib/supabase-data/master-data";

import { buildCatalogFile, type BuildCatalogFileInput } from "./build-file";
import { buildImportPlan, formatImportDescription, UndoLog } from "./plan";
import type { CatalogDestination, CatalogFile, FieldChange, ImportPlan, Row } from "./types";

/** Cliente já filtrado por tenant (createTenantScopedSupabaseClient). O tipo gerado do banco está defasado. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LooseClient = { from: (table: string) => any };

const PAGE = 1000;
const CHUNK = 200;

function fail(message: string, error: { message?: string } | null | undefined): never {
  throw new Error(`${message}${error?.message ? `: ${error.message}` : ""}`);
}

async function fetchAll(client: LooseClient, table: string, tenantId: string, orderBy = "id"): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .eq("tenant_id", tenantId)
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) fail(`Falha ao ler ${table}`, error);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function loadCatalogTables(client: LooseClient, tenantId: string): Promise<CatalogDestination> {
  const [products, recipeItems, ingredients, preparationSteps, stages, subcategories] = await Promise.all([
    fetchAll(client, "products", tenantId),
    fetchAll(client, "product_recipe_items", tenantId),
    fetchAll(client, "ingredients", tenantId),
    fetchAll(client, "product_preparation_steps", tenantId),
    fetchAll(client, "recipe_stage_definitions", tenantId),
    fetchAll(client, "subcategories", tenantId),
  ]);
  return { products, recipeItems, ingredients, preparationSteps, stages, subcategories };
}

export async function exportCatalog(
  client: LooseClient,
  tenantId: string,
  companyName: string,
  productIds: string[] | null,
): Promise<CatalogFile> {
  const tables = await loadCatalogTables(client, tenantId);
  // O front manda ids do snapshot (legacy_id ou uuid); aqui tudo vira uuid do banco.
  let selected: string[];
  if (productIds === null) {
    selected = tables.products.map((row) => String(row.id));
  } else {
    const wanted = new Set(productIds);
    selected = tables.products
      .filter((row) => wanted.has(String(row.id)) || (row.legacy_id != null && wanted.has(String(row.legacy_id))))
      .map((row) => String(row.id));
  }
  const input: BuildCatalogFileInput = {
    companyName,
    exportedAt: new Date().toISOString(),
    selectedProductIds: selected,
    products: tables.products,
    recipeItems: tables.recipeItems,
    ingredients: tables.ingredients,
    preparationSteps: tables.preparationSteps,
    stages: tables.stages,
    subcategories: tables.subcategories,
  };
  return buildCatalogFile(input);
}

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < list.length; i += size) result.push(list.slice(i, i + size));
  return result;
}

async function insertRows(client: LooseClient, table: string, rows: Row[], message: string) {
  for (const part of chunks(rows)) {
    const { error } = await client.from(table).insert(part);
    if (error) fail(message, error);
  }
}

async function deleteByIds(client: LooseClient, table: string, column: string, ids: string[]) {
  for (const part of chunks(ids, 100)) {
    const { error } = await client.from(table).delete().in(column, part);
    if (error) throw new Error(error.message);
  }
}

async function mapLimit<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let cursor = 0;
  let failure: unknown = null;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length && failure === null) {
      const item = items[cursor++];
      try {
        await work(item);
      } catch (error) {
        failure = error ?? new Error("falha");
      }
    }
  });
  // Espera todos terminarem antes de relançar, para o desfazer não correr junto com gravações.
  await Promise.all(runners);
  if (failure !== null) throw failure;
}

export interface ApplyResult {
  created: number;
  updated: number;
  ingredientsCreated: number;
  stagesCreated: number;
  versionsRecorded: number;
}

export class CatalogApplyError extends Error {
  constructor(
    message: string,
    readonly rollbackFailures: string[] = [],
  ) {
    super(message);
  }
}

interface ChangelogDraft {
  productId: string;
  description: string;
  changedFields: FieldChange[];
  baselineProductKey: string | null;
}

/**
 * Grava a importação. Ordem: etapas → insumos → produtos novos → produtos atualizados → receitas →
 * versões. Cada passo registra o desfazer; qualquer falha desfaz tudo e relança.
 */
export async function applyCatalogImport(args: {
  client: LooseClient;
  tenantId: string;
  actingProfileId: string | null;
  file: CatalogFile;
  fileName: string;
  selectedKeys: string[];
}): Promise<ApplyResult> {
  const { client, tenantId, file, fileName, selectedKeys } = args;
  const now = new Date();
  const dest = await loadCatalogTables(client, tenantId);
  const { plan } = buildImportPlan(file, dest, selectedKeys, { newId: () => crypto.randomUUID(), now: now.toISOString() });
  if (plan.newProducts.length + plan.updatedProducts.length === 0) {
    return { created: 0, updated: 0, ingredientsCreated: 0, stagesCreated: 0, versionsRecorded: 0 };
  }

  // Foto do cadastro ANTES (versão base de produto atualizado sem histórico com foto).
  const before = await getMasterDataSnapshot({ tenantId, supabase: client as never, forceRefresh: true, includeProfileNames: false });
  const beforeByDbId = new Map<string, Record<string, unknown>>();
  const legacyToDb = new Map(dest.products.map((row) => [String(row.legacy_id ?? row.id), String(row.id)]));
  for (const product of before.products) {
    const dbId = legacyToDb.get(product.id);
    if (dbId) beforeByDbId.set(dbId, product as unknown as Record<string, unknown>);
  }
  const updatedIds = plan.updatedProducts.map((p) => p.id);
  const existingVersions = await loadVersionState(client, updatedIds);

  const undo = new UndoLog();
  try {
    await writePlan(client, dest, plan, undo);

    const after = await getMasterDataSnapshot({ tenantId, supabase: client as never, forceRefresh: true, includeProfileNames: false });
    const afterLegacy = new Map(after.products.map((product) => [product.id, product as unknown as Record<string, unknown>]));
    const description = formatImportDescription(fileName, now);
    const author = await resolveAuthor(client, args.actingProfileId);

    const changelogRows: Row[] = [];
    const drafts: ChangelogDraft[] = [
      ...plan.newProducts.map((p) => ({ productId: p.id, description, changedFields: [], baselineProductKey: null })),
      ...plan.updatedProducts.map((p) => ({ productId: p.id, description, changedFields: p.changes, baselineProductKey: p.key })),
    ];
    const newLegacy = new Map(plan.newProducts.map((p) => [p.id, String(p.row.legacy_id)]));
    const updatedLegacy = new Map(dest.products.map((row) => [String(row.id), String(row.legacy_id ?? row.id)]));
    for (const draft of drafts) {
      const legacyId = newLegacy.get(draft.productId) ?? updatedLegacy.get(draft.productId) ?? draft.productId;
      const product = afterLegacy.get(legacyId);
      if (!product) throw new Error("Produto gravado não apareceu no cadastro para registrar a versão.");
      const state = existingVersions.get(draft.productId);
      let version = (state?.maxVersion ?? 0) + 1;
      const baseline = beforeByDbId.get(draft.productId);
      if (draft.baselineProductKey && !state?.hasSnapshot && baseline) {
        changelogRows.push({
          tenant_id: tenantId,
          product_id: draft.productId,
          version_number: version,
          change_description: BASELINE_VERSION_DESCRIPTION,
          changed_by_profile_id: author.id,
          changed_by_name: author.name,
          snapshot_data: { name: baseline.name, description: baseline.description, changedFields: [] },
          product_snapshot: buildProductVersionSnapshot(baseline),
        });
        version += 1;
      }
      changelogRows.push({
        tenant_id: tenantId,
        product_id: draft.productId,
        version_number: version,
        change_description: draft.description,
        changed_by_profile_id: author.id,
        changed_by_name: author.name,
        snapshot_data: { name: product.name, description: product.description, changedFields: draft.changedFields },
        product_snapshot: buildProductVersionSnapshot(product),
      });
    }
    let recorded = 0;
    for (const part of chunks(changelogRows, 50)) {
      const { data, error } = await client.from("product_changelog").insert(part).select("id");
      if (error) fail("Falha ao registrar as versões no histórico", error);
      const ids = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
      recorded += ids.length;
      undo.push("versões do histórico", () => deleteByIds(client, "product_changelog", "id", ids));
    }
    invalidateMasterDataCaches(tenantId);
    return {
      created: plan.newProducts.length,
      updated: plan.updatedProducts.length,
      ingredientsCreated: plan.ingredients.length,
      stagesCreated: plan.stages.length,
      versionsRecorded: recorded,
    };
  } catch (error) {
    const failures = await undo.rollback();
    invalidateMasterDataCaches(tenantId);
    const reason = error instanceof Error ? error.message : String(error);
    throw new CatalogApplyError(
      failures.length === 0
        ? `A importação falhou e nada foi gravado. Motivo: ${reason}`
        : `A importação falhou e não foi possível desfazer tudo. Avise o suporte antes de tentar de novo. Motivo: ${reason}`,
      failures,
    );
  }
}

async function writePlan(client: LooseClient, dest: CatalogDestination, plan: ImportPlan, undo: UndoLog) {
  if (plan.stages.length > 0) {
    await insertRows(client, "recipe_stage_definitions", plan.stages, "Falha ao criar as etapas");
    const keys = plan.stages.map((stage) => String(stage.key));
    undo.push("etapas novas", () => deleteByIds(client, "recipe_stage_definitions", "key", keys));
  }
  if (plan.ingredients.length > 0) {
    await insertRows(client, "ingredients", plan.ingredients.map((i) => i.row), "Falha ao criar os insumos");
    const ids = plan.ingredients.map((i) => i.id);
    undo.push("insumos novos", () => deleteByIds(client, "ingredients", "id", ids));
  }
  if (plan.newProducts.length > 0) {
    await insertRows(client, "products", plan.newProducts.map((p) => p.row), "Falha ao criar os produtos");
    const ids = plan.newProducts.map((p) => p.id);
    // apagar o produto leva junto receita e etapas de preparo (on delete cascade).
    undo.push("produtos novos", async () => {
      await deleteByIds(client, "product_recipe_items", "product_id", ids);
      await deleteByIds(client, "product_preparation_steps", "product_id", ids);
      await deleteByIds(client, "products", "id", ids);
    });
  }

  const originalProducts = new Map(dest.products.map((row) => [String(row.id), row]));
  const originalItems = new Map<string, Row[]>();
  for (const item of dest.recipeItems) {
    const list = originalItems.get(String(item.product_id)) ?? [];
    list.push(item);
    originalItems.set(String(item.product_id), list);
  }
  const originalSteps = new Map<string, Row[]>();
  for (const step of dest.preparationSteps) {
    const list = originalSteps.get(String(step.product_id)) ?? [];
    list.push(step);
    originalSteps.set(String(step.product_id), list);
  }

  // Atualização do cadastro do produto (uma a uma, com poucas em paralelo).
  await mapLimit(plan.updatedProducts, 8, async (product) => {
    const original = originalProducts.get(product.id) as Row;
    const { error } = await client.from("products").update(product.row).eq("id", product.id);
    if (error) fail(`Falha ao atualizar o produto ${String(original.name)}`, error);
    undo.push(`produto ${String(original.name)}`, async () => {
      const { id: _id, tenant_id: _tenant, ...restore } = original;
      void _id;
      void _tenant;
      const result = await client.from("products").update(restore).eq("id", product.id);
      if (result.error) throw new Error(result.error.message);
    });
  });

  // Receitas e etapas de preparo dos produtos atualizados: troca completa, com o original guardado.
  for (const product of plan.updatedProducts) {
    const items = originalItems.get(product.id) ?? [];
    const { error: deleteError } = await client.from("product_recipe_items").delete().eq("product_id", product.id);
    if (deleteError) fail("Falha ao trocar a receita", deleteError);
    undo.push("receitas anteriores", async () => {
      await deleteByIds(client, "product_recipe_items", "product_id", [product.id]);
      await insertRows(client, "product_recipe_items", items, "Falha ao devolver a receita");
    });
    if (product.preparationSteps.length > 0) {
      const steps = originalSteps.get(product.id) ?? [];
      const { error: stepDeleteError } = await client.from("product_preparation_steps").delete().eq("product_id", product.id);
      if (stepDeleteError) fail("Falha ao trocar as etapas de preparo", stepDeleteError);
      undo.push("etapas de preparo anteriores", async () => {
        await deleteByIds(client, "product_preparation_steps", "product_id", [product.id]);
        await insertRows(client, "product_preparation_steps", steps, "Falha ao devolver as etapas de preparo");
      });
    }
  }

  const recipeRows = [...plan.newProducts, ...plan.updatedProducts].flatMap((p) => p.recipeRows);
  const updatedWithRecipe = plan.updatedProducts.map((p) => p.id);
  if (recipeRows.length > 0) {
    await insertRows(client, "product_recipe_items", recipeRows, "Falha ao gravar as receitas");
    undo.push("receitas importadas", () => deleteByIds(client, "product_recipe_items", "product_id", updatedWithRecipe));
  }
  const stepRows = [...plan.newProducts, ...plan.updatedProducts].flatMap((p) => p.preparationSteps);
  if (stepRows.length > 0) {
    await insertRows(client, "product_preparation_steps", stepRows, "Falha ao gravar as etapas de preparo");
    const withSteps = plan.updatedProducts.filter((p) => p.preparationSteps.length > 0).map((p) => p.id);
    undo.push("etapas de preparo importadas", () => deleteByIds(client, "product_preparation_steps", "product_id", withSteps));
  }
}

async function loadVersionState(client: LooseClient, productIds: string[]) {
  const state = new Map<string, { maxVersion: number; hasSnapshot: boolean }>();
  for (const part of chunks(productIds, 100)) {
    const { data, error } = await client
      .from("product_changelog")
      .select("product_id, version_number")
      .in("product_id", part);
    if (error) fail("Falha ao ler o histórico de versões", error);
    for (const row of (data ?? []) as Array<{ product_id: string; version_number: number }>) {
      const current = state.get(row.product_id) ?? { maxVersion: 0, hasSnapshot: false };
      current.maxVersion = Math.max(current.maxVersion, Number(row.version_number));
      state.set(row.product_id, current);
    }
    const withSnapshot = await client
      .from("product_changelog")
      .select("product_id")
      .in("product_id", part)
      .not("product_snapshot", "is", null);
    if (withSnapshot.error) fail("Falha ao ler o histórico de versões", withSnapshot.error);
    for (const row of (withSnapshot.data ?? []) as Array<{ product_id: string }>) {
      const current = state.get(row.product_id) ?? { maxVersion: 0, hasSnapshot: false };
      current.hasSnapshot = true;
      state.set(row.product_id, current);
    }
  }
  return state;
}

async function resolveAuthor(client: LooseClient, actingProfileId: string | null): Promise<{ id: string | null; name: string }> {
  if (!actingProfileId) return { id: null, name: "" };
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actingProfileId);
  const query = client.from("profiles").select("id, name");
  const { data } = await (uuid ? query.eq("id", actingProfileId) : query.eq("legacy_id", actingProfileId)).maybeSingle();
  return { id: (data as { id?: string } | null)?.id ?? null, name: (data as { name?: string } | null)?.name ?? "" };
}
