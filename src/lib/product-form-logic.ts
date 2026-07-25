import { formatKgLabel } from "@/lib/utils";
import {
  defaultProductPreparationStages,
  normalizeRecipeStageConfig,
  type PackagingProfile,
  type ProductUnitProfile,
  type ProductionLine,
  type ProductionProduct,
} from "@/lib/production-planning";
import { normalizeProductPreparationStages } from "@/lib/production-workflow";

export type ProductValidationField =
  | "name"
  | "lineId"
  | "preparationStages"
  | "packagingDescription"
  | "packagingWeight"
  | "packagingQuantity";

export type ProductValidationResult = {
  error: string | null;
  invalidFields: ProductValidationField[];
};

export type ProductInvalidFieldTarget = {
  tab: "cadastro" | "receita";
  id: string;
};

/**
 * XPAN-11: mapeia um campo inválido para { aba, id do input } — usado ao salvar para
 * focar o primeiro campo com erro. Os blocos "Resumo Operacional", "Unidades de Medida
 * e Conversões" e a embalagem migraram da aba "Cadastro" para a aba "Receita" (item 11),
 * então os campos de embalagem apontam para "receita". Antes apontavam para "cadastro":
 * o form trocava para a aba errada e, como a radix DESMONTA o conteúdo da aba inativa,
 * `getElementById(id)` não achava o input e o foco virava no-op (usuário ficava numa aba
 * sem ver o campo destacado). Pura/testável para blindar esse mapeamento.
 */
export function getInvalidFieldTarget(field: ProductValidationField): ProductInvalidFieldTarget | null {
  switch (field) {
    case "name":
      return { tab: "cadastro", id: "product-name" };
    case "lineId":
      return { tab: "cadastro", id: "product-line" };
    case "packagingDescription":
      return { tab: "receita", id: "product-packaging-description" };
    case "packagingWeight":
    case "packagingQuantity":
      return { tab: "receita", id: "product-packaging-weight" };
    case "preparationStages":
      return { tab: "receita", id: "product-preparation-stages" };
    default:
      return null;
  }
}

function createUnitProfile(
  unit: ProductUnitProfile["unit"],
  description: string,
  weightKg: number,
): ProductUnitProfile {
  return {
    unit,
    description,
    weightKg: unit === "Kg" ? 1 : weightKg,
  };
}

export function calculateQuantityPerPackage(unitWeightKg: number, packagingWeightKg: number) {
  if (
    !Number.isFinite(unitWeightKg) ||
    unitWeightKg <= 0 ||
    !Number.isFinite(packagingWeightKg) ||
    packagingWeightKg <= 0
  ) {
    return 0;
  }

  return Number((packagingWeightKg / unitWeightKg).toFixed(3));
}

export function buildProductFormState(
  _lines: ProductionLine[],
  product?: ProductionProduct | null,
): ProductionProduct {
  if (product) {
    return {
      ...product,
      recipe: product.recipe.map((item) => ({ ...item })),
      // Cópia própria (como a receita): o form reordena etapas e edita o modo de preparo de
      // cada bloco in-place; sem clonar, isso mutaria o snapshot compartilhado. Normalizar
      // aqui também garante que produto legado (sem config) entre no form como array vazio
      // — que é a ordem canônica do enum, o comportamento de hoje.
      recipeStageConfig: normalizeRecipeStageConfig(product.recipeStageConfig),
      preparationStages: normalizeProductPreparationStages(product.preparationStages),
      unitProfiles: {
        sales: { ...product.unitProfiles.sales },
        production: { ...product.unitProfiles.production },
        expedition: { ...product.unitProfiles.expedition },
      },
      packagingProfile: product.packagingProfile ? { ...product.packagingProfile } : undefined,
      productionDays: [...product.productionDays],
      expeditionLeadDays:
        Number.isFinite(product.expeditionLeadDays) && Number(product.expeditionLeadDays) >= 0
          ? Number(product.expeditionLeadDays)
          : 1,
      ingredientProfile: product.ingredientProfile
        ? {
            ...product.ingredientProfile,
            purchaseUnit: product.ingredientProfile.purchaseUnit ?? product.ingredientProfile.unit,
            purchaseToConsumptionFactor:
              product.ingredientProfile.purchaseToConsumptionFactor &&
              product.ingredientProfile.purchaseToConsumptionFactor > 0
                ? product.ingredientProfile.purchaseToConsumptionFactor
                : 1,
          }
        : undefined,
    };
  }

  return {
    id: `product-${Date.now()}`,
    code: `PR-${String(Date.now()).slice(-5)}`,
    externalCode: "",
    name: "",
    shortName: "",
    description: "",
    lineId: "",
    active: true,
    availableForOrdering: true,
    validityDays: 5,
    // XPAN-7: lote mínimo/econômico é OPT-IN. Antes o novo produto já nascia com
    // mínimo 100 → a flag "abaixo do lote mínimo" (engine.ts, guard `> 0`) aparecia
    // por padrão em quase toda OP de baixa demanda, parecendo uma trava que o usuário
    // nunca configurou. Zero por padrão: a regra só age quando explicitamente preenchida.
    minimumProductionKg: 0,
    economicProductionKg: 0,
    allowsStorage: false,
    productionDays: ["segunda", "quarta", "sexta"],
    expeditionLeadDays: 1,
    unitProfiles: {
      sales: createUnitProfile("Kg", "Unidade de venda", 1),
      production: createUnitProfile("Kg", "Unidade de produção", 1),
      expedition: createUnitProfile("Kg", "Unidade de expedição", 1),
    },
    packagingProfile: {
      unit: "Un",
      description: "Embalagem individual",
      weightKg: 0.2,
      quantityPerPackage: 1,
    },
    isSoldLoose: false,
    recipe: [],
    // Produto novo nasce SEM sequência configurada: as etapas aparecem na ordem canônica do
    // enum e sem modo de preparo por bloco (só `preparationMode`, a instrução geral).
    recipeStageConfig: [],
    preparationStages: [...defaultProductPreparationStages],
    preparationMode: "",
    breakPercent: 0,
    breakStage: "depois_divisao",
    breakComment: "",
    canBeIngredient: false,
    ingredientProfile: {
      unit: "Kg",
      weightKg: 1,
      purchaseUnit: "Kg",
      purchaseToConsumptionFactor: 1,
      metadata: "",
      observation: "",
    },
    weight: formatKgLabel(1, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
    productionUnit: "Kg",
    salesUnit: "Kg",
    salesToKgFactor: 1,
    expeditionUnit: "Kg",
    expeditionToKgFactor: 1,
    isMpiIngredient: false,
    capacityPerBatch: null,
    economicBatchUnit: null,
    mainIngredientLimitKg: null,
  };
}

export function validateProductFormState(options: {
  product: ProductionProduct;
  availablePackagingUnits?: PackagingProfile["unit"][];
}) {
  const { product } = options;
  const invalidFields: ProductValidationField[] = [];

  if (!product.name.trim()) {
    invalidFields.push("name");
  }

  if (!product.lineId) {
    invalidFields.push("lineId");
  }

  if (!Array.isArray(product.preparationStages) || product.preparationStages.length === 0) {
    invalidFields.push("preparationStages");
  }

  if (invalidFields.length > 0) {
    return {
      error: "Preencha os campos obrigatórios destacados antes de salvar.",
      invalidFields,
    } satisfies ProductValidationResult;
  }

  if (!product.isSoldLoose && product.unitProfiles.sales.unit === "Kg") {
    if (!product.packagingProfile?.description.trim()) {
      return {
        error: "Informe a descrição da embalagem para itens vendidos em Kg e embalados individualmente.",
        invalidFields: ["packagingDescription"],
      } satisfies ProductValidationResult;
    }

    if (
      !Number.isFinite(product.packagingProfile.weightKg) ||
      product.packagingProfile.weightKg <= 0
    ) {
      return {
        error: "Informe o peso padrão da embalagem para itens vendidos em Kg.",
        invalidFields: ["packagingWeight"],
      } satisfies ProductValidationResult;
    }
  }

  const packagingWeightKg =
    product.packagingProfile?.unit === "Kg" ? 1 : (product.packagingProfile?.weightKg ?? 0);
  const salesWeightKg =
    product.unitProfiles.sales.unit === "Kg" ? 1 : product.unitProfiles.sales.weightKg;

  if (
    !product.isSoldLoose &&
    product.packagingProfile &&
    calculateQuantityPerPackage(salesWeightKg, packagingWeightKg) <= 0
  ) {
    return {
      error: "Informe pesos válidos para calcular o conteúdo por embalagem.",
      invalidFields: ["packagingQuantity"],
    } satisfies ProductValidationResult;
  }

  return {
    error: null,
    invalidFields: [],
  } satisfies ProductValidationResult;
}
