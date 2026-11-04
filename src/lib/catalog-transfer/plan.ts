import { collectCustomStageKeys, omitKeys } from "./build-file";
import {
  analyzeCatalog,
  findDestinationProducts,
  pickColumns,
  type CatalogAnalysis,
} from "./review";
import type {
  CatalogDestination,
  CatalogFile,
  CatalogReview,
  ImportPlan,
  ImportPlanNewProduct,
  ImportPlanUpdatedProduct,
  Row,
} from "./types";

const SKIP_ON_UPDATE = new Set([
  "id",
  "tenant_id",
  "legacy_id",
  "created_at",
  "updated_at",
  "subcategory_id",
  "operational_subcategory_id",
  "code",
  "external_code",
]);
const SKIP_ON_CREATE = new Set(["id", "tenant_id", "legacy_id", "created_at", "updated_at"]);

export class CatalogPlanError extends Error {}

/** Próximo código de fábrica livre no padrão PR00001 (ou o prefixo/largura já usados). */
export function nextFactoryCode(existing: Iterable<string>): string {
  let max = 0;
  for (const code of existing) {
    const match = /^PR(\d+)$/.exec(code);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `PR${String(max + 1).padStart(5, "0")}`;
}

export interface BuildPlanOptions {
  newId: () => string;
  now: string;
}

/**
 * Transforma a seleção em operações de gravação com os ids remapeados (nada é gravado aqui).
 * Lança `CatalogPlanError` se a seleção tem item bloqueado ou depende de MPI novo não selecionado.
 */
export function buildImportPlan(
  file: CatalogFile,
  dest: CatalogDestination,
  selectedKeys: readonly string[],
  options: BuildPlanOptions,
): { plan: ImportPlan; review: CatalogReview } {
  const analysis: CatalogAnalysis = analyzeCatalog(file, dest);
  const { index } = analysis;

  const selected = new Set<string>();
  for (const key of selectedKeys) {
    const item = analysis.products.get(key);
    if (!item) throw new CatalogPlanError("A seleção tem um produto que não está no arquivo.");
    if (item.review.blocked) {
      throw new CatalogPlanError(`"${item.review.name}" tem conflito e não pode ser importado: ${item.review.conflicts[0]}`);
    }
    if (item.review.action !== "igual") selected.add(key);
  }
  for (const key of selected) {
    for (const dependency of (analysis.products.get(key) as { review: CatalogReview["products"][number] }).review.requires) {
      if (!selected.has(dependency)) {
        const dep = analysis.products.get(dependency);
        throw new CatalogPlanError(
          `"${analysis.products.get(key)?.review.name}" usa o MPI "${dep?.review.name ?? dependency}", que é novo no destino e precisa ser importado junto.`,
        );
      }
    }
  }

  // ids dos produtos novos e códigos de fábrica livres
  const usedCodes = new Set(dest.products.map((row) => String(row.code ?? "")));
  const newIds = new Map<string, string>();
  const newCodes = new Map<string, string>();
  // Produto sem código da loja casa pelo código de fábrica: esse código é a identidade dele e
  // fica como está (reservado antes dos demais, que podem ganhar um código novo).
  const newProducts = file.products.filter((product) => {
    const item = analysis.products.get(product.key);
    return selected.has(product.key) && item && !item.destRow;
  });
  newProducts.sort((a, b) => Number(b.key.startsWith("F:")) - Number(a.key.startsWith("F:")));
  for (const product of newProducts) {
    newIds.set(product.key, options.newId());
    const keepsCode = product.key.startsWith("F:") || (product.code && !usedCodes.has(product.code));
    const code = keepsCode ? product.code : nextFactoryCode(usedCodes);
    usedCodes.add(code);
    newCodes.set(product.key, code);
  }

  const productIdForKey = (key: string): string | null => {
    const created = newIds.get(key);
    if (created) return created;
    const matches = findDestinationProducts(index, key);
    return matches.length === 1 ? String(matches[0].id) : null;
  };
  const ingredientIds = new Map<string, string>();
  for (const [code, rows] of index.ingredientsByCode) if (rows.length === 1) ingredientIds.set(code, String(rows[0].id));

  // insumos e etapas necessários para os produtos selecionados
  const neededIngredients = new Set<string>();
  const neededStages = new Set<string>();
  for (const product of file.products) {
    if (!selected.has(product.key)) continue;
    for (const line of product.recipe) if (line.ingredientCode) neededIngredients.add(line.ingredientCode);
    for (const stage of collectCustomStageKeys(product.fields, product.recipe)) neededStages.add(stage);
  }

  const plan: ImportPlan = { stages: [], ingredients: [], newProducts: [], updatedProducts: [] };

  let nextSort = dest.stages.reduce((max, row) => Math.max(max, Number(row.sort_order ?? 0)), 0);
  for (const stage of file.stages) {
    if (!neededStages.has(stage.key) || index.stageKeys.has(stage.key)) continue;
    nextSort += 1;
    plan.stages.push({
      key: stage.key,
      label: stage.label,
      base_stage: stage.baseStage,
      active: stage.active,
      sort_order: nextSort,
    });
  }

  for (const ingredient of file.ingredients) {
    if (!neededIngredients.has(ingredient.code) || ingredientIds.has(ingredient.code)) continue;
    const id = options.newId();
    ingredientIds.set(ingredient.code, id);
    plan.ingredients.push({
      code: ingredient.code,
      id,
      row: {
        ...pickColumns(omitKeys(ingredient.fields, SKIP_ON_CREATE), index.ingredientCols),
        id,
        legacy_id: `ingredient-${id}`,
        code: ingredient.code,
      },
    });
  }

  const buildRecipeRows = (productId: string, key: string): Row[] => {
    const product = analysis.products.get(key)?.product;
    if (!product) return [];
    return product.recipe.map((line, position) => {
      let ingredientId: string | null = null;
      let productSourceId: string | null = null;
      if (line.sourceType === "produto") {
        productSourceId = line.productKey ? productIdForKey(line.productKey) : null;
        if (!productSourceId) throw new CatalogPlanError(`MPI sem destino na receita de "${product.name}".`);
      } else {
        ingredientId = line.ingredientCode ? ingredientIds.get(line.ingredientCode) ?? null : null;
        if (!ingredientId) throw new CatalogPlanError(`Insumo sem destino na receita de "${product.name}".`);
      }
      return {
        ...pickColumns(line.fields, index.recipeCols),
        sort_order: Number(line.fields.sort_order ?? position),
        product_id: productId,
        source_type: line.sourceType,
        ingredient_source_id: ingredientId,
        product_source_id: productSourceId,
      };
    });
  };
  const buildSteps = (productId: string, key: string): Row[] =>
    (analysis.products.get(key)?.product.preparationSteps ?? []).map((step) => ({
      product_id: productId,
      stage_key: step.stageKey,
      sort_order: step.sortOrder,
    }));

  for (const product of file.products) {
    if (!selected.has(product.key)) continue;
    const item = analysis.products.get(product.key);
    if (!item) continue;
    if (!item.destRow) {
      const id = newIds.get(product.key) as string;
      const row: Row = {
        ...pickColumns(omitKeys(product.fields, SKIP_ON_CREATE), index.productCols),
        id,
        legacy_id: `product-${id}`,
        code: newCodes.get(product.key),
        subcategory_id: item.lineRow ? item.lineRow.id : null,
        // Entra fora da carteira operacional, como todo produto novo (vira operacional por escolha).
        operational_subcategory_id: null,
      };
      const created: ImportPlanNewProduct = {
        key: product.key,
        id,
        row,
        preparationSteps: buildSteps(id, product.key),
        recipeRows: buildRecipeRows(id, product.key),
      };
      plan.newProducts.push(created);
    } else {
      const id = String(item.destRow.id);
      const row: Row = {
        ...pickColumns(omitKeys(product.fields, SKIP_ON_UPDATE), index.productCols),
        updated_at: options.now,
      };
      if (item.lineRow) row.subcategory_id = item.lineRow.id;
      const updated: ImportPlanUpdatedProduct = {
        key: product.key,
        id,
        row,
        preparationSteps: product.preparationSteps.length > 0 ? buildSteps(id, product.key) : [],
        recipeRows: buildRecipeRows(id, product.key),
        changes: item.review.changes,
      };
      plan.updatedProducts.push(updated);
    }
  }

  return { plan, review: analysis.review };
}

/* ------------------------------------------------------------------------------------------------
 * "Nada fica pela metade": o Supabase REST não tem transação entre várias tabelas, então cada
 * gravação registra o seu desfazer; se algo falha, os desfazeres rodam do último ao primeiro.
 * ----------------------------------------------------------------------------------------------*/

export class UndoLog {
  private readonly steps: Array<{ label: string; undo: () => Promise<void> }> = [];

  push(label: string, undo: () => Promise<void>) {
    this.steps.push({ label, undo });
  }

  get size() {
    return this.steps.length;
  }

  /** Executa os desfazeres (do último ao primeiro) e devolve os que falharam. */
  async rollback(): Promise<string[]> {
    const failures: string[] = [];
    for (const step of [...this.steps].reverse()) {
      try {
        await step.undo();
      } catch (error) {
        failures.push(`${step.label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    this.steps.length = 0;
    return failures;
  }
}

export function formatImportDescription(fileName: string, date: Date, timeZone = "America/Sao_Paulo"): string {
  const formatted = new Intl.DateTimeFormat("pt-BR", { timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  return `Importado de ${fileName} em ${formatted}`;
}
