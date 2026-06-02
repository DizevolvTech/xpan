import assert from "node:assert/strict";
import test from "node:test";

import type { ProductionLine, ProductionProduct } from "@/lib/production-planning";
import {
  buildProductFormState,
  validateProductFormState,
} from "@/lib/product-form-logic";

const baseLines: ProductionLine[] = [
  {
    id: "line-1",
    code: "LP-001",
    name: "Linha Panificação",
    sectorId: "sector-1",
    type: "Seco",
    operatingHours: "05:00 - 14:00",
    capacityPerDayKg: 900,
    status: "ativo",
  },
];

function buildBaseProduct(): ProductionProduct {
  return {
    id: "product-1",
    code: "PR-0001",
    externalCode: "",
    name: "Pão Francês",
    shortName: "Pão Fr.",
    description: "",
    lineId: "line-1",
    active: true,
    availableForOrdering: true,
    validityDays: 5,
    minimumProductionKg: 100,
    economicProductionKg: 140,
    allowsStorage: false,
    productionDays: ["segunda", "quarta", "sexta"],
    unitProfiles: {
      sales: { unit: "Kg", description: "Venda", weightKg: 1 },
      production: { unit: "Kg", description: "Produção", weightKg: 1 },
      expedition: { unit: "Kg", description: "Expedição", weightKg: 1 },
    },
    packagingProfile: {
      unit: "Un",
      description: "Pacote padrão",
      weightKg: 0.2,
      quantityPerPackage: 1,
    },
    isSoldLoose: false,
    recipe: [],
    preparationStages: ["em_preparacao"],
    preparationMode: "",
    breakPercent: 0,
    breakStage: "depois_divisao",
    breakComment: "",
    canBeIngredient: false,
    ingredientProfile: undefined,
    weight: "1,000 Kg",
    productionUnit: "Kg",
    salesUnit: "Kg",
    salesToKgFactor: 1,
    expeditionUnit: "Kg",
    expeditionToKgFactor: 1,
      expeditionLeadDays: 1,
    isMpiIngredient: false,
    capacityPerBatch: null,
    economicBatchUnit: null,
  };
}

test("new product form starts without a production line selected", () => {
  const formState = buildProductFormState(baseLines);

  assert.equal(formState.lineId, "");
  assert.equal(formState.expeditionLeadDays, 1);
  assert.equal(formState.shortName, "");
});

test("product form validation returns required field markers", () => {
  const validation = validateProductFormState({
    product: {
      ...buildBaseProduct(),
      name: "   ",
      lineId: "",
      preparationStages: [],
    },
  });

  assert.equal(validation.error, "Preencha os campos obrigatórios destacados antes de salvar.");
  assert.deepEqual(validation.invalidFields, ["name", "lineId", "preparationStages"]);
});
