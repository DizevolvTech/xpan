import { formatKgLabel } from "@/lib/utils";
import {
  defaultProductPreparationStages,
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
      preparationStages: normalizeProductPreparationStages(product.preparationStages),
      unitProfiles: {
        sales: { ...product.unitProfiles.sales },
        production: { ...product.unitProfiles.production },
        expedition: { ...product.unitProfiles.expedition },
      },
      packagingProfile: product.packagingProfile ? { ...product.packagingProfile } : undefined,
      productionDays: [...product.productionDays],
      saleLeadDays: product.saleLeadDays && product.saleLeadDays > 0 ? product.saleLeadDays : 1,
      expeditionLeadDays: product.expeditionLeadDays ?? null,
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
    minimumProductionKg: 100,
    economicProductionKg: 140,
    allowsStorage: false,
    productionDays: ["segunda", "quarta", "sexta"],
    saleLeadDays: 1,
    expeditionLeadDays: null,
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
