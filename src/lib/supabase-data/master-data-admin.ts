import "server-only";

import type {
  IngredientCompositionItem,
  ProductPreparationStageKey,
  ProductionIngredient,
  ProductionLine,
  ProductionProduct,
  ProductionWeekDay,
  RecipeIngredientReference,
  StoreMasterData,
} from "@/lib/production-planning";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  buildDefaultScheduleDayPriorities,
  normalizeScheduleDayPriorities,
} from "@/lib/production-data-utils";
import {
  assertSupabaseResult,
  isUuid,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";
import { normalizeProductPreparationStages } from "@/lib/production-workflow";

type RecordStatus = "ativo" | "inativo";

export type CategoryInput = {
  name: string;
  responsible: string;
  status: RecordStatus;
};

export type SubcategoryInput = {
  name: string;
  sectorId: string;
  type: ProductionLine["type"];
  operatingHours: string;
  capacityPerDayKg: number;
  status: RecordStatus;
};

export type StoreInput = Omit<StoreMasterData, "id" | "code" | "createdAt" | "updatedAt"> & {
  code?: string;
};

export type StoreUserCandidate = {
  id: string;
  name: string;
  email: string;
  status: RecordStatus;
};

export type IngredientInput = Omit<
  ProductionIngredient,
  "id" | "code" | "status" | "createdAt" | "updatedAt"
> & {
  code?: string;
  externalCode?: string;
  status?: RecordStatus;
};

export type ProductInput = Omit<ProductionProduct, "id" | "code" | "createdAt" | "updatedAt"> & {
  code?: string;
  externalCode?: string;
  changeDescription?: string;
};

export type OperationalSettingsInput = {
  orderCutoffTime: string;
  expeditionLeadDays: number;
};

type MutationOptions = {
  supabase?: SupabaseDataClient;
  actingProfileId?: string | null;
};

function buildGeneratedLegacyId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function buildNextCode(existingCodes: string[], prefix: string, width: number) {
  const numericValues = existingCodes
    .map((code) => {
      const match = code.match(new RegExp(`^${prefix}-(\\d+)$`));
      return match ? Number(match[1]) : 0;
    })
    .filter((value) => Number.isFinite(value));

  const nextValue = (numericValues.length > 0 ? Math.max(...numericValues) : 0) + 1;
  return `${prefix}-${String(nextValue).padStart(width, "0")}`;
}

async function resolveRowByIdentifier(
  table: "categories" | "subcategories" | "stores" | "ingredients" | "products" | "schedule_lines" | "profiles",
  identifier: string,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const legacyResult = await supabase.from(table).select("*").eq("legacy_id", identifier).maybeSingle();

  if (legacyResult.error) {
    throw new Error(`Failed to resolve ${table} by legacy id: ${legacyResult.error.message}`);
  }

  if (legacyResult.data) {
    return legacyResult.data as Record<string, unknown>;
  }

  if (!isUuid(identifier)) {
    throw new Error(`${table} not found`);
  }

  const idResult = await supabase.from(table).select("*").eq("id", identifier).maybeSingle();
  if (idResult.error) {
    throw new Error(`Failed to resolve ${table} by id: ${idResult.error.message}`);
  }

  if (!idResult.data) {
    throw new Error(`${table} not found`);
  }

  return idResult.data as Record<string, unknown>;
}

async function resolveCategoryId(
  identifier: string,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const row = await resolveRowByIdentifier("categories", identifier, supabase);
  return String(row.id);
}

async function resolveIngredientId(
  identifier: string,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const row = await resolveRowByIdentifier("ingredients", identifier, supabase);
  return String(row.id);
}

async function resolveProductId(
  identifier: string,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const legacyResult = await supabase.from("products").select("id").eq("legacy_id", identifier).maybeSingle();

  if (legacyResult.error) {
    throw new Error(`Failed to resolve products by legacy id: ${legacyResult.error.message}`);
  }

  if (legacyResult.data) {
    return legacyResult.data.id;
  }

  if (!isUuid(identifier)) {
    throw new Error("products not found");
  }

  const idResult = await supabase.from("products").select("id").eq("id", identifier).maybeSingle();
  if (idResult.error) {
    throw new Error(`Failed to resolve products by id: ${idResult.error.message}`);
  }
  if (!idResult.data) {
    throw new Error("products not found");
  }
  return idResult.data.id;
}

async function resolveStoreResponsibleProfile(
  identifier: string,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const row = await resolveRowByIdentifier("profiles", identifier, supabase);

  if (String(row.role) !== "loja") {
    throw new Error("O responsável da loja deve ser um usuário do tipo loja.");
  }

  return {
    id: String(row.id),
    name: String(row.name),
  };
}

async function resolveProfileDbId(
  identifier: string,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const row = await resolveRowByIdentifier("profiles", identifier, supabase);
  return String(row.id);
}

async function syncStoreResponsibleAccess(
  storeId: string,
  nextResponsibleProfileId: string | null,
  previousResponsibleProfileId: string | null,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  if (previousResponsibleProfileId && previousResponsibleProfileId !== nextResponsibleProfileId) {
    const deleteResult = await supabase
      .from("profile_store_access")
      .delete()
      .eq("profile_id", previousResponsibleProfileId)
      .eq("store_id", storeId);

    if (deleteResult.error) {
      throw new Error(`Failed to reset previous store responsible access: ${deleteResult.error.message}`);
    }
  }

  if (!nextResponsibleProfileId) {
    return;
  }

  const insertResult = await supabase.from("profile_store_access").upsert(
    {
      profile_id: nextResponsibleProfileId,
      store_id: storeId,
    },
    {
      onConflict: "profile_id,store_id",
    },
  );

  if (insertResult.error) {
    throw new Error(`Failed to assign store access to responsible user: ${insertResult.error.message}`);
  }
}

export async function listStoreUserCandidates(
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const result = await supabase
    .from("profiles")
    .select("id, legacy_id, name, email, status, role")
    .eq("role", "loja")
    .order("status", { ascending: true })
    .order("name", { ascending: true });

  const rows = assertSupabaseResult(result, "Failed to load store user candidates");

  return rows.map<StoreUserCandidate>((row) => ({
    id: row.legacy_id ?? row.id,
    name: row.name,
    email: row.email,
    status: row.status,
  }));
}

export async function createCategory(input: CategoryInput, options: MutationOptions = {}) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const existingCodesResult = await supabase.from("categories").select("code");
  const existingCodes = assertSupabaseResult(existingCodesResult, "Failed to load category codes");

  const result = await supabase.from("categories").insert({
    legacy_id: buildGeneratedLegacyId("sector"),
    code: buildNextCode(existingCodes.map((row) => row.code), "SE", 3),
    name: input.name.trim(),
    responsible: input.responsible.trim(),
    status: input.status,
  });

  if (result.error) {
    throw new Error(`Failed to create category: ${result.error.message}`);
  }
}

export async function updateCategory(
  identifier: string,
  input: CategoryInput,
  options: MutationOptions = {},
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const row = await resolveRowByIdentifier("categories", identifier, supabase);
  const result = await supabase
    .from("categories")
    .update({
      name: input.name.trim(),
      responsible: input.responsible.trim(),
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(row.id));

  if (result.error) {
    throw new Error(`Failed to update category: ${result.error.message}`);
  }
}

export async function createSubcategory(input: SubcategoryInput, options: MutationOptions = {}) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const existingCodesResult = await supabase.from("subcategories").select("code");
  const existingCodes = assertSupabaseResult(existingCodesResult, "Failed to load subcategory codes");
  const categoryId = await resolveCategoryId(input.sectorId, supabase);
  const legacyId = buildGeneratedLegacyId("line");
  const code = buildNextCode(existingCodes.map((row) => row.code), "LP", 3);

  const result = await supabase.from("subcategories").insert({
    legacy_id: legacyId,
    code,
    name: input.name.trim(),
    category_id: categoryId,
    type: input.type,
    operating_hours: input.operatingHours.trim(),
    capacity_per_day_kg: input.capacityPerDayKg,
    status: input.status,
  });

  if (result.error) {
    throw new Error(`Failed to create subcategory: ${result.error.message}`);
  }

  return {
    id: legacyId,
    code,
  };
}

export async function updateSubcategory(
  identifier: string,
  input: SubcategoryInput,
  options: MutationOptions = {},
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const row = await resolveRowByIdentifier("subcategories", identifier, supabase);
  const categoryId = await resolveCategoryId(input.sectorId, supabase);

  const result = await supabase
    .from("subcategories")
    .update({
      name: input.name.trim(),
      category_id: categoryId,
      type: input.type,
      operating_hours: input.operatingHours.trim(),
      capacity_per_day_kg: input.capacityPerDayKg,
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(row.id));

  if (result.error) {
    throw new Error(`Failed to update subcategory: ${result.error.message}`);
  }
}

export async function createStore(input: StoreInput, options: MutationOptions = {}) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const existingCodesResult = await supabase.from("stores").select("code");
  const existingCodes = assertSupabaseResult(existingCodesResult, "Failed to load store codes");
  const responsibleProfileId = input.responsibleProfileId?.trim() || null;
  const responsibleProfile = responsibleProfileId
    ? await resolveStoreResponsibleProfile(responsibleProfileId, supabase)
    : null;

  const result = await supabase.from("stores").insert({
    legacy_id: buildGeneratedLegacyId("store"),
    code: input.code?.trim() || buildNextCode(existingCodes.map((row) => row.code), "LJ", 3),
    name: input.name.trim(),
    responsible: responsibleProfile?.name ?? "Não vinculado",
    responsible_profile_id: responsibleProfile?.id ?? null,
    email: input.email.trim(),
    phone: input.phone.trim(),
    status: input.status,
    receive_window: input.receiveWindow.trim(),
    ordering_days: input.orderingDays,
    receiving_days: input.receivingDays,
    ordering_blocked_days: input.orderingBlockedDays,
    receiving_blocked_days: input.receivingBlockedDays,
  }).select("id").single();

  const createdStore = assertSupabaseResult(result, "Failed to create store");

  await syncStoreResponsibleAccess(createdStore.id, responsibleProfile?.id ?? null, null, supabase);
}

export async function updateStore(
  identifier: string,
  input: StoreInput,
  options: MutationOptions = {},
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const row = await resolveRowByIdentifier("stores", identifier, supabase);
  const responsibleProfileId = input.responsibleProfileId?.trim() || null;
  const responsibleProfile = responsibleProfileId
    ? await resolveStoreResponsibleProfile(responsibleProfileId, supabase)
    : null;

  const result = await supabase
    .from("stores")
    .update({
      name: input.name.trim(),
      responsible: responsibleProfile?.name ?? "Não vinculado",
      responsible_profile_id: responsibleProfile?.id ?? null,
      email: input.email.trim(),
      phone: input.phone.trim(),
      status: input.status,
      receive_window: input.receiveWindow.trim(),
      ordering_days: input.orderingDays,
      receiving_days: input.receivingDays,
      ordering_blocked_days: input.orderingBlockedDays,
      receiving_blocked_days: input.receivingBlockedDays,
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(row.id));

  if (result.error) {
    throw new Error(`Failed to update store: ${result.error.message}`);
  }

  await syncStoreResponsibleAccess(
    String(row.id),
    responsibleProfile?.id ?? null,
    typeof row.responsible_profile_id === "string" ? row.responsible_profile_id : null,
    supabase,
  );
}

async function replaceIngredientComponents(
  ingredientId: string,
  composition: IngredientCompositionItem[],
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const deleteResult = await supabase.from("ingredient_components").delete().eq("ingredient_id", ingredientId);

  if (deleteResult.error) {
    throw new Error(`Failed to reset ingredient composition: ${deleteResult.error.message}`);
  }

  if (composition.length === 0) {
    return;
  }

  const rows = await Promise.all(
    composition.map(async (item, index) => ({
      ingredient_id: ingredientId,
      ingredient_reference_id: item.ingredientId
        ? await resolveIngredientId(item.ingredientId, supabase)
        : null,
      product_reference_id: item.productId ? await resolveProductId(item.productId, supabase) : null,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      observation: item.observation,
      sort_order: index,
    })),
  );

  const insertResult = await supabase.from("ingredient_components").insert(rows);
  if (insertResult.error) {
    throw new Error(`Failed to save ingredient composition: ${insertResult.error.message}`);
  }
}

async function resolveSubcategoryId(
  identifier: string,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const row = await resolveRowByIdentifier("subcategories", identifier, supabase);
  return String(row.id);
}

function normalizeOptionalCode(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

function normalizeOperationalSettingsPayload(input: OperationalSettingsInput) {
  const orderCutoffTime = input.orderCutoffTime.trim();
  const timeMatch = orderCutoffTime.match(/^(\d{2}):(\d{2})$/);

  if (!timeMatch) {
    throw new Error("Informe o horário limite no formato HH:MM.");
  }

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error("Informe um horário limite válido.");
  }

  const expeditionLeadDays = Number(input.expeditionLeadDays);

  if (!Number.isInteger(expeditionLeadDays) || expeditionLeadDays < 0 || expeditionLeadDays > 30) {
    throw new Error("Informe um D+X inteiro entre 0 e 30 dias.");
  }

  return {
    order_cutoff_time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    expedition_lead_days: expeditionLeadDays,
  };
}

export async function updateOperationalSettings(
  input: OperationalSettingsInput,
  options: MutationOptions = {},
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const normalizedInput = normalizeOperationalSettingsPayload(input);
  const now = new Date().toISOString();

  const settingsResult = await supabase
    .from("operational_settings")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const currentSettings = assertSupabaseResult(
    { data: settingsResult.data, error: settingsResult.error },
    "Failed to load operational settings",
  );

  if (currentSettings?.id) {
    const updateResult = await supabase
      .from("operational_settings")
      .update({
        ...normalizedInput,
        updated_at: now,
      })
      .eq("id", currentSettings.id);

    if (updateResult.error) {
      throw new Error(`Failed to update operational settings: ${updateResult.error.message}`);
    }
  } else {
    const insertResult = await supabase.from("operational_settings").insert({
      ...normalizedInput,
      created_at: now,
      updated_at: now,
    });

    if (insertResult.error) {
      throw new Error(`Failed to create operational settings: ${insertResult.error.message}`);
    }
  }

  return {
    orderCutoffTime: normalizedInput.order_cutoff_time,
    expeditionLeadDays: normalizedInput.expedition_lead_days,
  };
}

async function assertExternalCodeAvailable(
  table: "ingredients" | "products",
  externalCode: string | null,
  currentId?: string,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  if (!externalCode) {
    return;
  }

  const result = await supabase.from(table).select("id").eq("external_code", externalCode);
  const rows = assertSupabaseResult(result, `Failed to validate ${table} external code`);
  const duplicated = rows.some((row) => row.id !== currentId);

  if (duplicated) {
    throw new Error("O código ERP informado já está em uso.");
  }
}

async function assertIngredientExternalCodeEditable(
  ingredientId: string,
  nextExternalCode: string | null,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const [ingredientResult, componentUsageResult, recipeUsageResult] = await Promise.all([
    supabase.from("ingredients").select("external_code").eq("id", ingredientId).maybeSingle(),
    supabase.from("ingredient_components").select("id").eq("ingredient_reference_id", ingredientId).limit(1),
    supabase.from("product_recipe_items").select("id").eq("ingredient_source_id", ingredientId).limit(1),
  ]);

  const ingredient = assertSupabaseResult(
    { data: ingredientResult.data, error: ingredientResult.error },
    "Failed to load ingredient external code",
  );
  const currentExternalCode = ingredient?.external_code ?? null;

  if (currentExternalCode === nextExternalCode) {
    return;
  }

  const hasUsage =
    assertSupabaseResult(componentUsageResult, "Failed to load ingredient component usage").length > 0 ||
    assertSupabaseResult(recipeUsageResult, "Failed to load ingredient recipe usage").length > 0;

  if (hasUsage) {
    throw new Error("O código ERP não pode ser alterado após o ingrediente entrar em movimentação.");
  }
}

async function assertProductExternalCodeEditable(
  productId: string,
  nextExternalCode: string | null,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const [productResult, recipeUsageResult, componentUsageResult, orderUsageResult] = await Promise.all([
    supabase.from("products").select("external_code").eq("id", productId).maybeSingle(),
    supabase.from("product_recipe_items").select("id").eq("product_source_id", productId).limit(1),
    supabase.from("ingredient_components").select("id").eq("product_reference_id", productId).limit(1),
    supabase.from("store_order_items").select("id").eq("product_id", productId).limit(1),
  ]);

  const product = assertSupabaseResult(
    { data: productResult.data, error: productResult.error },
    "Failed to load product external code",
  );
  const currentExternalCode = product?.external_code ?? null;

  if (currentExternalCode === nextExternalCode) {
    return;
  }

  const hasUsage =
    assertSupabaseResult(recipeUsageResult, "Failed to load product recipe usage").length > 0 ||
    assertSupabaseResult(componentUsageResult, "Failed to load product component usage").length > 0 ||
    assertSupabaseResult(orderUsageResult, "Failed to load product order usage").length > 0;

  if (hasUsage) {
    throw new Error("O código ERP não pode ser alterado após o produto entrar em movimentação.");
  }
}

export async function createIngredient(input: IngredientInput, options: MutationOptions = {}) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const existingCodesResult = await supabase.from("ingredients").select("code");
  const existingCodes = assertSupabaseResult(existingCodesResult, "Failed to load ingredient codes");
  const code = input.code?.trim() || buildNextCode(existingCodes.map((row) => row.code), "IN", 6);
  const legacyId = buildGeneratedLegacyId("ingredient");
  const externalCode = normalizeOptionalCode(input.externalCode);
  await assertExternalCodeAvailable("ingredients", externalCode, undefined, supabase);

  const insertResult = await supabase
    .from("ingredients")
    .insert({
      legacy_id: legacyId,
      code,
      external_code: externalCode,
      name: input.name.trim(),
      short_name: normalizeOptionalText(input.shortName),
      type: input.type,
      unit: input.unit,
      purchase_unit: input.purchaseUnit ?? input.unit,
      purchase_to_consumption_factor:
        Number.isFinite(input.purchaseToConsumptionFactor) && Number(input.purchaseToConsumptionFactor) > 0
          ? Number(input.purchaseToConsumptionFactor)
          : 1,
      metadata: input.metadata.trim(),
      observation: input.observation.trim(),
      status: input.status ?? "ativo",
    })
    .select("id")
    .single();

  const ingredient = assertSupabaseResult(insertResult, "Failed to create ingredient");
  await replaceIngredientComponents(
    ingredient.id,
    input.type === "misturado" ? input.composition : [],
    supabase,
  );

  return {
    id: legacyId,
    code,
  };
}

export async function updateIngredient(
  identifier: string,
  input: IngredientInput,
  options: MutationOptions = {},
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const row = await resolveRowByIdentifier("ingredients", identifier, supabase);
  const ingredientId = String(row.id);
  const externalCode = normalizeOptionalCode(input.externalCode);
  await assertIngredientExternalCodeEditable(ingredientId, externalCode, supabase);
  await assertExternalCodeAvailable("ingredients", externalCode, ingredientId, supabase);

  const result = await supabase
    .from("ingredients")
    .update({
      external_code: externalCode,
      name: input.name.trim(),
      short_name: normalizeOptionalText(input.shortName),
      type: input.type,
      unit: input.unit,
      purchase_unit: input.purchaseUnit ?? input.unit,
      purchase_to_consumption_factor:
        Number.isFinite(input.purchaseToConsumptionFactor) && Number(input.purchaseToConsumptionFactor) > 0
          ? Number(input.purchaseToConsumptionFactor)
          : 1,
      metadata: input.metadata.trim(),
      observation: input.observation.trim(),
      status: input.status ?? "ativo",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ingredientId);

  if (result.error) {
    throw new Error(`Failed to update ingredient: ${result.error.message}`);
  }

  await replaceIngredientComponents(
    ingredientId,
    input.type === "misturado" ? input.composition : [],
    supabase,
  );
}

async function replaceProductRecipeItems(
  productId: string,
  recipe: RecipeIngredientReference[],
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const deleteResult = await supabase.from("product_recipe_items").delete().eq("product_id", productId);

  if (deleteResult.error) {
    throw new Error(`Failed to reset product recipe: ${deleteResult.error.message}`);
  }

  if (recipe.length === 0) {
    return;
  }

  const rows = await Promise.all(
    recipe.map(async (item, index) => ({
      product_id: productId,
      source_type: item.sourceType,
      ingredient_source_id:
        item.sourceType === "ingrediente" ? await resolveIngredientId(item.sourceId, supabase) : null,
      product_source_id:
        item.sourceType === "produto" ? await resolveProductId(item.sourceId, supabase) : null,
      label: item.label,
      quantity: item.quantity,
      unit: item.unit,
      sort_order: index,
      observation: item.observation ?? "",
    })),
  );

  const insertResult = await supabase.from("product_recipe_items").insert(rows);
  if (insertResult.error) {
    throw new Error(`Failed to save product recipe: ${insertResult.error.message}`);
  }
}

async function replaceProductPreparationSteps(
  productId: string,
  preparationStages: ProductPreparationStageKey[],
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const deleteResult = await supabase
    .from("product_preparation_steps")
    .delete()
    .eq("product_id", productId);

  if (deleteResult.error) {
    throw new Error(`Failed to reset product preparation steps: ${deleteResult.error.message}`);
  }

  const normalizedStages = normalizeProductPreparationStages(preparationStages);
  if (normalizedStages.length === 0) {
    return;
  }

  const insertResult = await supabase.from("product_preparation_steps").insert(
    normalizedStages.map((stageKey, index) => ({
      product_id: productId,
      stage_key: stageKey,
      sort_order: index,
    })),
  );

  if (insertResult.error) {
    throw new Error(`Failed to save product preparation steps: ${insertResult.error.message}`);
  }
}

function normalizeProductPayload(input: ProductInput) {
  return {
    external_code: normalizeOptionalCode(input.externalCode),
    name: input.name.trim(),
    short_name: normalizeOptionalText(input.shortName),
    description: input.description.trim(),
    active: input.active,
    available_for_ordering: input.availableForOrdering,
    validity_days: input.validityDays,
    minimum_production_kg: input.minimumProductionKg,
    economic_production_kg: input.economicProductionKg,
    allows_storage: input.allowsStorage,
    production_days: input.productionDays,
    sale_lead_days:
      Number.isFinite(input.saleLeadDays) && Number(input.saleLeadDays) > 0
        ? Number(input.saleLeadDays)
        : 1,
    expedition_lead_days:
      input.expeditionLeadDays != null && Number.isFinite(input.expeditionLeadDays) && Number(input.expeditionLeadDays) >= 0
        ? Number(input.expeditionLeadDays)
        : null,
    unit_profiles: input.unitProfiles,
    packaging_profile: input.isSoldLoose ? null : input.packagingProfile ?? null,
    is_sold_loose: input.isSoldLoose,
    preparation_mode: input.preparationMode.trim(),
    break_percent: input.breakPercent,
    break_stage: input.breakStage,
    break_comment: input.breakComment.trim(),
    can_be_ingredient: input.canBeIngredient,
    ingredient_profile: input.canBeIngredient
      ? {
          ...(input.ingredientProfile ?? {}),
          purchaseUnit: input.ingredientProfile?.purchaseUnit ?? input.ingredientProfile?.unit ?? "Kg",
          purchaseToConsumptionFactor:
            Number.isFinite(input.ingredientProfile?.purchaseToConsumptionFactor) &&
            Number(input.ingredientProfile?.purchaseToConsumptionFactor) > 0
              ? Number(input.ingredientProfile?.purchaseToConsumptionFactor)
              : 1,
        }
      : null,
    weight_label: input.weight,
    production_unit: input.productionUnit,
    sales_unit: input.salesUnit,
    sales_to_kg_factor: input.salesToKgFactor,
    expedition_unit: input.expeditionUnit,
    expedition_to_kg_factor: input.expeditionToKgFactor,
    is_mpi_ingredient: input.isMpiIngredient,
  };
}

function buildScheduleRevisionName(subcategoryName: string, activeScheduleName?: string | null) {
  if (activeScheduleName?.trim()) {
    return activeScheduleName.trim();
  }

  return `Linha ${subcategoryName.trim()}`;
}

async function rebuildPendingScheduleRevisionForSubcategoryDbId(
  subcategoryId: string,
  options: MutationOptions = {},
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const actingProfileDbId = options.actingProfileId
    ? await resolveProfileDbId(options.actingProfileId, supabase)
    : null;
  const timestamp = new Date().toISOString();
  const [
    subcategoryResult,
    existingCodesResult,
    activeScheduleResult,
    pendingSchedulesResult,
    productsResult,
  ] = await Promise.all([
    supabase
      .from("subcategories")
      .select("id, name")
      .eq("id", subcategoryId)
      .maybeSingle(),
    supabase.from("schedule_lines").select("code"),
    supabase
      .from("schedule_lines")
      .select("id, name")
      .eq("subcategory_id", subcategoryId)
      .eq("status", "ativo")
      .order("audited_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("schedule_lines")
      .select("id, created_at")
      .eq("subcategory_id", subcategoryId)
      .eq("status", "pendente"),
    supabase
      .from("products")
      .select("id, code, minimum_production_kg, production_days")
      .eq("operational_subcategory_id", subcategoryId)
      .eq("active", true)
      .order("code", { ascending: true }),
  ]);

  const subcategory = assertSupabaseResult(
    { data: subcategoryResult.data, error: subcategoryResult.error },
    "Failed to load subcategory for schedule revision",
  );
  const existingCodes = assertSupabaseResult(existingCodesResult, "Failed to load schedule codes");
  const activeSchedule = activeScheduleResult.error ? null : activeScheduleResult.data;
  const pendingSchedules = assertSupabaseResult(
    pendingSchedulesResult,
    "Failed to load pending schedule revisions",
  );
  const products = assertSupabaseResult(
    productsResult,
    "Failed to load operational products for schedule revision",
  );
  const prioritySourceScheduleId =
    [...pendingSchedules]
      .sort((left, right) => right.created_at.localeCompare(left.created_at))[0]?.id ??
    activeSchedule?.id ??
    null;
  const prioritySourceItemsByProductId = new Map<string, Partial<Record<ProductionWeekDay, number>>>();

  if (prioritySourceScheduleId) {
    const sourceItemsResult = await supabase
      .from("schedule_line_item_snapshots")
      .select("product_id, production_days, day_priorities")
      .eq("schedule_line_id", prioritySourceScheduleId);
    const sourceItems = assertSupabaseResult(
      sourceItemsResult,
      "Failed to load schedule priorities for pending revision",
    );

    sourceItems.forEach((item) => {
      prioritySourceItemsByProductId.set(
        item.product_id,
        normalizeScheduleDayPriorities(
          typeof item.day_priorities === "object" && item.day_priorities !== null
            ? (item.day_priorities as Partial<Record<ProductionWeekDay, number>>)
            : undefined,
          (item.production_days ?? []) as ProductionWeekDay[],
        ),
      );
    });
  }

  if (pendingSchedules.length > 0) {
    const deleteResult = await supabase
      .from("schedule_lines")
      .delete()
      .in("id", pendingSchedules.map((row) => row.id));

    if (deleteResult.error) {
      throw new Error(`Failed to reset pending schedule revisions: ${deleteResult.error.message}`);
    }
  }

  const insertScheduleResult = await supabase
    .from("schedule_lines")
    .insert({
      legacy_id: buildGeneratedLegacyId("schedule"),
      code: buildNextCode(existingCodes.map((row) => row.code), "SL", 4),
      name: buildScheduleRevisionName(subcategory.name, activeSchedule?.name),
      subcategory_id: subcategoryId,
      revision_of_id: activeSchedule?.id ?? null,
      status: "pendente",
      created_at: timestamp,
      created_by_profile_id: actingProfileDbId,
      audited_at: null,
      audited_by_profile_id: null,
      audit_notes: null,
      deactivated_at: null,
      deactivated_by_profile_id: null,
    })
    .select("id")
    .single();

  const scheduleRevision = assertSupabaseResult(
    insertScheduleResult,
    "Failed to create pending schedule revision",
  );

  if (products.length > 0) {
    const fallbackDayPriorities = buildDefaultScheduleDayPriorities(
      products.map((product) => ({
        productionDays: (product.production_days ?? []) as ProductionWeekDay[],
      })),
    );

    const insertItemsResult = await supabase.from("schedule_line_item_snapshots").insert(
      products.map((product, index) => {
        const productionDays = (product.production_days ?? []) as ProductionWeekDay[];

        return {
          schedule_line_id: scheduleRevision.id,
          product_id: product.id,
          minimum_production: Number(product.minimum_production_kg),
          production_days: productionDays,
          day_priorities: normalizeScheduleDayPriorities(
            prioritySourceItemsByProductId.get(product.id),
            productionDays,
            fallbackDayPriorities[index],
          ),
        };
      }),
    );

    if (insertItemsResult.error) {
      throw new Error(`Failed to save pending schedule revision items: ${insertItemsResult.error.message}`);
    }
  }

  if (activeSchedule?.id) {
    const deactivateActiveResult = await supabase
      .from("schedule_lines")
      .update({
        status: "inativo",
        deactivated_at: timestamp,
        deactivated_by_profile_id: actingProfileDbId,
      })
      .eq("id", activeSchedule.id)
      .eq("status", "ativo");

    if (deactivateActiveResult.error) {
      throw new Error(
        `Failed to deactivate active schedule while awaiting audit: ${deactivateActiveResult.error.message}`,
      );
    }
  }
}

export async function assignProductToOperationalSubcategory(
  subcategoryIdentifier: string,
  productIdentifier: string,
  options: MutationOptions = {},
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const targetSubcategoryId = await resolveSubcategoryId(subcategoryIdentifier, supabase);
  const productRow = await resolveRowByIdentifier("products", productIdentifier, supabase);
  const productMasterSubcategoryId = productRow.subcategory_id ? String(productRow.subcategory_id) : null;

  if (!Boolean(productRow.active)) {
    throw new Error("Somente produtos ativos podem entrar na carteira operacional.");
  }

  if (productMasterSubcategoryId !== targetSubcategoryId) {
    throw new Error(
      "Somente produtos cadastrados nesta linha de produção podem entrar no cronograma ativo. Para realocar, edite o cadastro do produto.",
    );
  }

  const productId = String(productRow.id);
  const previousOperationalSubcategoryId = productRow.operational_subcategory_id
    ? String(productRow.operational_subcategory_id)
    : null;

  if (previousOperationalSubcategoryId === targetSubcategoryId) {
    return;
  }

  const updateResult = await supabase
    .from("products")
    .update({
      operational_subcategory_id: targetSubcategoryId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);

  if (updateResult.error) {
    throw new Error(`Failed to assign operational subcategory: ${updateResult.error.message}`);
  }

  const affectedSubcategoryIds = [
    ...new Set(
      [previousOperationalSubcategoryId, targetSubcategoryId].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ];

  for (const affectedSubcategoryId of affectedSubcategoryIds) {
    await rebuildPendingScheduleRevisionForSubcategoryDbId(affectedSubcategoryId, {
      supabase,
      actingProfileId: options.actingProfileId,
    });
  }
}

export async function removeProductFromOperationalSubcategory(
  subcategoryIdentifier: string,
  productIdentifier: string,
  options: MutationOptions = {},
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const sourceSubcategoryId = await resolveSubcategoryId(subcategoryIdentifier, supabase);
  const productRow = await resolveRowByIdentifier("products", productIdentifier, supabase);
  const productId = String(productRow.id);
  const currentOperationalSubcategoryId = productRow.operational_subcategory_id
    ? String(productRow.operational_subcategory_id)
    : null;

  if (currentOperationalSubcategoryId !== sourceSubcategoryId) {
    throw new Error("O produto não está vinculado operacionalmente a esta linha de produção.");
  }

  const updateResult = await supabase
    .from("products")
    .update({
      operational_subcategory_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);

  if (updateResult.error) {
    throw new Error(`Failed to remove operational subcategory: ${updateResult.error.message}`);
  }

  await rebuildPendingScheduleRevisionForSubcategoryDbId(sourceSubcategoryId, {
    supabase,
    actingProfileId: options.actingProfileId,
  });
}

export async function createProduct(input: ProductInput, options: MutationOptions = {}) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const existingCodesResult = await supabase.from("products").select("code");
  const existingCodes = assertSupabaseResult(existingCodesResult, "Failed to load product codes");
  const subcategoryId = await resolveSubcategoryId(input.lineId, supabase);
  const code = input.code?.trim() || buildNextCode(existingCodes.map((row) => row.code), "PR", 5);
  const legacyId = buildGeneratedLegacyId("product");
  await assertExternalCodeAvailable("products", normalizeOptionalCode(input.externalCode), undefined, supabase);

  const insertResult = await supabase
    .from("products")
    .insert({
      legacy_id: legacyId,
      code,
      subcategory_id: subcategoryId,
      // New products start outside the operational portfolio until a subcategory
      // explicitly adds them to the audited schedule.
      operational_subcategory_id: null,
      ...normalizeProductPayload(input),
    })
    .select("id")
    .single();

  const product = assertSupabaseResult(insertResult, "Failed to create product");
  await replaceProductRecipeItems(product.id, input.recipe, supabase);
  await replaceProductPreparationSteps(product.id, input.preparationStages, supabase);

  return {
    id: legacyId,
    code,
  };
}

export async function updateProduct(
  identifier: string,
  input: ProductInput,
  options: MutationOptions = {},
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const row = await resolveRowByIdentifier("products", identifier, supabase);
  const productId = String(row.id);
  const subcategoryId = await resolveSubcategoryId(input.lineId, supabase);
  const currentSubcategoryId = row.subcategory_id ? String(row.subcategory_id) : null;
  const operationalSubcategoryId = row.operational_subcategory_id ? String(row.operational_subcategory_id) : null;
  const externalCode = normalizeOptionalCode(input.externalCode);
  let nextOperationalSubcategoryId = operationalSubcategoryId;

  if (currentSubcategoryId !== subcategoryId) {
    nextOperationalSubcategoryId = operationalSubcategoryId ? subcategoryId : null;
  }

  await assertProductExternalCodeEditable(productId, externalCode, supabase);
  await assertExternalCodeAvailable("products", externalCode, productId, supabase);

  const result = await supabase
    .from("products")
    .update({
      subcategory_id: subcategoryId,
      operational_subcategory_id: nextOperationalSubcategoryId,
      ...normalizeProductPayload(input),
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);

  if (result.error) {
    throw new Error(`Failed to update product: ${result.error.message}`);
  }

  await replaceProductRecipeItems(String(row.id), input.recipe, supabase);
  await replaceProductPreparationSteps(String(row.id), input.preparationStages, supabase);

  // Record changelog entry if a change description was provided
  if (input.changeDescription?.trim()) {
    const versionResult = await supabase
      .from("product_changelog")
      .select("version_number")
      .eq("product_id", productId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = ((versionResult.data as { version_number: number } | null)?.version_number ?? 0) + 1;
    const actingProfileName = options.actingProfileId
      ? ((await supabase.from("profiles").select("name").eq("id", options.actingProfileId).maybeSingle()).data as { name: string } | null)?.name ?? ""
      : "";

    await supabase.from("product_changelog").insert({
      tenant_id: row.tenant_id,
      product_id: productId,
      version_number: nextVersion,
      change_description: input.changeDescription.trim(),
      changed_by_profile_id: options.actingProfileId ?? null,
      changed_by_name: actingProfileName,
      snapshot_data: { name: input.name, description: input.description },
    });
  }

  const affectedOperationalSubcategoryIds = [
    ...new Set(
      [operationalSubcategoryId, nextOperationalSubcategoryId].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ];

  for (const affectedOperationalSubcategoryId of affectedOperationalSubcategoryIds) {
    await rebuildPendingScheduleRevisionForSubcategoryDbId(affectedOperationalSubcategoryId, {
      supabase,
      actingProfileId: options.actingProfileId,
    });
  }
}

export async function cloneProduct(
  identifier: string,
  options: MutationOptions = {},
): Promise<{ id: string; code: string }> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const row = await resolveRowByIdentifier("products", identifier, supabase);

  // Generate new code
  const existingCodesResult = await supabase.from("products").select("code");
  const existingCodes = assertSupabaseResult(existingCodesResult, "Failed to load product codes");
  const code = buildNextCode(existingCodes.map((r) => r.code), "PR", 5);
  const legacyId = buildGeneratedLegacyId("product");

  // Copy product (all columns except id, code, legacy_id, external_code, timestamps)
  const insertResult = await supabase
    .from("products")
    .insert({
      legacy_id: legacyId,
      code,
      name: `[Cópia] ${row.name}`,
      description: row.description,
      short_name: row.short_name,
      subcategory_id: row.subcategory_id,
      operational_subcategory_id: null,
      external_code: null,
      active: false,
      available_for_ordering: false,
      validity_days: row.validity_days,
      minimum_production_kg: row.minimum_production_kg,
      economic_production_kg: row.economic_production_kg,
      allows_storage: row.allows_storage,
      production_days: row.production_days,
      sale_lead_days: row.sale_lead_days,
      expedition_lead_days: (row as Record<string, unknown>).expedition_lead_days as number | null ?? null,
      unit_profiles: row.unit_profiles,
      packaging_profile: row.packaging_profile,
      is_sold_loose: row.is_sold_loose,
      preparation_mode: row.preparation_mode,
      break_percent: row.break_percent,
      break_stage: row.break_stage,
      break_comment: row.break_comment,
      can_be_ingredient: row.can_be_ingredient,
      ingredient_profile: row.ingredient_profile,
      is_mpi_ingredient: row.is_mpi_ingredient,
      weight_label: row.weight_label,
      production_unit: row.production_unit,
      sales_unit: row.sales_unit,
      sales_to_kg_factor: row.sales_to_kg_factor,
      expedition_unit: row.expedition_unit,
      expedition_to_kg_factor: row.expedition_to_kg_factor,
      tenant_id: row.tenant_id,
    })
    .select("id")
    .single();

  const cloned = assertSupabaseResult(insertResult, "Failed to clone product");

  // Copy recipe items
  const recipeResult = await supabase
    .from("product_recipe_items")
    .select("*")
    .eq("product_id", row.id);
  const recipeRows = assertSupabaseResult(recipeResult, "Failed to load recipe items for cloning");

  if (recipeRows.length > 0) {
    const clonedRecipeItems = recipeRows.map((item) => ({
      product_id: cloned.id,
      source_type: item.source_type,
      ingredient_source_id: item.ingredient_source_id,
      product_source_id: item.product_source_id,
      label: item.label,
      quantity: item.quantity,
      unit: item.unit,
      sort_order: item.sort_order,
      tenant_id: item.tenant_id,
    }));
    const insertRecipeResult = await supabase.from("product_recipe_items").insert(clonedRecipeItems);
    if (insertRecipeResult.error) {
      throw new Error(`Failed to clone recipe items: ${insertRecipeResult.error.message}`);
    }
  }

  // Copy preparation steps
  const stepsResult = await supabase
    .from("product_preparation_steps")
    .select("*")
    .eq("product_id", row.id);
  const stepRows = stepsResult.data ?? [];

  if (stepRows.length > 0) {
    const clonedSteps = stepRows.map((step) => ({
      product_id: cloned.id,
      stage_key: step.stage_key,
      sort_order: step.sort_order,
      tenant_id: step.tenant_id,
    }));
    await supabase.from("product_preparation_steps").insert(clonedSteps);
  }

  return { id: legacyId, code };
}

export async function updateScheduleLineStatus(
  identifier: string,
  input: {
    status: "pendente" | "ativo" | "inativo";
    auditNotes?: string;
    dayPrioritiesByItemId?: Record<string, Partial<Record<ProductionWeekDay, number>>>;
  },
  options: MutationOptions = {},
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const actingProfileDbId = options.actingProfileId
    ? await resolveProfileDbId(options.actingProfileId, supabase)
    : null;
  const row = await resolveRowByIdentifier("schedule_lines", identifier, supabase);
  const scheduleId = String(row.id);
  const subcategoryId = String(row.subcategory_id);
  const timestamp = new Date().toISOString();

  if (input.dayPrioritiesByItemId) {
    const scheduleItemsResult = await supabase
      .from("schedule_line_item_snapshots")
      .select("id, production_days")
      .eq("schedule_line_id", scheduleId);
    const scheduleItems = assertSupabaseResult(
      scheduleItemsResult,
      "Failed to load schedule items for priority update",
    );

    const priorityUpdates = await Promise.all(
      scheduleItems.map((item) =>
        supabase
          .from("schedule_line_item_snapshots")
          .update({
            day_priorities: normalizeScheduleDayPriorities(
              input.dayPrioritiesByItemId?.[item.id],
              (item.production_days ?? []) as ProductionWeekDay[],
            ),
          })
          .eq("id", item.id)
          .eq("schedule_line_id", scheduleId),
      ),
    );

    const priorityError = priorityUpdates.find((result) => result.error)?.error;
    if (priorityError) {
      throw new Error(`Failed to update schedule priorities: ${priorityError.message}`);
    }
  }

  if (input.status === "ativo") {
    const deactivateOthersResult = await supabase
      .from("schedule_lines")
      .update({
        status: "inativo",
        deactivated_at: timestamp,
        deactivated_by_profile_id: actingProfileDbId,
      })
      .eq("subcategory_id", subcategoryId)
      .eq("status", "ativo")
      .neq("id", scheduleId);

    if (deactivateOthersResult.error) {
      throw new Error(`Failed to deactivate previous schedule revisions: ${deactivateOthersResult.error.message}`);
    }
  }

  const payload: Record<string, unknown> = {
    status: input.status,
    audit_notes: input.auditNotes?.trim() || null,
  };

  if (input.status === "ativo") {
    payload.audited_at = timestamp;
    payload.audited_by_profile_id = actingProfileDbId;
    payload.deactivated_at = null;
    payload.deactivated_by_profile_id = null;
  }

  if (input.status === "inativo") {
    payload.deactivated_at = timestamp;
    payload.deactivated_by_profile_id = actingProfileDbId;
  }

  const result = await supabase.from("schedule_lines").update(payload).eq("id", scheduleId);

  if (result.error) {
    throw new Error(`Failed to update schedule line: ${result.error.message}`);
  }
}
