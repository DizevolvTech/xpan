import type { ProductionIngredient, ProductionProduct } from "@/lib/production-planning";
import { getProductRecipeTotalsFromData } from "@/lib/production-data-utils";

/**
 * Arredondamento padrão da camada de planejamento — 3 casas, em `Number` (não string).
 * Centralizado aqui porque `scaleRecipeQuantity` (e a expansão de receita) dependem dele,
 * e o helper foi historicamente duplicado em `printing-documents.ts`.
 */
export function round3(value: number) {
  return Number(value.toFixed(3));
}

/**
 * Dado um produto e uma quantidade de receita "nominal" (a registrada no cadastro),
 * retorna a quantidade real necessária para produzir `outputKg` kg do produto.
 *
 * Reusa `getProductRecipeTotalsFromData` para identificar o output base da receita
 * (`outputAfterBreakKg` ou, em fallback, o somatório de ingredientes em kg).
 *
 * Comportamento de borda preservado da versão anterior (em `printing-documents.ts`):
 * - sem produto → retorna a quantidade nominal sem escalar.
 * - output base ≤ 0 → retorna a quantidade nominal (evita divisão por zero).
 */
export function scaleRecipeQuantity(
  outputKg: number,
  product: ProductionProduct | undefined,
  ingredients: ProductionIngredient[],
  products: ProductionProduct[],
  quantity: number,
) {
  if (!product) {
    return round3(quantity);
  }

  const totals = getProductRecipeTotalsFromData(product, ingredients, products);
  const baseOutputKg = totals.outputAfterBreakKg > 0 ? totals.outputAfterBreakKg : totals.totalIngredientsKg;

  if (baseOutputKg <= 0) {
    return round3(quantity);
  }

  return round3((outputKg / baseOutputKg) * quantity);
}
