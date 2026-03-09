import "server-only";

import type {
  IngredientCompositionItem,
  ProductionIngredient,
  ProductionLine,
  ProductionProduct,
  RecipeIngredientReference,
  StoreMasterData,
} from "@/lib/production-planning";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  assertSupabaseResult,
  isUuid,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";

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

export type StoreInput = Omit<StoreMasterData, "id" | "code"> & {
  code?: string;
};

export type IngredientInput = Omit<ProductionIngredient, "id" | "code" | "status"> & {
  code?: string;
  status?: RecordStatus;
};

export type ProductInput = Omit<ProductionProduct, "id" | "code"> & {
  code?: string;
};

type MutationOptions = {
  supabase?: SupabaseDataClient;
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
  table: "categories" | "subcategories" | "stores" | "ingredients" | "products" | "schedule_lines",
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

  const result = await supabase.from("stores").insert({
    legacy_id: buildGeneratedLegacyId("store"),
    code: input.code?.trim() || buildNextCode(existingCodes.map((row) => row.code), "LJ", 3),
    name: input.name.trim(),
    responsible: input.responsible.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    status: input.status,
    receive_window: input.receiveWindow.trim(),
    ordering_days: input.orderingDays,
    receiving_days: input.receivingDays,
  });

  if (result.error) {
    throw new Error(`Failed to create store: ${result.error.message}`);
  }
}

export async function updateStore(
  identifier: string,
  input: StoreInput,
  options: MutationOptions = {},
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const row = await resolveRowByIdentifier("stores", identifier, supabase);

  const result = await supabase
    .from("stores")
    .update({
      name: input.name.trim(),
      responsible: input.responsible.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      status: input.status,
      receive_window: input.receiveWindow.trim(),
      ordering_days: input.orderingDays,
      receiving_days: input.receivingDays,
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(row.id));

  if (result.error) {
    throw new Error(`Failed to update store: ${result.error.message}`);
  }
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

export async function createIngredient(input: IngredientInput, options: MutationOptions = {}) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const existingCodesResult = await supabase.from("ingredients").select("code");
  const existingCodes = assertSupabaseResult(existingCodesResult, "Failed to load ingredient codes");
  const code = input.code?.trim() || buildNextCode(existingCodes.map((row) => row.code), "IN", 6);

  const insertResult = await supabase
    .from("ingredients")
    .insert({
      legacy_id: buildGeneratedLegacyId("ingredient"),
      code,
      name: input.name.trim(),
      type: input.type,
      unit: input.unit,
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
}

export async function updateIngredient(
  identifier: string,
  input: IngredientInput,
  options: MutationOptions = {},
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const row = await resolveRowByIdentifier("ingredients", identifier, supabase);

  const result = await supabase
    .from("ingredients")
    .update({
      name: input.name.trim(),
      type: input.type,
      unit: input.unit,
      metadata: input.metadata.trim(),
      observation: input.observation.trim(),
      status: input.status ?? "ativo",
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(row.id));

  if (result.error) {
    throw new Error(`Failed to update ingredient: ${result.error.message}`);
  }

  await replaceIngredientComponents(
    String(row.id),
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
    })),
  );

  const insertResult = await supabase.from("product_recipe_items").insert(rows);
  if (insertResult.error) {
    throw new Error(`Failed to save product recipe: ${insertResult.error.message}`);
  }
}

function normalizeProductPayload(input: ProductInput) {
  return {
    name: input.name.trim(),
    description: input.description.trim(),
    active: input.active,
    available_for_ordering: input.availableForOrdering,
    validity_days: input.validityDays,
    minimum_production_kg: input.minimumProductionKg,
    economic_production_kg: input.economicProductionKg,
    allows_storage: input.allowsStorage,
    production_days: input.productionDays,
    unit_profiles: input.unitProfiles,
    packaging_profile: input.isSoldLoose ? null : input.packagingProfile ?? null,
    is_sold_loose: input.isSoldLoose,
    preparation_mode: input.preparationMode.trim(),
    break_percent: input.breakPercent,
    break_stage: input.breakStage,
    break_comment: input.breakComment.trim(),
    can_be_ingredient: input.canBeIngredient,
    ingredient_profile: input.canBeIngredient ? input.ingredientProfile ?? null : null,
    weight_label: input.weight,
    production_unit: input.productionUnit,
    sales_unit: input.salesUnit,
    sales_to_kg_factor: input.salesToKgFactor,
    expedition_unit: input.expeditionUnit,
    expedition_to_kg_factor: input.expeditionToKgFactor,
    is_mpi_ingredient: input.isMpiIngredient,
  };
}

export async function createProduct(input: ProductInput, options: MutationOptions = {}) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const existingCodesResult = await supabase.from("products").select("code");
  const existingCodes = assertSupabaseResult(existingCodesResult, "Failed to load product codes");
  const subcategoryId = await resolveSubcategoryId(input.lineId, supabase);
  const code = input.code?.trim() || buildNextCode(existingCodes.map((row) => row.code), "PR", 5);
  const legacyId = buildGeneratedLegacyId("product");

  const insertResult = await supabase
    .from("products")
    .insert({
      legacy_id: legacyId,
      code,
      subcategory_id: subcategoryId,
      ...normalizeProductPayload(input),
    })
    .select("id")
    .single();

  const product = assertSupabaseResult(insertResult, "Failed to create product");
  await replaceProductRecipeItems(product.id, input.recipe, supabase);

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
  const subcategoryId = await resolveSubcategoryId(input.lineId, supabase);

  const result = await supabase
    .from("products")
    .update({
      subcategory_id: subcategoryId,
      ...normalizeProductPayload(input),
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(row.id));

  if (result.error) {
    throw new Error(`Failed to update product: ${result.error.message}`);
  }

  await replaceProductRecipeItems(String(row.id), input.recipe, supabase);
}

export async function updateScheduleLineStatus(
  identifier: string,
  input: {
    status: "pendente" | "ativo" | "inativo";
    auditNotes?: string;
  },
  options: MutationOptions = {},
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const row = await resolveRowByIdentifier("schedule_lines", identifier, supabase);
  const scheduleId = String(row.id);
  const subcategoryId = String(row.subcategory_id);
  const timestamp = new Date().toISOString();

  if (input.status === "ativo") {
    const deactivateOthersResult = await supabase
      .from("schedule_lines")
      .update({
        status: "inativo",
        deactivated_at: timestamp,
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
    payload.deactivated_at = null;
    payload.deactivated_by_profile_id = null;
  }

  if (input.status === "inativo") {
    payload.deactivated_at = timestamp;
  }

  const result = await supabase.from("schedule_lines").update(payload).eq("id", scheduleId);

  if (result.error) {
    throw new Error(`Failed to update schedule line: ${result.error.message}`);
  }
}
