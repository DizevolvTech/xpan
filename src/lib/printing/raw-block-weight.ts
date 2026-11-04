import { computeLabTest } from "@/lib/lab-test";
import type { ProductionIngredient, ProductionProduct } from "@/lib/production-planning";
import { getProductRecipeTotalsFromData } from "@/lib/production-data-utils";

/**
 * Cartão #237 (5.7): "Pesar o bloco com ___ g". Peso do bloco CRU em gramas, ou `null` quando o
 * cadastro não tem o teste da receita completo (a OP imprime a linha em branco para o padeiro).
 *
 * Fonte: peso da unidade crua do teste da receita (cartão #231) = massa crua (insumos que
 * participam da cocção) ÷ unidades efetivas. Único ponto de leitura das folhas.
 */
export function resolveRawBlockWeightG(
  product: ProductionProduct | undefined | null,
  source: { ingredients: ProductionIngredient[]; products: ProductionProduct[] },
): number | null {
  if (!product?.labTest) return null;
  const { doughKg } = getProductRecipeTotalsFromData(product, source.ingredients, source.products);
  const lab = computeLabTest({ recipeTotalKg: doughKg, labTest: product.labTest });
  const kg = lab?.complete ? lab.rawUnitWeightKg : 0;
  if (!Number.isFinite(kg) || kg <= 0) return null;
  return Math.round(kg * 1000 * 10) / 10;
}
