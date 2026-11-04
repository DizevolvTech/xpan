import { isCustomRecipeStage } from "@/lib/production-planning";

import {
  CATALOG_FORMAT,
  CATALOG_MAX_PRODUCTS,
  CATALOG_VERSION,
  type CatalogFile,
  type CatalogIngredient,
  type CatalogProduct,
  type CatalogRecipeLine,
  type CatalogStage,
  type Row,
} from "./types";

/** Colunas que nunca viajam (ids, tenant, datas) ou são tratadas à parte (linhas de produção). */
const PRODUCT_SKIP = new Set([
  "id",
  "tenant_id",
  "legacy_id",
  "created_at",
  "updated_at",
  "subcategory_id",
  "operational_subcategory_id",
]);
const INGREDIENT_SKIP = new Set(["id", "tenant_id", "legacy_id", "created_at", "updated_at"]);
const RECIPE_SKIP = new Set([
  "id",
  "tenant_id",
  "product_id",
  "ingredient_source_id",
  "product_source_id",
  "created_at",
  "updated_at",
]);

export function omitKeys(row: Row, skip: ReadonlySet<string>): Row {
  const result: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (!skip.has(key) && value !== undefined) result[key] = value;
  }
  return result;
}

export const productFieldSkip = PRODUCT_SKIP;
export const ingredientFieldSkip = INGREDIENT_SKIP;
export const recipeFieldSkip = RECIPE_SKIP;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

/** Chave de casamento do produto: código da loja; sem ele, código da fábrica. */
export function buildProductKey(code: unknown, externalCode: unknown): string {
  const external = text(externalCode);
  return external ? `L:${external}` : `F:${text(code)}`;
}

export function describeProductKey(key: string): string {
  return key.startsWith("L:") ? `código da loja ${key.slice(2)}` : `código da fábrica ${key.slice(2)}`;
}

/** Etapas cadastradas (não padrão) que um produto usa: linhas, sequência da ficha e etapa da quebra. */
export function collectCustomStageKeys(productFields: Row, recipeLines: Array<{ fields: Row }>): string[] {
  const keys = new Set<string>();
  for (const line of recipeLines) {
    if (isCustomRecipeStage(line.fields.stage)) keys.add(String(line.fields.stage));
  }
  const config = productFields.recipe_stage_config;
  if (Array.isArray(config)) {
    for (const entry of config) {
      const stage = (entry as { stage?: unknown } | null)?.stage;
      if (isCustomRecipeStage(stage)) keys.add(String(stage));
    }
  }
  if (isCustomRecipeStage(productFields.break_stage)) keys.add(String(productFields.break_stage));
  return [...keys];
}

export interface BuildCatalogFileInput {
  companyName: string;
  exportedAt: string;
  /** ids (uuid do banco) dos produtos escolhidos. */
  selectedProductIds: string[];
  products: Row[];
  recipeItems: Row[];
  ingredients: Row[];
  preparationSteps: Row[];
  stages: Row[];
  subcategories: Row[];
}

export class CatalogExportError extends Error {}

/**
 * Monta o arquivo: produtos escolhidos + MPIs que eles usam (mesmo sem marcar, em cascata),
 * receitas completas, insumos usados e etapas cadastradas usadas.
 */
export function buildCatalogFile(input: BuildCatalogFileInput): CatalogFile {
  const productById = new Map(input.products.map((row) => [String(row.id), row]));
  const ingredientById = new Map(input.ingredients.map((row) => [String(row.id), row]));
  const lineById = new Map(input.subcategories.map((row) => [String(row.id), row]));
  const itemsByProduct = new Map<string, Row[]>();
  for (const item of input.recipeItems) {
    const key = String(item.product_id);
    const list = itemsByProduct.get(key) ?? [];
    list.push(item);
    itemsByProduct.set(key, list);
  }
  const stepsByProduct = new Map<string, Row[]>();
  for (const step of input.preparationSteps) {
    const key = String(step.product_id);
    const list = stepsByProduct.get(key) ?? [];
    list.push(step);
    stepsByProduct.set(key, list);
  }

  const selected = new Set(input.selectedProductIds.filter((id) => productById.has(id)));
  if (selected.size === 0) throw new CatalogExportError("Escolha ao menos um produto para exportar.");

  // Fecho dos MPIs usados como ingrediente (em cascata).
  const included = new Set(selected);
  const queue = [...selected];
  while (queue.length > 0) {
    const id = queue.pop() as string;
    for (const item of itemsByProduct.get(id) ?? []) {
      const sourceId = item.product_source_id ? String(item.product_source_id) : null;
      if (item.source_type === "produto" && sourceId && productById.has(sourceId) && !included.has(sourceId)) {
        included.add(sourceId);
        queue.push(sourceId);
      }
    }
  }
  if (included.size > CATALOG_MAX_PRODUCTS) {
    throw new CatalogExportError(
      `O arquivo teria ${included.size} produtos (com os ingredientes MPI usados); o limite é ${CATALOG_MAX_PRODUCTS}. Escolha menos produtos.`,
    );
  }

  const ingredientsUsed = new Map<string, CatalogIngredient>();
  const stageKeys = new Set<string>();
  const products: CatalogProduct[] = [];

  const ordered = [...included]
    .map((id) => productById.get(id) as Row)
    .sort((a, b) => text(a.code).localeCompare(text(b.code), "pt-BR", { numeric: true }));

  for (const row of ordered) {
    const id = String(row.id);
    const recipe: CatalogRecipeLine[] = [];
    const items = [...(itemsByProduct.get(id) ?? [])].sort(
      (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
    );
    for (const item of items) {
      const fields = omitKeys(item, RECIPE_SKIP);
      if (item.source_type === "produto") {
        const source = item.product_source_id ? productById.get(String(item.product_source_id)) : undefined;
        recipe.push({
          sourceType: "produto",
          ingredientCode: null,
          productKey: source ? buildProductKey(source.code, source.external_code) : null,
          fields,
        });
      } else {
        const ingredient = item.ingredient_source_id ? ingredientById.get(String(item.ingredient_source_id)) : undefined;
        if (ingredient && !ingredientsUsed.has(text(ingredient.code))) {
          ingredientsUsed.set(text(ingredient.code), {
            code: text(ingredient.code),
            name: text(ingredient.name),
            unit: text(ingredient.unit),
            fields: omitKeys(ingredient, INGREDIENT_SKIP),
          });
        }
        recipe.push({
          sourceType: "ingrediente",
          ingredientCode: ingredient ? text(ingredient.code) : null,
          productKey: null,
          fields,
        });
      }
    }
    const fields = omitKeys(row, PRODUCT_SKIP);
    for (const key of collectCustomStageKeys(fields, recipe)) stageKeys.add(key);
    const line = row.subcategory_id ? lineById.get(String(row.subcategory_id)) : undefined;
    products.push({
      key: buildProductKey(row.code, row.external_code),
      code: text(row.code),
      externalCode: text(row.external_code) || null,
      name: text(row.name),
      includedAsIngredient: !selected.has(id),
      line: line ? { code: text(line.code), name: text(line.name) } : null,
      fields,
      preparationSteps: (stepsByProduct.get(id) ?? [])
        .map((step) => ({ stageKey: text(step.stage_key), sortOrder: Number(step.sort_order ?? 0) }))
        .sort((a, b) => a.sortOrder - b.sortOrder),
      recipe,
    });
  }

  const stages: CatalogStage[] = input.stages
    .filter((stage) => stageKeys.has(text(stage.key)))
    .map((stage) => ({
      key: text(stage.key),
      label: text(stage.label),
      baseStage: text(stage.base_stage),
      sortOrder: Number(stage.sort_order ?? 0),
      active: stage.active !== false,
    }));

  return {
    format: CATALOG_FORMAT,
    version: CATALOG_VERSION,
    exportedAt: input.exportedAt,
    source: { companyName: input.companyName },
    products,
    ingredients: [...ingredientsUsed.values()].sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true })),
    stages,
  };
}

export function buildCatalogFileName(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `xpan-cadastros-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

function isRecord(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Valida o formato do arquivo vindo do usuário. Mensagens em português para exibir direto. */
export function parseCatalogFile(raw: unknown): { ok: true; file: CatalogFile } | { ok: false; message: string } {
  if (!isRecord(raw) || raw.format !== CATALOG_FORMAT) {
    return { ok: false, message: "Este arquivo não é uma exportação de cadastros do Xpan." };
  }
  if (typeof raw.version !== "number" || raw.version > CATALOG_VERSION) {
    return {
      ok: false,
      message: "Este arquivo foi gerado por uma versão mais nova do sistema. Atualize o ambiente de destino e tente de novo.",
    };
  }
  if (!Array.isArray(raw.products) || !Array.isArray(raw.ingredients) || !Array.isArray(raw.stages)) {
    return { ok: false, message: "O arquivo está incompleto (faltam produtos, insumos ou etapas)." };
  }
  if (raw.products.length === 0) return { ok: false, message: "O arquivo não traz nenhum produto." };
  if (raw.products.length > CATALOG_MAX_PRODUCTS) {
    return {
      ok: false,
      message: `O arquivo traz ${raw.products.length} produtos; o limite é ${CATALOG_MAX_PRODUCTS} por importação. Exporte em partes.`,
    };
  }
  for (const product of raw.products) {
    if (
      !isRecord(product) ||
      typeof product.key !== "string" ||
      !isRecord(product.fields) ||
      !Array.isArray(product.recipe) ||
      typeof product.name !== "string"
    ) {
      return { ok: false, message: "O arquivo tem um produto com formato inválido." };
    }
  }
  for (const ingredient of raw.ingredients) {
    if (!isRecord(ingredient) || typeof ingredient.code !== "string" || !isRecord(ingredient.fields)) {
      return { ok: false, message: "O arquivo tem um insumo com formato inválido." };
    }
  }
  const file = raw as unknown as CatalogFile;
  return {
    ok: true,
    file: {
      ...file,
      source: { companyName: typeof file.source?.companyName === "string" ? file.source.companyName : "" },
      exportedAt: typeof file.exportedAt === "string" ? file.exportedAt : "",
      products: file.products.map((product) => ({
        ...product,
        code: text(product.code),
        externalCode: text(product.externalCode) || null,
        includedAsIngredient: Boolean(product.includedAsIngredient),
        line: product.line ?? null,
        preparationSteps: Array.isArray(product.preparationSteps) ? product.preparationSteps : [],
      })),
    },
  };
}
