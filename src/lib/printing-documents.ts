import type {
  ProductionIngredient,
  ProductionProduct,
  RecipeIngredientReference,
  RecipeStage,
} from "@/lib/production-planning";
import {
  defaultRecipeStage,
  getRecipeStageOrder,
  hasStagedRecipe,
  normalizeRecipeStage,
  recipeStageLabels,
} from "@/lib/production-planning";
import type { ProductionOrderRow } from "@/lib/order-planning";
import type { UnitCode } from "@/lib/factory-planning/units";
import { round3, scaleRecipeQuantity } from "@/lib/factory-planning/recipe-expansion";
import { computePreWeighBatchSplit, type PreWeighBatchSplit } from "@/lib/production-batches";

type PrintIngredientKind = "ingrediente" | "ingrediente_misturado" | "produto_mpi";
type PrintIngredientSectionKind = "base" | "additional";

export type PrintIngredientRow = {
  key: string;
  sourceType: "ingrediente" | "produto";
  kind: PrintIngredientKind;
  sectionKind?: PrintIngredientSectionKind;
  /** Etapa/função da linha na receita. Receita legada = `massa` em tudo. */
  stage: RecipeStage;
  label: string;
  unit: UnitCode;
  estimatedQuantity: number;
  /** Quantidade para UMA batida cheia (só quando o produto é batido). */
  batchQuantity?: number;
  /** Quantidade para a parcial/extra (só quando há parcial). */
  partialQuantity?: number;
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
  /** Desdobramento de batidas (cheia ×N + parcial). null = não batido. */
  batchSplit: PreWeighBatchSplit | null;
  baseIngredients: PrintIngredientRow[];
  additionalIngredients: PrintIngredientRow[];
};

export type ProductIngredientSection = {
  productId: string;
  productCode: string;
  productName: string;
  /** Etapa em que este MPI é consumido — a agregação é por (produto, etapa). */
  stage: RecipeStage;
  /** Rótulo da etapa para impressão; `null` na receita legada (tudo em massa). */
  stageLabel: string | null;
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

export type PrintIngredientStageGroup<TRow> = {
  stage: RecipeStage;
  label: string;
  /**
   * `false` = receita legada (tudo em `massa`): imprime em bloco único e SEM cabeçalho
   * de etapa, exatamente como antes de existir a coluna `stage`.
   */
  showStageHeader: boolean;
  rows: TRow[];
};

/**
 * Agrupa as linhas de uma receita por etapa, na ordem canônica do enum. Dentro do grupo
 * a ordem de entrada é preservada (é o `sort_order` da receita).
 *
 * Receita não migrada (nenhuma linha fora de `massa`) devolve UM grupo com as linhas
 * intactas e sem cabeçalho — garantia de que a folha de quem não preencheu etapa sai
 * idêntica à de hoje.
 */
export function groupPrintRowsByStage<TRow extends { stage?: RecipeStage }>(
  rows: TRow[],
): PrintIngredientStageGroup<TRow>[] {
  if (rows.length === 0) {
    return [];
  }

  if (!hasStagedRecipe(rows)) {
    return [
      {
        stage: defaultRecipeStage,
        label: recipeStageLabels[defaultRecipeStage],
        showStageHeader: false,
        rows,
      },
    ];
  }

  const rowsByStage = new Map<RecipeStage, TRow[]>();
  rows.forEach((row) => {
    const stage = normalizeRecipeStage(row.stage);
    const current = rowsByStage.get(stage) ?? [];
    current.push(row);
    rowsByStage.set(stage, current);
  });

  return Array.from(rowsByStage.entries())
    .sort(([left], [right]) => getRecipeStageOrder(left) - getRecipeStageOrder(right))
    .map(([stage, stageRows]) => ({
      stage,
      label: recipeStageLabels[stage],
      showStageHeader: true,
      rows: stageRows,
    }));
}

/**
 * Produto a usar na impressão: com a receita CONGELADA na liberação quando o item da OP
 * traz uma (`frozenRecipe`). Sem isso, a OP de MPI sairia da receita do momento da
 * liberação e a folha do padeiro listaria a receita editada depois.
 */
function withFrozenRecipe(
  product: ProductionProduct,
  frozenRecipe?: ProductionProduct["recipe"] | null,
): ProductionProduct {
  return frozenRecipe ? { ...product, recipe: frozenRecipe } : product;
}

function buildScaledRecipeRowsForProduct(
  baseProduct: ProductionProduct | undefined,
  outputKg: number,
  source: {
    products: ProductionProduct[];
    ingredients: ProductionIngredient[];
  },
  batchKgs?: { fullBatchKg?: number; partialKg?: number },
  frozenRecipe?: ProductionProduct["recipe"] | null,
) {
  if (!baseProduct) {
    return [] as PrintIngredientRow[];
  }
  const product = withFrozenRecipe(baseProduct, frozenRecipe);

  const { productsById, ingredientsById } = buildSourceMaps(source);
  // A heurística de "Adic." por palavra-chave só continua valendo para receita NÃO
  // migrada. Quem preencheu etapa passa a ser agrupado pela etapa real.
  const staged = hasStagedRecipe(product.recipe);

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

    const batchQuantity =
      batchKgs?.fullBatchKg != null && batchKgs.fullBatchKg > 0
        ? scaleRecipeQuantity(batchKgs.fullBatchKg, product, source.ingredients, source.products, recipeItem.quantity)
        : undefined;
    const partialQuantity =
      batchKgs?.partialKg != null && batchKgs.partialKg > 0
        ? scaleRecipeQuantity(batchKgs.partialKg, product, source.ingredients, source.products, recipeItem.quantity)
        : undefined;

    return {
      key: `${product.id}-${recipeItem.id}-${outputKg}`,
      sourceType: recipeItem.sourceType,
      kind:
        recipeItem.sourceType === "produto"
          ? "produto_mpi"
          : ingredient?.type === "misturado"
            ? "ingrediente_misturado"
            : "ingrediente",
      sectionKind:
        !staged && isAdditionalIngredient(recipeItem, ingredient, sourceProduct) ? "additional" : "base",
      stage: normalizeRecipeStage(recipeItem.stage),
      label: recipeItem.label,
      unit: recipeItem.unit,
      estimatedQuantity,
      batchQuantity,
      partialQuantity,
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
) {
  const { productsById, ingredientsById } = buildSourceMaps(source);
  // Chave = (produto MPI, ETAPA). O mesmo chantilly no recheio e na cobertura vira duas
  // seções com pesos próprios em vez de uma soma — é o peso por etapa que o padeiro pesa.
  // Como toda linha legada nasce em `massa`, a chave não muda até alguém preencher etapa.
  const ingredientProductMap = new Map<
    string,
    {
      product: ProductionProduct;
      stage: RecipeStage;
      requiredQuantity: number;
      requiredUnit: UnitCode;
      requiredKg: number;
      usedBy: string[];
    }
  >();

  const productSections: PreWeighingProductSection[] = op.items.map((item) => {
    // Receita congelada na liberação, quando houver: a folha tem que casar com a OP de
    // MPI que o motor gerou, não com a receita editada depois.
    const baseProduct = productsById.get(item.productId);
    const product = baseProduct ? withFrozenRecipe(baseProduct, item.frozenRecipe) : undefined;
    const split = computePreWeighBatchSplit({
      totalKg: item.totalKg,
      capacityPerBatch: product?.capacityPerBatch ?? null,
      salesToKgFactor: product?.salesToKgFactor ?? 1,
      salesUnit: item.batchUnitLabel,
    });
    const outputKg = item.totalKg;
    const requestedSummary = buildRequestedSummary(op, item.productId);
    const baseIngredients: PrintIngredientRow[] = [];
    const additionalIngredients: PrintIngredientRow[] = [];

    if (!product) {
      return {
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        plannedKg: item.totalKg,
        requestedQuantity: requestedSummary.requestedQuantity,
        requestedUnit: requestedSummary.requestedUnit,
        unitWeightKg: 0,
        batchSplit: null,
        baseIngredients,
        additionalIngredients,
      };
    }

    buildScaledRecipeRowsForProduct(
      product,
      outputKg,
      source,
      split.batched ? { fullBatchKg: split.fullBatchKg, partialKg: split.partialKg } : undefined,
    ).forEach((row, index) => {
      const recipeItem = product.recipe[index];
      const ingredient = recipeItem?.sourceType === "ingrediente" ? ingredientsById.get(recipeItem.sourceId) : undefined;
      const sourceProduct = recipeItem?.sourceType === "produto" ? productsById.get(recipeItem.sourceId) : undefined;
      const isProductIngredient = row.sourceType === "produto" && Boolean(sourceProduct?.canBeIngredient);

      if (isProductIngredient && sourceProduct) {
        const stageKey = `${sourceProduct.id}::${row.stage}`;
        const current = ingredientProductMap.get(stageKey);
        const requiredKg = convertRecipeRowToKg(row, sourceProduct);

        if (current) {
          current.requiredQuantity = round3(current.requiredQuantity + row.estimatedQuantity);
          current.requiredKg = round3(current.requiredKg + requiredKg);
          if (!current.usedBy.includes(item.productName)) {
            current.usedBy.push(item.productName);
          }
        } else {
          ingredientProductMap.set(stageKey, {
            product: sourceProduct,
            stage: row.stage,
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
      plannedKg: item.totalKg,
      requestedQuantity: requestedSummary.requestedQuantity,
      requestedUnit: requestedSummary.requestedUnit,
      unitWeightKg: getOperationalUnitWeight(product),
      batchSplit: split.batched ? split : null,
      baseIngredients,
      additionalIngredients,
    };
  });

  const ingredientProducts: ProductIngredientSection[] = Array.from(ingredientProductMap.values())
    .map((entry) => ({
      productId: entry.product.id,
      productCode: entry.product.code,
      productName: entry.product.name,
      stage: entry.stage,
      // Receita legada (massa) não ganha rótulo: a impressão segue igual à de hoje.
      stageLabel: entry.stage === defaultRecipeStage ? null : recipeStageLabels[entry.stage],
      requiredQuantity: round3(entry.requiredQuantity),
      requiredUnit: entry.requiredUnit,
      requiredKg: round3(entry.requiredKg),
      usedBy: entry.usedBy.sort((a, b) => a.localeCompare(b)),
      items: buildScaledRecipeRowsForProduct(entry.product, entry.requiredKg, source),
    }))
    .sort(
      (a, b) =>
        getRecipeStageOrder(a.stage) - getRecipeStageOrder(b.stage) ||
        a.productName.localeCompare(b.productName),
    );

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
    const baseProduct = productsById.get(item.productId);
    // Mesma regra da pré-pesagem: OP de pedido liberado imprime a receita congelada.
    const product = baseProduct ? withFrozenRecipe(baseProduct, item.frozenRecipe) : undefined;
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
