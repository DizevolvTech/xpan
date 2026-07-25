import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCachedServerData } from "@/lib/server-data-cache";
import {
  assertSupabaseResult,
  assertTenantId,
  buildTenantCacheKey,
  isSupabaseMissingSchemaError,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";
import type {
  IngredientCompositionItem,
  IngredientProfileMirror,
  OperationalSettings,
  PackagingProfile,
  ProductUnitProfile,
  ProductionIngredient,
  ProductionLine,
  ProductionProduct,
  ProductionSector,
  StoreMasterData,
  WeeklyProductionSchedule,
  WeeklyScheduleItem,
} from "@/lib/production-planning";
import { normalizeRecipeStage, normalizeRecipeStageConfig } from "@/lib/production-planning";
import { normalizeScheduleDayPriorities } from "@/lib/production-data-utils";
import { normalizeProductPreparationStages } from "@/lib/production-workflow";
import {
  reduceLatestChangelogByProduct,
  type ProductChangelogRow,
  type ProductChangelogSummary,
} from "@/lib/supabase-data/master-data-changelog";

export interface MasterDataSnapshot {
  operationalSettings: OperationalSettings;
  sectors: ProductionSector[];
  lines: ProductionLine[];
  ingredients: ProductionIngredient[];
  stores: StoreMasterData[];
  products: ProductionProduct[];
  schedules: WeeklyProductionSchedule[];
  /**
   * A6: última edição (motivo + campos alterados) por produto, derivada de
   * `product_changelog`. Só é populado quando `includeProductChangelog` é true
   * (personas não-loja). Ausente para tenants sem a migration de changelog.
   */
  productChangelogByProductId?: Record<string, ProductChangelogSummary>;
}

type MasterDataSnapshotOptions = {
  supabase?: SupabaseDataClient;
  includeProfileNames?: boolean;
  /**
   * A6: quando true, embute em `productChangelogByProductId` a última edição de
   * cada produto (motivo + campos alterados) lida de `product_changelog`. Mantido
   * desligado para a persona loja (não deve ver o histórico de alterações).
   */
  includeProductChangelog?: boolean;
  tenantId?: string | null;
  /**
   * AJ-0024: força recarga ignorando o cache (TTL 15s). Caminhos de escrita de
   * pedido usam isso para validar contra dados frescos logo após o cronograma
   * virar ativo (evita o "1º salvamento com 0 itens").
   */
  forceRefresh?: boolean;
};

const MASTER_DATA_CACHE_TTL_MS = 15_000;

function coerceUnitProfile(value: unknown): ProductUnitProfile {
  const record = (value ?? {}) as Record<string, unknown>;

  return {
    unit: String(record.unit ?? "Kg") as ProductUnitProfile["unit"],
    description: String(record.description ?? ""),
    weightKg: Number(record.weightKg ?? 1),
  };
}

function coercePackagingProfile(value: unknown): PackagingProfile | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  return {
    unit: String(record.unit ?? "Pacote") as PackagingProfile["unit"],
    description: String(record.description ?? ""),
    weightKg: Number(record.weightKg ?? 0),
    quantityPerPackage: Number(record.quantityPerPackage ?? 0),
  };
}

function coerceIngredientProfile(value: unknown): IngredientProfileMirror | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  return {
    unit: String(record.unit ?? "Kg") as IngredientProfileMirror["unit"],
    weightKg: Number(record.weightKg ?? 1),
    purchaseUnit: String(record.purchaseUnit ?? record.unit ?? "Kg") as IngredientProfileMirror["purchaseUnit"],
    purchaseToConsumptionFactor: Number(record.purchaseToConsumptionFactor ?? 1),
    metadata: String(record.metadata ?? ""),
    observation: String(record.observation ?? ""),
  };
}

async function loadMasterDataSnapshot(
  options: MasterDataSnapshotOptions = {},
): Promise<MasterDataSnapshot> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const includeProfileNames = options.includeProfileNames ?? true;
  const includeProductChangelog = options.includeProductChangelog ?? false;
  const tenantId = assertTenantId(options.tenantId);

  const [
    operationalSettingsResult,
    sectorsResult,
    linesResult,
    ingredientsResult,
    ingredientComponentsResult,
    storesResult,
    productsResult,
    recipeItemsResult,
    preparationStepsResult,
    profilesResult,
    schedulesResult,
    scheduleSnapshotsResult,
    productChangelogResult,
  ] = await Promise.all([
    supabase
      .from("operational_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from("categories").select("*").eq("tenant_id", tenantId).order("code", { ascending: true }),
    supabase.from("subcategories").select("*").eq("tenant_id", tenantId).order("code", { ascending: true }),
    supabase.from("ingredients").select("*").eq("tenant_id", tenantId).order("code", { ascending: true }),
    supabase
      .from("ingredient_components")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true }),
    supabase.from("stores").select("*").eq("tenant_id", tenantId).order("code", { ascending: true }),
    supabase.from("products").select("*").eq("tenant_id", tenantId).order("code", { ascending: true }),
    supabase
      .from("product_recipe_items")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_preparation_steps")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true }),
    includeProfileNames
      ? supabase
          .from("profiles")
          .select("id, legacy_id, name, role, status")
          .eq("tenant_id", tenantId)
          .order("name", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("schedule_lines").select("*").eq("tenant_id", tenantId).order("code", { ascending: true }),
    supabase
      .from("schedule_line_item_snapshots")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
    includeProductChangelog
      ? supabase
          .from("product_changelog")
          .select(
            "product_id, version_number, change_description, changed_by_name, created_at, snapshot_data",
          )
          .eq("tenant_id", tenantId)
          .order("product_id", { ascending: true })
          .order("version_number", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const settingsRow = assertSupabaseResult(
    { data: operationalSettingsResult.data, error: operationalSettingsResult.error },
    "Failed to load operational settings",
  );
  const sectorRows = assertSupabaseResult(sectorsResult, "Failed to load categories");
  const lineRows = assertSupabaseResult(linesResult, "Failed to load subcategories");
  const ingredientRows = assertSupabaseResult(ingredientsResult, "Failed to load ingredients");
  const ingredientComponentRows = assertSupabaseResult(
    ingredientComponentsResult,
    "Failed to load ingredient components",
  );
  const storeRows = assertSupabaseResult(storesResult, "Failed to load stores");
  const productRows = assertSupabaseResult(productsResult, "Failed to load products");
  const recipeRows = assertSupabaseResult(recipeItemsResult, "Failed to load product recipe items");
  const preparationStepRows = isSupabaseMissingSchemaError(
    preparationStepsResult.error,
    ["product_preparation_steps"],
  )
    ? []
    : assertSupabaseResult(
        preparationStepsResult,
        "Failed to load product preparation steps",
      );
  const profileRows = assertSupabaseResult(
    profilesResult as {
      data: Array<{
        id: string;
        legacy_id: string | null;
        name: string;
        role: string;
        status: string;
      }>;
      error: { message: string } | null;
    },
    "Failed to load profile labels",
  );
  const scheduleRows = assertSupabaseResult(schedulesResult, "Failed to load schedule lines");
  const scheduleSnapshotRows = assertSupabaseResult(
    scheduleSnapshotsResult,
    "Failed to load schedule snapshots",
  );
  // A6: tenants sem a migration de changelog não devem quebrar a carga do snapshot.
  const productChangelogRows = isSupabaseMissingSchemaError(
    (productChangelogResult as { error: { message: string } | null }).error,
    ["product_changelog"],
  )
    ? []
    : (assertSupabaseResult(
        productChangelogResult as {
          data: ProductChangelogRow[];
          error: { message: string } | null;
        },
        "Failed to load product changelog",
      ) as ProductChangelogRow[]);

  const sectors: ProductionSector[] = sectorRows.map((row) => ({
    id: row.legacy_id ?? row.id,
    code: row.code,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    name: row.name,
    responsible: row.responsible,
    status: row.status,
  }));

  const categoryLegacyById = new Map(sectorRows.map((row) => [row.id, row.legacy_id ?? row.id]));

  const lines: ProductionLine[] = lineRows.map((row) => ({
    id: row.legacy_id ?? row.id,
    code: row.code,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    name: row.name,
    sectorId: categoryLegacyById.get(row.category_id) ?? row.category_id,
    type: row.type as ProductionLine["type"],
    operatingHours: row.operating_hours,
    capacityPerDayKg: Number(row.capacity_per_day_kg),
    status: row.status,
  }));

  const ingredientLegacyById = new Map(ingredientRows.map((row) => [row.id, row.legacy_id ?? row.id]));
  const productLegacyById = new Map(productRows.map((row) => [row.id, row.legacy_id ?? row.id]));
  const lineLegacyById = new Map(lineRows.map((row) => [row.id, row.legacy_id ?? row.id]));

  const compositionByIngredientId = ingredientComponentRows.reduce<Map<string, IngredientCompositionItem[]>>(
    (acc, row) => {
      const key = ingredientLegacyById.get(row.ingredient_id) ?? row.ingredient_id;
      const current = acc.get(key) ?? [];
      current.push({
        id: row.id,
        ingredientId: row.ingredient_reference_id
          ? ingredientLegacyById.get(row.ingredient_reference_id) ?? row.ingredient_reference_id
          : undefined,
        productId: row.product_reference_id
          ? productLegacyById.get(row.product_reference_id) ?? row.product_reference_id
          : undefined,
        name: row.name,
        quantity: Number(row.quantity),
        unit: row.unit as IngredientCompositionItem["unit"],
        observation: row.observation,
      });
      acc.set(key, current);
      return acc;
    },
    new Map(),
  );
  const profileById = new Map(profileRows.map((row) => [row.id, row]));

  const ingredients: ProductionIngredient[] = ingredientRows.map((row) => ({
    id: row.legacy_id ?? row.id,
    code: row.code,
    externalCode: row.external_code ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    name: row.name,
    shortName: row.short_name ?? undefined,
    type: row.type,
    unit: row.unit as ProductionIngredient["unit"],
    purchaseUnit: (row.purchase_unit ?? row.unit) as ProductionIngredient["purchaseUnit"],
    purchaseToConsumptionFactor: Number(row.purchase_to_consumption_factor ?? 1),
    metadata: row.metadata,
    observation: row.observation,
    composition: compositionByIngredientId.get(row.legacy_id ?? row.id) ?? [],
    status: row.status,
  }));

  const stores: StoreMasterData[] = storeRows.map((row) => ({
    id: row.legacy_id ?? row.id,
    code: row.code,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    name: row.name,
    responsible:
      row.responsible_profile_id
        ? profileById.get(row.responsible_profile_id)?.name ?? row.responsible
        : row.responsible,
    responsibleProfileId: row.responsible_profile_id
      ? profileById.get(row.responsible_profile_id)?.legacy_id ?? row.responsible_profile_id
      : null,
    email: row.email,
    phone: row.phone,
    status: row.status,
    receiveWindow: row.receive_window,
    orderingDays: (row.ordering_days ?? []) as StoreMasterData["orderingDays"],
    receivingDays: (row.receiving_days ?? []) as StoreMasterData["receivingDays"],
    orderingBlockedDays: (row.ordering_blocked_days ?? []) as StoreMasterData["orderingBlockedDays"],
    receivingBlockedDays: (row.receiving_blocked_days ?? []) as StoreMasterData["receivingBlockedDays"],
    deliveryZone: (row as { delivery_zone?: string | null }).delivery_zone ?? null,
  }));

  const recipeByProductId = recipeRows.reduce<Map<string, ProductionProduct["recipe"]>>((acc, row) => {
    const key = productLegacyById.get(row.product_id) ?? row.product_id;
    const current = acc.get(key) ?? [];
    current.push({
      id: row.id,
      sourceType: row.source_type,
      sourceId:
        row.source_type === "ingrediente"
          ? ingredientLegacyById.get(row.ingredient_source_id ?? "") ?? row.ingredient_source_id ?? ""
          : productLegacyById.get(row.product_source_id ?? "") ?? row.product_source_id ?? "",
      label: row.label,
      quantity: Number(row.quantity),
      unit: row.unit as ProductionProduct["recipe"][number]["unit"],
      observation: (row as Record<string, unknown>).observation as string ?? "",
      // XPAN-8: ingrediente principal da receita (base p/ derivar capacidade da batida).
      isMain: Boolean((row as Record<string, unknown>).is_main),
      // Etapa/função da linha; ausente (base sem a migration) = massa.
      stage: normalizeRecipeStage((row as Record<string, unknown>).stage),
    });
    acc.set(key, current);
    return acc;
  }, new Map());
  const preparationStagesByProductId = preparationStepRows.reduce<
    Map<string, ProductionProduct["preparationStages"]>
  >((acc, row) => {
    const key = productLegacyById.get(row.product_id) ?? row.product_id;
    const current = acc.get(key) ?? [];
    current.push(row.stage_key);
    acc.set(key, current);
    return acc;
  }, new Map());

  const products: ProductionProduct[] = productRows.map((row) => ({
    id: row.legacy_id ?? row.id,
    code: row.code,
    externalCode: row.external_code ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    name: row.name,
    shortName: row.short_name ?? undefined,
    description: row.description,
    lineId: lineLegacyById.get(row.subcategory_id) ?? row.subcategory_id,
    masterLineId: lineLegacyById.get(row.subcategory_id) ?? row.subcategory_id,
    operationalLineId: row.operational_subcategory_id
      ? lineLegacyById.get(row.operational_subcategory_id) ?? row.operational_subcategory_id
      : undefined,
    active: row.active,
    availableForOrdering: row.available_for_ordering,
    validityDays: row.validity_days,
    minimumProductionKg: Number(row.minimum_production_kg),
    economicProductionKg: Number(row.economic_production_kg),
    capacityPerBatch:
      row.capacity_per_batch === null || row.capacity_per_batch === undefined
        ? null
        : Number(row.capacity_per_batch),
    economicBatchUnit:
      (row.economic_batch_unit as ProductionProduct["economicBatchUnit"]) ?? null,
    // XPAN-8: limite físico (kg) do ingrediente principal por batida. null = manual.
    mainIngredientLimitKg:
      (row as Record<string, unknown>).main_ingredient_limit_kg == null
        ? null
        : Number((row as Record<string, unknown>).main_ingredient_limit_kg),
    allowsStorage: row.allows_storage,
    productionDays: (row.production_days ?? []) as ProductionProduct["productionDays"],
    expeditionLeadDays:
      Number.isFinite(Number(row.expedition_lead_days)) && Number(row.expedition_lead_days) >= 0
        ? Number(row.expedition_lead_days)
        : 1,
    unitProfiles: {
      sales: coerceUnitProfile((row.unit_profiles as Record<string, unknown>).sales),
      production: coerceUnitProfile((row.unit_profiles as Record<string, unknown>).production),
      expedition: coerceUnitProfile((row.unit_profiles as Record<string, unknown>).expedition),
    },
    packagingProfile: coercePackagingProfile(row.packaging_profile),
    isSoldLoose: row.is_sold_loose,
    recipe: recipeByProductId.get(row.legacy_id ?? row.id) ?? [],
    // Sequência das etapas da ficha + modo de preparo de cada bloco. Coluna ausente
    // (base sem a migration 20260725110000) ou JSONB com lixo ⇒ array vazio, que é a
    // ordem canônica do enum e sem instrução por etapa — o comportamento de hoje.
    recipeStageConfig: normalizeRecipeStageConfig(
      (row as Record<string, unknown>).recipe_stage_config,
    ),
    preparationStages: normalizeProductPreparationStages(
      preparationStagesByProductId.get(row.legacy_id ?? row.id),
    ),
    preparationMode: row.preparation_mode,
    breakPercent: Number(row.break_percent),
    breakStage: row.break_stage,
    breakComment: row.break_comment,
    canBeIngredient: row.can_be_ingredient,
    ingredientProfile: coerceIngredientProfile(row.ingredient_profile),
    weight: row.weight_label,
    productionUnit: row.production_unit as ProductionProduct["productionUnit"],
    salesUnit: row.sales_unit as ProductionProduct["salesUnit"],
    salesToKgFactor: Number(row.sales_to_kg_factor),
    expeditionUnit: row.expedition_unit as ProductionProduct["expeditionUnit"],
    expeditionToKgFactor: Number(row.expedition_to_kg_factor),
    isMpiIngredient: row.is_mpi_ingredient,
  }));

  const scheduleItemsByScheduleId = scheduleSnapshotRows.reduce<Map<string, WeeklyScheduleItem[]>>((acc, row) => {
    const key = row.schedule_line_id;
    const current = acc.get(key) ?? [];
    current.push({
      id: row.id,
      productId: productLegacyById.get(row.product_id) ?? row.product_id,
      minimumProduction: Number(row.minimum_production),
      productionDays: (row.production_days ?? []) as WeeklyScheduleItem["productionDays"],
      dayPriorities: normalizeScheduleDayPriorities(
        typeof row.day_priorities === "object" && row.day_priorities !== null
          ? (row.day_priorities as WeeklyScheduleItem["dayPriorities"])
          : undefined,
        (row.production_days ?? []) as WeeklyScheduleItem["productionDays"],
      ),
    });
    acc.set(key, current);
    return acc;
  }, new Map());

  const profileNameById = new Map(profileRows.map((row) => [row.id, row.name]));
  const scheduleLegacyById = new Map(scheduleRows.map((row) => [row.id, row.legacy_id ?? row.id]));

  const schedules: WeeklyProductionSchedule[] = scheduleRows.map((row) => ({
    id: row.legacy_id ?? row.id,
    code: row.code,
    name: row.name,
    lineId: lineLegacyById.get(row.subcategory_id) ?? row.subcategory_id,
    revisionOfId: row.revision_of_id ? scheduleLegacyById.get(row.revision_of_id) ?? row.revision_of_id : undefined,
    status: row.status,
    createdAt: row.created_at,
    createdBy: row.created_by_profile_id ? profileNameById.get(row.created_by_profile_id) ?? row.created_by_profile_id : "",
    auditedAt: row.audited_at ?? undefined,
    auditedBy: row.audited_by_profile_id ? profileNameById.get(row.audited_by_profile_id) ?? row.audited_by_profile_id : undefined,
    auditNotes: row.audit_notes ?? undefined,
    deactivatedAt: row.deactivated_at ?? undefined,
    deactivatedBy: row.deactivated_by_profile_id
      ? profileNameById.get(row.deactivated_by_profile_id) ?? row.deactivated_by_profile_id
      : undefined,
    items: scheduleItemsByScheduleId.get(row.id) ?? [],
  }));

  const productChangelogByProductId = includeProductChangelog
    ? reduceLatestChangelogByProduct(productChangelogRows, productLegacyById)
    : undefined;

  return {
    operationalSettings: {
      orderCutoffTime: String(settingsRow.order_cutoff_time).slice(0, 5),
      expeditionLeadDays: settingsRow.expedition_lead_days,
      saleLeadDays:
        (settingsRow as { sale_lead_days?: number | null }).sale_lead_days != null
          ? Number((settingsRow as { sale_lead_days?: number | null }).sale_lead_days)
          : 1,
    },
    sectors,
    lines,
    ingredients,
    stores,
    products,
    schedules,
    ...(productChangelogByProductId ? { productChangelogByProductId } : {}),
  };
}

export async function getMasterDataSnapshot(
  options: MasterDataSnapshotOptions = {},
): Promise<MasterDataSnapshot> {
  const includeProfileNames = options.includeProfileNames ?? true;
  const includeProductChangelog = options.includeProductChangelog ?? false;
  const tenantId = assertTenantId(options.tenantId);
  const cacheKey = buildTenantCacheKey(
    tenantId,
    "master-data",
    includeProfileNames ? "with-profiles" : "without-profiles",
    // A6: segmenta o cache por-tenant para que uma chamada anterior da persona loja
    // (sem changelog) não sirva um snapshot sem changelog ao gestor-fabrica.
    includeProductChangelog ? "with-changelog" : "without-changelog",
  );

  return getCachedServerData(cacheKey, MASTER_DATA_CACHE_TTL_MS, () => loadMasterDataSnapshot(options), {
    forceRefresh: options.forceRefresh,
  });
}
