import assert from "node:assert/strict";
import test from "node:test";

import type { ProductionLine, ProductionProduct } from "@/lib/production-planning";
import {
  buildProductFormState,
  getInvalidFieldTarget,
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

// XPAN-7: lote mínimo/econômico é opt-in — novo produto nasce com 0 para não
// disparar a flag "abaixo do lote mínimo" sem o usuário ter configurado nada.
test("XPAN-7: new product defaults lote mínimo/econômico to 0 (opt-in)", () => {
  const formState = buildProductFormState(baseLines);

  assert.equal(formState.minimumProductionKg, 0);
  assert.equal(formState.economicProductionKg, 0);
});

// Ficha em blocos: a sequência das etapas + o modo de preparo de cada bloco é OPT-IN.
// Produto novo nasce sem config ⇒ ordem canônica do enum e só `preparationMode` (geral).
test("produto novo nasce com recipeStageConfig vazio (ordem canônica do enum)", () => {
  const formState = buildProductFormState(baseLines);

  assert.deepEqual(formState.recipeStageConfig, []);
  assert.equal(formState.preparationMode, "");
});

// Retrocompatibilidade: produto legado (gravado antes da migration, sem a chave) abre
// exatamente como hoje — nenhuma etapa configurada, nenhuma instrução por bloco.
test("produto legado sem recipeStageConfig abre no form com config vazia", () => {
  const legacy = buildBaseProduct();
  assert.equal("recipeStageConfig" in legacy, false);

  const formState = buildProductFormState(baseLines, legacy);

  assert.deepEqual(formState.recipeStageConfig, []);
  assert.equal(formState.preparationMode, legacy.preparationMode);
});

test("buildProductFormState clona recipeStageConfig (form não muta o snapshot)", () => {
  const product: ProductionProduct = {
    ...buildBaseProduct(),
    recipeStageConfig: [
      { stage: "massa", instructions: "Sovar 8 min." },
      { stage: "recheio", instructions: "Cozinhar a maçã." },
    ],
  };

  const formState = buildProductFormState(baseLines, product);
  assert.deepEqual(formState.recipeStageConfig, product.recipeStageConfig);

  // Reordenar e reescrever a instrução no form não pode vazar para o produto original.
  const editedConfig = formState.recipeStageConfig ?? [];
  editedConfig.reverse();
  editedConfig[0].instructions = "editado no form";

  assert.deepEqual(product.recipeStageConfig, [
    { stage: "massa", instructions: "Sovar 8 min." },
    { stage: "recheio", instructions: "Cozinhar a maçã." },
  ]);
});

// Lixo no JSONB (etapa inexistente, duplicada, item não-objeto) não pode chegar ao form.
test("buildProductFormState normaliza recipeStageConfig vindo do banco", () => {
  const product = {
    ...buildBaseProduct(),
    recipeStageConfig: [
      { stage: "montagem", instructions: "Rechear." },
      { stage: "inexistente", instructions: "ignorar" },
      { stage: "montagem", instructions: "duplicada" },
      null,
      { stage: "massa" },
    ],
  } as unknown as ProductionProduct;

  const formState = buildProductFormState(baseLines, product);

  assert.deepEqual(formState.recipeStageConfig, [
    { stage: "montagem", instructions: "Rechear." },
    { stage: "massa", instructions: "" },
  ]);
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

// XPAN-11: campos de embalagem migraram para a aba Receita; o foco de validação
// deve levar para a aba certa (senão a radix desmonta a aba e o focus vira no-op).
test("XPAN-11: getInvalidFieldTarget aponta campos de embalagem para a aba Receita", () => {
  assert.deepEqual(getInvalidFieldTarget("packagingDescription"), {
    tab: "receita",
    id: "product-packaging-description",
  });
  assert.deepEqual(getInvalidFieldTarget("packagingWeight"), {
    tab: "receita",
    id: "product-packaging-weight",
  });
  assert.deepEqual(getInvalidFieldTarget("packagingQuantity"), {
    tab: "receita",
    id: "product-packaging-weight",
  });
});

test("XPAN-11: getInvalidFieldTarget mantém identificação (name/lineId) na aba Cadastro e etapas na Receita", () => {
  assert.deepEqual(getInvalidFieldTarget("name"), { tab: "cadastro", id: "product-name" });
  assert.deepEqual(getInvalidFieldTarget("lineId"), { tab: "cadastro", id: "product-line" });
  assert.deepEqual(getInvalidFieldTarget("preparationStages"), {
    tab: "receita",
    id: "product-preparation-stages",
  });
});
