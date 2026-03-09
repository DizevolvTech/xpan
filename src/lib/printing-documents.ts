import { getProductRecipeTotals, ingredientsById, productsById } from "@/lib/production-planning";
import type { ProductionOrderRow } from "@/lib/order-planning";
import type { UnitCode } from "@/lib/factory-planning/units";

export type PrintIngredientRow = {
  key: string;
  sourceType: "ingrediente" | "produto";
  label: string;
  unit: UnitCode;
  estimatedQuantity: number;
  notes?: string;
};

export type PreWeighingProductGroup = {
  productId: string;
  productCode: string;
  productName: string;
  plannedKg: number;
  items: PrintIngredientRow[];
};

export type SharedPreparationGroup = {
  key: string;
  label: string;
  unit: UnitCode;
  estimatedQuantity: number;
  usedBy: string[];
  notes?: string;
};

function round3(value: number) {
  return Number(value.toFixed(3));
}

export function scaleRecipeQuantity(opItemKg: number, productId: string, quantity: number) {
  const product = productsById.get(productId);
  if (!product) {
    return round3(quantity);
  }

  const totals = getProductRecipeTotals(product);
  const baseOutputKg = totals.outputAfterBreakKg > 0 ? totals.outputAfterBreakKg : totals.totalIngredientsKg;
  if (baseOutputKg <= 0) {
    return round3(quantity);
  }

  return round3((opItemKg / baseOutputKg) * quantity);
}

export function buildPreWeighingDocument(op: ProductionOrderRow) {
  const sharedMap = new Map<string, SharedPreparationGroup>();

  const productGroups: PreWeighingProductGroup[] = op.items.map((item) => {
    const product = productsById.get(item.productId);
    const recipe = product?.recipe ?? [];

    const rows = recipe.map<PrintIngredientRow>((recipeItem) => {
      const estimatedQuantity = scaleRecipeQuantity(item.totalKg, item.productId, recipeItem.quantity);
      const ingredient = recipeItem.sourceType === "ingrediente" ? ingredientsById.get(recipeItem.sourceId) : undefined;
      const sourceProduct = recipeItem.sourceType === "produto" ? productsById.get(recipeItem.sourceId) : undefined;
      const notes =
        recipeItem.sourceType === "produto"
          ? sourceProduct?.ingredientProfile?.observation ?? sourceProduct?.preparationMode
          : ingredient?.type === "misturado"
            ? "Ingrediente misturado com composição cadastrada."
            : ingredient?.observation;

      const row = {
        key: `${item.productId}-${recipeItem.id}`,
        sourceType: recipeItem.sourceType,
        label: recipeItem.label,
        unit: recipeItem.unit,
        estimatedQuantity,
        notes,
      } satisfies PrintIngredientRow;

      if (recipeItem.sourceType === "produto" || ingredient?.type === "misturado") {
        const sharedKey = `${recipeItem.sourceType}:${recipeItem.sourceId}:${recipeItem.unit}`;
        const current = sharedMap.get(sharedKey);
        if (current) {
          current.estimatedQuantity = round3(current.estimatedQuantity + estimatedQuantity);
          if (!current.usedBy.includes(item.productName)) {
            current.usedBy.push(item.productName);
          }
        } else {
          sharedMap.set(sharedKey, {
            key: sharedKey,
            label: recipeItem.label,
            unit: recipeItem.unit,
            estimatedQuantity,
            usedBy: [item.productName],
            notes,
          });
        }
      }

      return row;
    });

    return {
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      plannedKg: item.totalKg,
      items: rows,
    };
  });

  return {
    productGroups,
    sharedPreparations: Array.from(sharedMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
  };
}
