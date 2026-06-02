import "server-only";

import { getFactoryPlanningSnapshot } from "@/lib/supabase-data/planning-snapshot";
import { getMasterDataSnapshot } from "@/lib/supabase-data/master-data";
import { assertTenantId, type SupabaseDataClient } from "@/lib/supabase-data/common";
import { getRecipeReferenceWeightKgFromData } from "@/lib/production-data-utils";
import { getProductRecipeTotalsFromData } from "@/lib/production-data-utils";
import type { ProductionIngredient, ProductionProduct } from "@/lib/production-planning";

export interface IngredientConsumptionInput {
  referenceDate: string;
  windowDays?: number;
  tenantId?: string | null;
  supabase?: SupabaseDataClient;
}

export interface IngredientConsumptionRow {
  ingredientId: string;
  ingredientName: string;
  /** Consumo acumulado convertido para kg/L (unidade de consumo canônica). */
  totalKg: number;
  /** Unidade de consumo do ingrediente (ex.: Kg, L, g). */
  consumptionUnit: string;
}

export interface IngredientConsumptionResult {
  referenceDate: string;
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  ingredients: IngredientConsumptionRow[];
  /** Soma de todo o consumo (kg) no período — útil para totalizadores. */
  totalConsumptionKg: number;
}

function addDays(isoDate: string, delta: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/**
 * Pré-computa, por produto, quanto de cada ingrediente (em kg) é consumido por
 * 1 kg de produto final entregue pela receita. Reaproveita a matemática
 * existente: `getRecipeReferenceWeightKgFromData` (kg do item da receita) e
 * `getProductRecipeTotalsFromData` (`outputAfterBreakKg` = saída por batelada da
 * receita). Assim podemos escalar pelo kg planejado de produção.
 */
function buildIngredientKgPerOutputKgByProduct(
  products: ProductionProduct[],
  ingredients: ProductionIngredient[],
): Map<string, Map<string, number>> {
  const ingredientsById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const productsById = new Map(products.map((product) => [product.id, product]));
  const byProduct = new Map<string, Map<string, number>>();

  for (const product of products) {
    const totals = getProductRecipeTotalsFromData(product, ingredients, products);
    if (totals.outputAfterBreakKg <= 0) {
      continue;
    }

    const perIngredient = new Map<string, number>();
    for (const item of product.recipe) {
      if (item.sourceType !== "ingrediente") {
        // Sub-produtos não são ingredientes diretos; o consumo de ingredientes
        // do sub-produto pertence à produção do próprio sub-produto.
        continue;
      }
      const itemKg = getRecipeReferenceWeightKgFromData(item, ingredientsById, productsById);
      const kgPerOutputKg = itemKg / totals.outputAfterBreakKg;
      perIngredient.set(item.sourceId, (perIngredient.get(item.sourceId) ?? 0) + kgPerOutputKg);
    }

    byProduct.set(product.id, perIngredient);
  }

  return byProduct;
}

export async function getIngredientConsumption(
  input: IngredientConsumptionInput,
): Promise<IngredientConsumptionResult> {
  const tenantId = assertTenantId(input.tenantId);
  const windowDays = Number.isFinite(input.windowDays) && Number(input.windowDays) > 0
    ? Math.trunc(Number(input.windowDays))
    : 7;
  const referenceDate = input.referenceDate;
  const windowStart = referenceDate;
  const windowEnd = addDays(referenceDate, windowDays - 1);

  // 1) Carrega produtos + ingredientes uma única vez (não por data).
  const master = await getMasterDataSnapshot({
    supabase: input.supabase,
    tenantId,
    includeProfileNames: false,
  });
  const ingredientsById = new Map(master.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const ingredientKgPerOutputKgByProduct = buildIngredientKgPerOutputKgByProduct(
    master.products,
    master.ingredients,
  );

  // 2) Para cada data da janela, soma o kg planejado por produto e acumula
  //    o consumo de ingredientes derivado da receita.
  const dates: string[] = [];
  for (let offset = 0; offset < windowDays; offset += 1) {
    dates.push(addDays(referenceDate, offset));
  }

  const snapshots = await Promise.all(
    dates.map((date) =>
      getFactoryPlanningSnapshot(date, {
        supabase: input.supabase,
        tenantId,
        includeProfileNames: false,
      }),
    ),
  );

  const accumulatedKgByIngredient = new Map<string, number>();

  snapshots.forEach((snapshot, index) => {
    const date = dates[index];
    // Soma kg planejado por produto APENAS para OPs cuja data de produção é a
    // data do snapshot (evita dupla contagem entre snapshots da janela).
    const plannedKgByProduct = new Map<string, number>();
    for (const order of snapshot.productionOrders) {
      if (order.productionDate !== date) {
        continue;
      }
      for (const item of order.items) {
        plannedKgByProduct.set(
          item.productId,
          (plannedKgByProduct.get(item.productId) ?? 0) + item.totalKg,
        );
      }
    }

    for (const [productId, plannedKg] of plannedKgByProduct) {
      const perIngredient = ingredientKgPerOutputKgByProduct.get(productId);
      if (!perIngredient || plannedKg <= 0) {
        continue;
      }
      for (const [ingredientId, kgPerOutputKg] of perIngredient) {
        accumulatedKgByIngredient.set(
          ingredientId,
          (accumulatedKgByIngredient.get(ingredientId) ?? 0) + kgPerOutputKg * plannedKg,
        );
      }
    }
  });

  const ingredients: IngredientConsumptionRow[] = Array.from(accumulatedKgByIngredient.entries())
    .map(([ingredientId, totalKg]) => {
      const ingredient = ingredientsById.get(ingredientId);
      return {
        ingredientId,
        ingredientName: ingredient?.name ?? ingredientId,
        totalKg: Number(totalKg.toFixed(3)),
        consumptionUnit: ingredient?.unit ?? "Kg",
      };
    })
    .filter((row) => row.totalKg > 0)
    .sort((a, b) => b.totalKg - a.totalKg);

  const totalConsumptionKg = Number(
    ingredients.reduce((sum, row) => sum + row.totalKg, 0).toFixed(3),
  );

  return {
    referenceDate,
    windowDays,
    windowStart,
    windowEnd,
    ingredients,
    totalConsumptionKg,
  };
}
