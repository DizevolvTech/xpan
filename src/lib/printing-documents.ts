import type {
  ProductionIngredient,
  ProductionProduct,
  RecipeIngredientReference,
} from "@/lib/production-planning";
import type { ProductionOrderRow } from "@/lib/order-planning";
import type { UnitCode } from "@/lib/factory-planning/units";
import { round3, scaleRecipeQuantity } from "@/lib/factory-planning/recipe-expansion";

type PrintIngredientKind = "ingrediente" | "ingrediente_misturado" | "produto_mpi";
type PrintIngredientSectionKind = "base" | "additional";

export type PrintIngredientRow = {
  key: string;
  sourceType: "ingrediente" | "produto";
  kind: PrintIngredientKind;
  sectionKind?: PrintIngredientSectionKind;
  label: string;
  unit: UnitCode;
  estimatedQuantity: number;
  notes?: string;
};

export type PreWeighingProductSection = {
  productId: string;
  productCode: string;
  productName: string;
  plannedKg: number;
  requestedQuantity: number;
  requestedUnit: UnitCode;
  unitWeightKg: number;
  baseIngredients: PrintIngredientRow[];
  additionalIngredients: PrintIngredientRow[];
};

export type ProductIngredientSection = {
  productId: string;
  productCode: string;
  productName: string;
  requiredQuantity: number;
  requiredUnit: UnitCode;
  requiredKg: number;
  usedBy: string[];
  items: PrintIngredientRow[];
};

export type ProductionSheetProductSection = {
  productId: string;
  productCode: string;
  productName: string;
  plannedKg: number;
  requestedQuantity: number;
  requestedUnit: UnitCode;
  unitWeightKg: number;
  items: PrintIngredientRow[];
};

function getOperationalUnitWeight(product: ProductionProduct | undefined) {
  if (!product) {
    return 0;
  }

  if (product.unitProfiles.sales.unit === "Kg" && !product.isSoldLoose && product.packagingProfile) {
    return round3(product.packagingProfile.weightKg);
  }

  return round3(product.unitProfiles.sales.weightKg);
}

function buildRequestedSummary(op: ProductionOrderRow, productId: string) {
  const matchingSourceItems = op.sourceItems.filter((item) => item.productId === productId);
  const requestedQuantity = round3(
    matchingSourceItems.reduce((total, item) => total + item.requestedQuantity, 0),
  );
  const requestedUnit = matchingSourceItems[0]?.requestedUnit ?? "Kg";

  return {
    requestedQuantity,
    requestedUnit,
  };
}

function buildSourceMaps(source: {
  products: ProductionProduct[];
  ingredients: ProductionIngredient[];
}) {
  return {
    productsById: new Map(source.products.map((product) => [product.id, product])),
    ingredientsById: new Map(source.ingredients.map((ingredient) => [ingredient.id, ingredient])),
  };
}

function buildRowNotes(
  recipeItem: RecipeIngredientReference,
  ingredient: ProductionIngredient | undefined,
  sourceProduct: ProductionProduct | undefined,
) {
  if (recipeItem.sourceType === "produto") {
    return sourceProduct?.ingredientProfile?.observation ?? sourceProduct?.preparationMode;
  }

  if (ingredient?.type === "misturado") {
    return ingredient.observation || "Ingrediente misturado com composição cadastrada.";
  }

  return ingredient?.observation || ingredient?.metadata || undefined;
}

function isAdditionalIngredient(
  recipeItem: RecipeIngredientReference,
  ingredient: ProductionIngredient | undefined,
  sourceProduct: ProductionProduct | undefined,
) {
  if (recipeItem.sourceType === "produto") {
    return false;
  }

  if (ingredient?.type === "misturado") {
    return false;
  }

  const combinedText = [
    recipeItem.label,
    ingredient?.name,
    ingredient?.metadata,
    ingredient?.observation,
    sourceProduct?.name,
    sourceProduct?.ingredientProfile?.metadata,
    sourceProduct?.ingredientProfile?.observation,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return [
    "calda",
    "cobertura",
    "recheio",
    "farofa",
    "granola",
    "pasta",
    "goiabada",
    "forneavel",
    "final",
    "acabamento",
  ].some((keyword) => combinedText.includes(keyword));
}

function buildScaledRecipeRowsForProduct(
  product: ProductionProduct | undefined,
  outputKg: number,
  source: {
    products: ProductionProduct[];
    ingredients: ProductionIngredient[];
  },
) {
  if (!product) {
    return [] as PrintIngredientRow[];
  }

  const { productsById, ingredientsById } = buildSourceMaps(source);

  return product.recipe.map<PrintIngredientRow>((recipeItem) => {
    const ingredient = recipeItem.sourceType === "ingrediente" ? ingredientsById.get(recipeItem.sourceId) : undefined;
    const sourceProduct = recipeItem.sourceType === "produto" ? productsById.get(recipeItem.sourceId) : undefined;
    const estimatedQuantity = scaleRecipeQuantity(
      outputKg,
      product,
      source.ingredients,
      source.products,
      recipeItem.quantity,
    );

    return {
      key: `${product.id}-${recipeItem.id}-${outputKg}`,
      sourceType: recipeItem.sourceType,
      kind:
        recipeItem.sourceType === "produto"
          ? "produto_mpi"
          : ingredient?.type === "misturado"
            ? "ingrediente_misturado"
            : "ingrediente",
      sectionKind: isAdditionalIngredient(recipeItem, ingredient, sourceProduct) ? "additional" : "base",
      label: recipeItem.label,
      unit: recipeItem.unit,
      estimatedQuantity,
      notes: buildRowNotes(recipeItem, ingredient, sourceProduct),
    };
  });
}

function convertRecipeRowToKg(
  row: Pick<PrintIngredientRow, "estimatedQuantity" | "unit">,
  sourceProduct: ProductionProduct | undefined,
) {
  if (row.unit === "Kg") {
    return row.estimatedQuantity;
  }

  if (row.unit === "g") {
    return row.estimatedQuantity / 1000;
  }

  if (row.unit === "L") {
    return row.estimatedQuantity;
  }

  if (row.unit === "ml") {
    return row.estimatedQuantity / 1000;
  }

  return round3(
    row.estimatedQuantity * (sourceProduct?.ingredientProfile?.weightKg ?? sourceProduct?.unitProfiles.sales.weightKg ?? 1),
  );
}

export function buildPreWeighingDocument(
  op: ProductionOrderRow,
  source: {
    products: ProductionProduct[];
    ingredients: ProductionIngredient[];
  },
  batchKgByProductId?: Record<string, number>,
) {
  const { productsById, ingredientsById } = buildSourceMaps(source);
  const ingredientProductMap = new Map<
    string,
    {
      product: ProductionProduct;
      requiredQuantity: number;
      requiredUnit: UnitCode;
      requiredKg: number;
      usedBy: string[];
    }
  >();

  const productSections: PreWeighingProductSection[] = op.items.map((item) => {
    const outputKg = batchKgByProductId?.[item.productId] ?? item.totalKg;
    const product = productsById.get(item.productId);
    const requestedSummary = buildRequestedSummary(op, item.productId);
    const baseIngredients: PrintIngredientRow[] = [];
    const additionalIngredients: PrintIngredientRow[] = [];

    if (!product) {
      return {
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        plannedKg: outputKg,
        requestedQuantity: requestedSummary.requestedQuantity,
        requestedUnit: requestedSummary.requestedUnit,
        unitWeightKg: 0,
        baseIngredients,
        additionalIngredients,
      };
    }

    buildScaledRecipeRowsForProduct(product, outputKg, source).forEach((row, index) => {
      const recipeItem = product.recipe[index];
      const ingredient = recipeItem?.sourceType === "ingrediente" ? ingredientsById.get(recipeItem.sourceId) : undefined;
      const sourceProduct = recipeItem?.sourceType === "produto" ? productsById.get(recipeItem.sourceId) : undefined;
      const isProductIngredient = row.sourceType === "produto" && Boolean(sourceProduct?.canBeIngredient);

      if (isProductIngredient && sourceProduct) {
        const current = ingredientProductMap.get(sourceProduct.id);
        const requiredKg = convertRecipeRowToKg(row, sourceProduct);

        if (current) {
          current.requiredQuantity = round3(current.requiredQuantity + row.estimatedQuantity);
          current.requiredKg = round3(current.requiredKg + requiredKg);
          if (!current.usedBy.includes(item.productName)) {
            current.usedBy.push(item.productName);
          }
        } else {
          ingredientProductMap.set(sourceProduct.id, {
            product: sourceProduct,
            requiredQuantity: row.estimatedQuantity,
            requiredUnit: row.unit,
            requiredKg,
            usedBy: [item.productName],
          });
        }
        return;
      }

      if (row.sectionKind === "additional") {
        additionalIngredients.push(row);
        return;
      }

      if (ingredient?.type === "misturado") {
        baseIngredients.push({
          ...row,
          kind: "ingrediente_misturado",
          sectionKind: "base",
        });
        return;
      }

      baseIngredients.push({
        ...row,
        kind: "ingrediente",
        sectionKind: "base",
      });
    });

    return {
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      plannedKg: outputKg,
      requestedQuantity: requestedSummary.requestedQuantity,
      requestedUnit: requestedSummary.requestedUnit,
      unitWeightKg: getOperationalUnitWeight(product),
      baseIngredients,
      additionalIngredients,
    };
  });

  const ingredientProducts: ProductIngredientSection[] = Array.from(ingredientProductMap.values())
    .map((entry) => ({
      productId: entry.product.id,
      productCode: entry.product.code,
      productName: entry.product.name,
      requiredQuantity: round3(entry.requiredQuantity),
      requiredUnit: entry.requiredUnit,
      requiredKg: round3(entry.requiredKg),
      usedBy: entry.usedBy.sort((a, b) => a.localeCompare(b)),
      items: buildScaledRecipeRowsForProduct(entry.product, entry.requiredKg, source),
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName));

  return {
    productSections,
    ingredientProducts,
  };
}

export function buildProductionSheetDocument(
  op: ProductionOrderRow,
  source: {
    products: ProductionProduct[];
    ingredients: ProductionIngredient[];
  },
) {
  const { productsById } = buildSourceMaps(source);

  const productSections: ProductionSheetProductSection[] = op.items.map((item) => {
    const product = productsById.get(item.productId);
    const requestedSummary = buildRequestedSummary(op, item.productId);

    return {
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      plannedKg: item.totalKg,
      requestedQuantity: requestedSummary.requestedQuantity,
      requestedUnit: requestedSummary.requestedUnit,
      unitWeightKg: getOperationalUnitWeight(product),
      items: buildScaledRecipeRowsForProduct(product, item.totalKg, source),
    };
  });

  return {
    productSections,
  };
}
