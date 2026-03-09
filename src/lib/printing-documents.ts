import type {
  ProductionIngredient,
  ProductionProduct,
  RecipeIngredientReference,
} from "@/lib/production-planning";
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

function convertKnownUnitToKg(quantity: number, unit: UnitCode): number {
  switch (unit) {
    case "Kg":
      return quantity;
    case "g":
      return quantity / 1000;
    case "L":
      return quantity;
    case "ml":
      return quantity / 1000;
    default:
      return quantity;
  }
}

function getRecipeReferenceWeightKg(
  item: RecipeIngredientReference,
  ingredientsById: Map<string, ProductionIngredient>,
  productsById: Map<string, ProductionProduct>,
) {
  if (item.sourceType === "ingrediente") {
    const ingredient = ingredientsById.get(item.sourceId);
    if (!ingredient) {
      return convertKnownUnitToKg(item.quantity, item.unit);
    }

    if (ingredient.unit === "Kg" || ingredient.unit === "L") {
      return convertKnownUnitToKg(item.quantity, item.unit);
    }

    return convertKnownUnitToKg(item.quantity, ingredient.unit);
  }

  const product = productsById.get(item.sourceId);
  if (!product) {
    return convertKnownUnitToKg(item.quantity, item.unit);
  }

  return item.unit === "Kg"
    ? item.quantity
    : item.quantity * (product.ingredientProfile?.weightKg ?? product.unitProfiles.sales.weightKg);
}

function getProductRecipeTotals(
  product: ProductionProduct,
  ingredientsById: Map<string, ProductionIngredient>,
  productsById: Map<string, ProductionProduct>,
) {
  const totalIngredientsKg = Number(
    product.recipe
      .reduce((sum, item) => sum + getRecipeReferenceWeightKg(item, ingredientsById, productsById), 0)
      .toFixed(3),
  );
  const outputAfterBreakKg = Number((totalIngredientsKg * (1 - product.breakPercent / 100)).toFixed(3));

  return {
    totalIngredientsKg,
    outputAfterBreakKg,
  };
}

function scaleRecipeQuantity(
  opItemKg: number,
  product: ProductionProduct | undefined,
  ingredientsById: Map<string, ProductionIngredient>,
  productsById: Map<string, ProductionProduct>,
  quantity: number,
) {
  if (!product) {
    return round3(quantity);
  }

  const totals = getProductRecipeTotals(product, ingredientsById, productsById);
  const baseOutputKg = totals.outputAfterBreakKg > 0 ? totals.outputAfterBreakKg : totals.totalIngredientsKg;
  if (baseOutputKg <= 0) {
    return round3(quantity);
  }

  return round3((opItemKg / baseOutputKg) * quantity);
}

export function buildPreWeighingDocument(
  op: ProductionOrderRow,
  source: {
    products: ProductionProduct[];
    ingredients: ProductionIngredient[];
  },
) {
  const productsById = new Map(source.products.map((product) => [product.id, product]));
  const ingredientsById = new Map(source.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const sharedMap = new Map<string, SharedPreparationGroup>();

  const productGroups: PreWeighingProductGroup[] = op.items.map((item) => {
    const product = productsById.get(item.productId);
    const recipe = product?.recipe ?? [];

    const rows = recipe.map<PrintIngredientRow>((recipeItem) => {
      const estimatedQuantity = scaleRecipeQuantity(
        item.totalKg,
        product,
        ingredientsById,
        productsById,
        recipeItem.quantity,
      );
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
