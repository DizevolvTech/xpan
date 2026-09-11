import type {
  ProductionIngredient,
  ProductionProduct,
  RecipeIngredientReference,
  RecipeStage,
  RecipeStageConfigEntry,
} from "@/lib/production-planning";
import {
  defaultRecipeStage,
  getRecipeStageInstructions,
  hasStagedRecipe,
  normalizeRecipeStage,
  recipeStageLabels,
  recipeStages,
  resolveRecipeStageOrder,
} from "@/lib/production-planning";
import type { ProductionOrderRow } from "@/lib/order-planning";
import type { UnitCode } from "@/lib/factory-planning/units";
import { round3, scaleRecipeQuantity } from "@/lib/factory-planning/recipe-expansion";
import { getRecipeReferenceWeightKgFromData } from "@/lib/production-data-utils";
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
  /**
   * Sequência de etapas + modo de preparo da FICHA AO VIVO do produto. É editorial (como a
   * ficha é lida), por isso não entra no congelamento da receita: mesmo em OP com
   * `frozenRecipe`, a ordem dos blocos vem daqui.
   */
  recipeStageConfig?: RecipeStageConfigEntry[];
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
  /** Ficha do próprio MPI — ordena os blocos da receita DELE. */
  recipeStageConfig?: RecipeStageConfigEntry[];
  items: PrintIngredientRow[];
};

/**
 * Linha da folha de produção: a linha da receita + quanto dela entra em CADA unidade
 * produzida (a coluna "Unidades" da ficha do cliente).
 */
export type ProductionSheetRow = PrintIngredientRow & {
  /**
   * Quanto desta linha vai em UMA unidade produzida. Vale para qualquer linha — pode ser um
   * MPI (0,234 kg de massa por cuca) ou um ingrediente simples (0,120 kg de farofa por cuca).
   * `null` quando o produto não tem peso unitário/carga para derivar a conta.
   */
  quantityPerUnit: number | null;
};

export type ProductionSheetProductSection = {
  productId: string;
  productCode: string;
  productName: string;
  plannedKg: number;
  requestedQuantity: number;
  requestedUnit: UnitCode;
  unitWeightKg: number;
  /**
   * Quantas unidades a carga planejada rende (`plannedKg / unitWeightKg`) — é o divisor da
   * coluna "Unidades". Sai da carga PLANEJADA, não do pedido: se a fábrica arredondou para
   * cima, o quanto vai em cada unidade continua o mesmo.
   */
  unitsCount: number;
  /** Ver `PreWeighingProductSection.recipeStageConfig`: ordem dos blocos + modo de preparo por etapa. */
  recipeStageConfig?: RecipeStageConfigEntry[];
  items: ProductionSheetRow[];
};

/** Gap entre PRODUZIR e ENTREGAR desta OP — o "Dia+1" que a ficha imprime no cabeçalho. */
export type ProductionSheetDeliveryGap = {
  /** Dias distintos, em ordem crescente. Vazio quando a OP não tem entrega conhecida. */
  days: number[];
  /** "Dia+1" (ou "Mesmo dia"; mais de uma data de entrega vira "Dia+1 / Dia+2"). */
  label: string | null;
};

export type ProductionSheetDocument = {
  deliveryGap: ProductionSheetDeliveryGap;
  /**
   * Seção do MPI, que na ficha do cliente vem ANTES dos produtos: o MPI é batido UMA vez,
   * agregando o consumo de todos os produtos da OP.
   */
  ingredientSections: ProductIngredientSection[];
  productSections: ProductionSheetProductSection[];
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
  /**
   * Modo de preparo DESTE bloco (`products.recipe_stage_config`). String vazia quando a
   * etapa não tem instrução própria — quem imprime não deve renderizar nada nesse caso.
   * Não substitui `preparationMode`, que segue sendo a instrução geral do produto.
   */
  instructions: string;
  rows: TRow[];
};

/**
 * Agrupa as linhas de uma receita por etapa, na SEQUÊNCIA que a ficha do produto definiu
 * (`recipeStageConfig`). Sem config, cai na ordem canônica do enum — resultado idêntico ao
 * de antes de existir a sequência manual. Dentro do grupo a ordem de entrada é preservada
 * (é o `sort_order` da receita).
 *
 * Receita não migrada (nenhuma linha fora de `massa`) devolve UM grupo com as linhas
 * intactas e sem cabeçalho — garantia de que a folha de quem não preencheu etapa sai
 * idêntica à de hoje.
 */
export function groupPrintRowsByStage<TRow extends { stage?: RecipeStage }>(
  rows: TRow[],
  stageConfig?: RecipeStageConfigEntry[],
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
        // Sem config o modo de preparo por etapa é vazio: nada muda para quem não configurou.
        instructions: getRecipeStageInstructions(stageConfig, defaultRecipeStage),
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

  // `resolveRecipeStageOrder` só devolve etapa que tem linha — a impressão não abre bloco vazio.
  return resolveRecipeStageOrder(stageConfig, rows).map((stage) => ({
    stage,
    label: recipeStageLabels[stage],
    showStageHeader: true,
    instructions: getRecipeStageInstructions(stageConfig, stage),
    rows: rowsByStage.get(stage) ?? [],
  }));
}

/**
 * Ordem de etapas válida para a OP INTEIRA — usada nas seções de MPI, que são agregadas por
 * (produto, etapa) e cuja etapa vem da receita de QUEM CONSOME, podendo ser mais de um
 * produto. Funde as sequências das fichas na ordem em que os produtos aparecem na OP (a
 * primeira ficha que posicionou a etapa manda) e completa com a ordem canônica do enum.
 *
 * Sem nenhuma ficha configurada o resultado é exatamente `recipeStages` — a ordem de hoje.
 */
function resolveOpStageOrder(products: (ProductionProduct | undefined)[]): RecipeStage[] {
  const ordered: RecipeStage[] = [];

  products.forEach((product) => {
    if (!product) {
      return;
    }
    // `includeEmpty` respeita a sequência declarada inteira, mesmo que a etapa ainda não
    // tenha ingrediente naquele produto — o que importa aqui é a posição relativa.
    resolveRecipeStageOrder(product.recipeStageConfig, product.recipe, { includeEmpty: true }).forEach((stage) => {
      if (!ordered.includes(stage)) {
        ordered.push(stage);
      }
    });
  });

  recipeStages.forEach((stage) => {
    if (!ordered.includes(stage)) {
      ordered.push(stage);
    }
  });

  return ordered;
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
  return round3(
    getRecipeReferenceWeightKgFromData(
      {
        sourceType: "produto",
        sourceId: sourceProduct?.id ?? "",
        quantity: row.estimatedQuantity,
        unit: row.unit,
      },
      new Map(),
      sourceProduct ? new Map([[sourceProduct.id, sourceProduct]]) : new Map(),
    ),
  );
}

/**
 * Seções de MPI da OP inteira, agregadas por (produto ingrediente, ETAPA) e escaladas para o
 * peso que a OP toda consome. É a MESMA agregação que a pré-pesagem sempre fez — extraída
 * daqui porque a folha de produção passou a abrir a seção do MPI no topo (ficha do cliente).
 * Uma agregação só, dois documentos: o padeiro pesa e produz exatamente o mesmo MPI.
 */
function collectIngredientProductSections(
  op: ProductionOrderRow,
  source: {
    products: ProductionProduct[];
    ingredients: ProductionIngredient[];
  },
): ProductIngredientSection[] {
  const { productsById } = buildSourceMaps(source);
  // Sequência de etapas desta OP: ordena as seções de MPI pela ordem que as fichas dos
  // produtos consumidores definiram, não mais pela ordem canônica do enum.
  const opStageOrder = resolveOpStageOrder(
    op.items.map((item) => {
      const baseProduct = productsById.get(item.productId);
      return baseProduct ? withFrozenRecipe(baseProduct, item.frozenRecipe) : undefined;
    }),
  );
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

  op.items.forEach((item) => {
    // Receita congelada na liberação, quando houver — mesma regra das duas folhas.
    const baseProduct = productsById.get(item.productId);
    const product = baseProduct ? withFrozenRecipe(baseProduct, item.frozenRecipe) : undefined;
    if (!product) {
      return;
    }

    // As quantidades agregadas saem de `estimatedQuantity`, que não depende do desdobramento
    // de batidas — por isso a agregação roda sem `batchKgs`.
    buildScaledRecipeRowsForProduct(product, item.totalKg, source).forEach((row, index) => {
      const recipeItem = product.recipe[index];
      const sourceProduct = recipeItem?.sourceType === "produto" ? productsById.get(recipeItem.sourceId) : undefined;
      if (row.sourceType !== "produto" || !sourceProduct?.canBeIngredient) {
        return;
      }

      const stageKey = `${sourceProduct.id}::${row.stage}`;
      const current = ingredientProductMap.get(stageKey);
      const requiredKg = convertRecipeRowToKg(row, sourceProduct);

      if (current) {
        current.requiredQuantity = round3(current.requiredQuantity + row.estimatedQuantity);
        current.requiredKg = round3(current.requiredKg + requiredKg);
        if (!current.usedBy.includes(item.productName)) {
          current.usedBy.push(item.productName);
        }
        return;
      }

      ingredientProductMap.set(stageKey, {
        product: sourceProduct,
        stage: row.stage,
        requiredQuantity: row.estimatedQuantity,
        requiredUnit: row.unit,
        requiredKg,
        usedBy: [item.productName],
      });
    });
  });

  return Array.from(ingredientProductMap.values())
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
      recipeStageConfig: entry.product.recipeStageConfig,
      items: buildScaledRecipeRowsForProduct(entry.product, entry.requiredKg, source),
    }))
    .sort(
      (a, b) =>
        opStageOrder.indexOf(a.stage) - opStageOrder.indexOf(b.stage) ||
        a.productName.localeCompare(b.productName),
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
        recipeStageConfig: undefined,
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

      // MPI sai do bloco do produto e vira seção própria (`collectIngredientProductSections`).
      if (isProductIngredient && sourceProduct) {
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
      recipeStageConfig: product.recipeStageConfig,
      baseIngredients,
      additionalIngredients,
    };
  });

  return {
    productSections,
    ingredientProducts: collectIngredientProductSections(op, source),
  };
}

/** Diferença em dias entre duas chaves `YYYY-MM-DD`. `null` quando alguma não é uma data. */
function diffDaysBetweenDateKeys(from: string | null | undefined, to: string | null | undefined) {
  const parse = (value: string | null | undefined) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
    return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  };

  const start = parse(from);
  const end = parse(to);
  if (start == null || end == null) {
    return null;
  }
  // UTC dos dois lados: sem horário e sem fuso, a subtração é exata em dias.
  return Math.round((end - start) / 86_400_000);
}

/**
 * "Dia+1" do cabeçalho: o gap entre PRODUZIR e ENTREGAR desta OP. Sai das datas da própria
 * OP (produção × entrega dos itens de pedido) para nunca contradizer as duas datas impressas
 * ao lado. OP sem item de pedido (ex.: só MPI) não tem gap — o cabeçalho simplesmente omite.
 */
export function resolveProductionDeliveryGap(op: ProductionOrderRow): ProductionSheetDeliveryGap {
  const days = Array.from(
    new Set(
      op.sourceItems
        .map((item) => diffDaysBetweenDateKeys(op.productionDate, item.deliveryDate))
        .filter((value): value is number => value != null),
    ),
  ).sort((a, b) => a - b);

  return {
    days,
    label:
      days.length === 0
        ? null
        : days.map((value) => (value === 0 ? "Mesmo dia" : `Dia+${value}`)).join(" / "),
  };
}

/** Unidades de peso/volume convertidas para kg — o resto (Un, Forma…) não entra em soma de kg. */
const weightUnitFactorsKg: Partial<Record<UnitCode, number>> = {
  Kg: 1,
  g: 0.001,
  L: 1,
  ml: 0.001,
};

/**
 * Subtotal POR UNIDADE de um bloco — o "0,165 kg" que a ficha imprime no sub-cabeçalho
 * "Ingredientes recheio:". Só soma linha em peso/volume; linha contada em unidade (ex.: ovo
 * em "Un") ficaria fora de escala numa soma em kg. `null` quando não há nada somável.
 */
export function sumStageQuantityPerUnitKg(
  rows: { unit: UnitCode; quantityPerUnit?: number | null }[],
): number | null {
  let total = 0;
  let hasValue = false;

  rows.forEach((row) => {
    const factor = weightUnitFactorsKg[row.unit];
    if (factor == null || row.quantityPerUnit == null) {
      return;
    }
    total += row.quantityPerUnit * factor;
    hasValue = true;
  });

  return hasValue ? round3(total) : null;
}

export function buildProductionSheetDocument(
  op: ProductionOrderRow,
  source: {
    products: ProductionProduct[];
    ingredients: ProductionIngredient[];
  },
): ProductionSheetDocument {
  const { productsById } = buildSourceMaps(source);

  // O MPI já é impresso na seção "Produto Ingrediente" (com "Peso finalizado"), então ele NÃO
  // pode voltar como bloco de produto: quando o MPI herda a linha do pai, o motor o coloca como
  // item da MESMA OP e o padeiro receberia a mesma massa duas vezes — a segunda com a faixa
  // "Pedido · Kg 0", que não quer dizer nada. A ficha do cliente tem UMA seção de MPI.
  const ingredientSections = collectIngredientProductSections(op, source);
  const productIdsInIngredientSections = new Set(ingredientSections.map((section) => section.productId));

  const productSections: ProductionSheetProductSection[] = op.items
    .filter((item) => !productIdsInIngredientSections.has(item.productId))
    .map((item) => {
    const baseProduct = productsById.get(item.productId);
    // Mesma regra da pré-pesagem: OP de pedido liberado imprime a receita congelada.
    const product = baseProduct ? withFrozenRecipe(baseProduct, item.frozenRecipe) : undefined;
    const requestedSummary = buildRequestedSummary(op, item.productId);
    const unitWeightKg = getOperationalUnitWeight(product);
    // Divisor da coluna "Unidades". Produto vendido a granel tem peso unitário 1 kg — a
    // "unidade" dele é o quilo, e a coluna vira o quanto de cada insumo há por quilo.
    const unitsCount = unitWeightKg > 0 ? item.totalKg / unitWeightKg : 0;

    return {
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      plannedKg: item.totalKg,
      requestedQuantity: requestedSummary.requestedQuantity,
      requestedUnit: requestedSummary.requestedUnit,
      unitWeightKg,
      unitsCount: round3(unitsCount),
      // Config vem do produto AO VIVO (`withFrozenRecipe` só troca a receita): a sequência
      // dos blocos é editorial e não faz parte do congelamento de quantidades.
      recipeStageConfig: product?.recipeStageConfig,
      items: buildScaledRecipeRowsForProduct(product, item.totalKg, source).map<ProductionSheetRow>(
        (row) => ({
          ...row,
          quantityPerUnit: unitsCount > 0 ? round3(row.estimatedQuantity / unitsCount) : null,
        }),
      ),
    };
    });

  return {
    deliveryGap: resolveProductionDeliveryGap(op),
    // O MPI vem primeiro na ficha: é batido uma vez para a OP inteira e só depois cada
    // produto o consome. Mesma agregação da pré-pesagem, para as duas folhas baterem.
    ingredientSections,
    productSections,
  };
}
