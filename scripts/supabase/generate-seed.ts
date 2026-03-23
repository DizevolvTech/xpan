import {
  operationalSettings,
  productionIngredients,
  productionLines,
  productionProducts,
  productionSectors,
  storesMasterData,
  weeklySchedules,
} from "../../src/lib/production-planning";
import { initialUsers } from "./admin-users-seed";
import { permissionModules } from "../../src/lib/permission-modules";
import {
  buildFactoryPlanningData,
  getBaseDateByCutoff,
  getDeliveryDateByStoreRule,
  productionStageProgress,
  type ProductionItemStatus,
} from "../../src/lib/order-planning";
import type { StoreOrder, StoreProfile } from "../../src/lib/factory-planning/types";

const referenceDate = "2026-03-09";
const seedTenant = {
  legacyId: "tenant-seed",
  slug: "tenant-seed",
  name: "Ecossistema Seed",
} as const;

const storeProfiles: StoreProfile[] = storesMasterData.map((store) => ({
  id: store.id,
  code: store.code,
  name: store.name,
  orderingDays: store.orderingDays,
  receivingDays: store.receivingDays,
  orderingBlockedDays: store.orderingBlockedDays,
  receivingBlockedDays: store.receivingBlockedDays,
  receiveWindow: store.receiveWindow,
}));

const productsById = new Map(productionProducts.map((product) => [product.id, product]));

function buildSeedOrderItem(id: string, productId: string, quantity: number) {
  const product = productsById.get(productId);

  if (!product) {
    throw new Error(`Product not found for seed item ${id}`);
  }

  return {
    id,
    productId,
    quantity,
    unit: product.salesUnit,
  } satisfies StoreOrder["items"][number];
}

const seededStoreOrders: StoreOrder[] = [
  {
    id: "seed-order-001",
    code: "PD-260309-0001",
    storeId: "store-01",
    orderedAt: "2026-03-07T16:42:00Z",
    items: [
      buildSeedOrderItem("seed-order-001-item-1", "product-pao-frances", 220),
      buildSeedOrderItem("seed-order-001-item-2", "product-pudim-mini", 43),
      buildSeedOrderItem("seed-order-001-item-3", "product-coxinha", 60),
    ],
  },
  {
    id: "seed-order-002",
    code: "PD-260309-0002",
    storeId: "store-02",
    orderedAt: "2026-03-08T13:20:00Z",
    items: [
      buildSeedOrderItem("seed-order-002-item-1", "product-pao-forma", 12),
      buildSeedOrderItem("seed-order-002-item-2", "product-brownie", 6),
      buildSeedOrderItem("seed-order-002-item-3", "product-lasanha", 4),
    ],
  },
  {
    id: "seed-order-003",
    code: "PD-260309-0003",
    storeId: "store-03",
    orderedAt: "2026-03-09T10:15:00Z",
    items: [
      buildSeedOrderItem("seed-order-003-item-1", "product-pudim-medio", 14),
      buildSeedOrderItem("seed-order-003-item-2", "product-frango-assado", 10),
      buildSeedOrderItem("seed-order-003-item-3", "product-pao-doce", 48),
    ],
  },
  {
    id: "seed-order-004",
    code: "PD-260309-0004",
    storeId: "store-01",
    orderedAt: "2026-03-08T18:25:00Z",
    items: [
      buildSeedOrderItem("seed-order-004-item-1", "product-pudim-grande", 6),
      buildSeedOrderItem("seed-order-004-item-2", "product-empada-frango", 72),
      buildSeedOrderItem("seed-order-004-item-3", "product-brownie", 3),
    ],
  },
  {
    id: "seed-order-005",
    code: "PD-260309-0005",
    storeId: "store-02",
    orderedAt: "2026-03-08T17:55:00Z",
    items: [
      buildSeedOrderItem("seed-order-005-item-1", "product-pao-frances", 300),
      buildSeedOrderItem("seed-order-005-item-2", "product-frango-assado", 8),
      buildSeedOrderItem("seed-order-005-item-3", "product-empada-frango", 90),
    ],
  },
  {
    id: "seed-order-006",
    code: "PD-260309-0006",
    storeId: "store-03",
    orderedAt: "2026-03-06T14:10:00Z",
    items: [
      buildSeedOrderItem("seed-order-006-item-1", "product-lasanha", 3),
      buildSeedOrderItem("seed-order-006-item-2", "product-pao-forma", 10),
      buildSeedOrderItem("seed-order-006-item-3", "product-coxinha", 80),
    ],
  },
  {
    id: "seed-order-007",
    code: "PD-260309-0007",
    storeId: "store-02",
    orderedAt: "2026-03-07T09:30:00Z",
    items: [
      buildSeedOrderItem("seed-order-007-item-1", "product-pudim-mini", 86),
      buildSeedOrderItem("seed-order-007-item-2", "product-brownie", 4),
      buildSeedOrderItem("seed-order-007-item-3", "product-coxinha", 100),
    ],
  },
  {
    id: "seed-order-008",
    code: "PD-260309-0008",
    storeId: "store-01",
    orderedAt: "2026-03-09T08:45:00Z",
    items: [
      buildSeedOrderItem("seed-order-008-item-1", "product-pao-doce", 84),
      buildSeedOrderItem("seed-order-008-item-2", "product-pudim-medio", 20),
      buildSeedOrderItem("seed-order-008-item-3", "product-empada-frango", 48),
    ],
  },
  {
    id: "seed-order-009",
    code: "PD-260309-0009",
    storeId: "store-03",
    orderedAt: "2026-03-09T17:05:00Z",
    items: [
      buildSeedOrderItem("seed-order-009-item-1", "product-pao-frances", 180),
      buildSeedOrderItem("seed-order-009-item-2", "product-pudim-grande", 4),
      buildSeedOrderItem("seed-order-009-item-3", "product-frango-assado", 6),
    ],
  },
  {
    id: "seed-order-010",
    code: "PD-260309-0010",
    storeId: "store-02",
    orderedAt: "2026-03-09T11:40:00Z",
    items: [
      buildSeedOrderItem("seed-order-010-item-1", "product-pao-forma", 8),
      buildSeedOrderItem("seed-order-010-item-2", "product-pudim-mini", 20),
      buildSeedOrderItem("seed-order-010-item-3", "product-frango-assado", 5),
    ],
  },
];

const planning = buildFactoryPlanningData(referenceDate, {
  stores: storeProfiles,
  storeOrders: seededStoreOrders,
  settings: operationalSettings,
  sectors: productionSectors,
  lines: productionLines,
  products: productionProducts,
  schedules: weeklySchedules,
});

function sqlString(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return "null";
  }

  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
}

function sqlArray(values: string[], enumType?: string) {
  const inner = values.map((value) => sqlString(value)).join(", ");
  return enumType ? `array[${inner}]::${enumType}[]` : `array[${inner}]`;
}

function sqlJson(value: unknown) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function toSqlTimestamp(value: string) {
  return sqlString(value);
}

const seedTenantLookup = `(select id from public.tenants where legacy_id = ${sqlString(seedTenant.legacyId)})`;

function buildStoreOrderMetadata(order: StoreOrder, store: StoreProfile) {
  const baseDate = getBaseDateByCutoff(order.orderedAt, operationalSettings.orderCutoffTime);
  const deliveryDate = getDeliveryDateByStoreRule(baseDate, store, operationalSettings);

  return {
    baseDate,
    deliveryDate,
    receiveWindowSnapshot: store.receiveWindow,
    expeditionLeadDaysSnapshot: operationalSettings.expeditionLeadDays,
  };
}

function buildWorkflowItemsForOrder(
  orderId: string,
  statuses: ProductionItemStatus[],
) {
  const uniqueKeys = new Map<string, { key: string; status: ProductionItemStatus; progress: number }>();

  planning.orderItems
    .filter((item) => item.orderId === orderId && item.productionItemKey)
    .forEach((item, index) => {
      if (item.productionItemKey && !uniqueKeys.has(item.productionItemKey)) {
        const status = statuses[Math.min(index, statuses.length - 1)] ?? "nao_iniciado";
        uniqueKeys.set(item.productionItemKey, {
          key: item.productionItemKey,
          status,
          progress: productionStageProgress[status],
        });
      }
    });

  return Array.from(uniqueKeys.values());
}

function dedupeWorkflowItems(
  items: Array<{ key: string; status: ProductionItemStatus; progress: number }>,
) {
  return Array.from(
    items.reduce<Map<string, { key: string; status: ProductionItemStatus; progress: number }>>(
      (acc, item) => {
        const current = acc.get(item.key);

        if (!current || item.progress >= current.progress) {
          acc.set(item.key, item);
        }

        return acc;
      },
      new Map(),
    ).values(),
  );
}

const releasedOrderEntries = [
  { orderId: "seed-order-001", releasedAt: "2026-03-09T08:20:00Z" },
  { orderId: "seed-order-002", releasedAt: "2026-03-09T08:35:00Z" },
  { orderId: "seed-order-004", releasedAt: "2026-03-10T06:50:00Z" },
  { orderId: "seed-order-005", releasedAt: "2026-03-10T07:05:00Z" },
  { orderId: "seed-order-006", releasedAt: "2026-03-08T06:40:00Z" },
  { orderId: "seed-order-007", releasedAt: "2026-03-08T07:10:00Z" },
  { orderId: "seed-order-008", releasedAt: "2026-03-10T08:10:00Z" },
  { orderId: "seed-order-010", releasedAt: "2026-03-10T08:30:00Z" },
];

const workflowItems = dedupeWorkflowItems([
  ...buildWorkflowItemsForOrder("seed-order-001", ["concluido"]),
  ...buildWorkflowItemsForOrder("seed-order-002", ["concluido"]),
  ...buildWorkflowItemsForOrder("seed-order-004", ["concluido"]),
  ...buildWorkflowItemsForOrder("seed-order-005", ["concluido"]),
  ...buildWorkflowItemsForOrder("seed-order-006", ["concluido"]),
  ...buildWorkflowItemsForOrder("seed-order-007", ["concluido"]),
  ...buildWorkflowItemsForOrder("seed-order-008", ["em_forno", "embalando", "em_preparacao"]),
  ...buildWorkflowItemsForOrder("seed-order-010", ["nao_iniciado"]),
]);

const deliveryEntries = [
  { orderId: "seed-order-001", status: "pronto_coleta", updatedAt: "2026-03-09T12:15:00Z" },
  { orderId: "seed-order-002", status: "aguardando_expedicao", updatedAt: "2026-03-09T12:20:00Z" },
  { orderId: "seed-order-004", status: "em_rota", updatedAt: "2026-03-10T14:05:00Z" },
  { orderId: "seed-order-005", status: "no_destino", updatedAt: "2026-03-10T15:10:00Z" },
  { orderId: "seed-order-006", status: "entregue", updatedAt: "2026-03-08T17:25:00Z" },
  { orderId: "seed-order-007", status: "tentativa_falha", updatedAt: "2026-03-08T18:40:00Z" },
];

const storeOccurrences = [
  {
    id: "seed-occ-001",
    code: "OC-0001",
    orderId: "seed-order-001",
    orderItemId: "seed-order-001-item-1",
    productId: "product-pao-frances",
    productName: "Pão Francês",
    problemType: "Quantidade incorreta",
    quantityType: "operacional",
    quantity: 12,
    quantityUnit: "Un",
    description: "Volume recebido abaixo do solicitado na separação final da loja.",
    status: "aberta",
    createdAt: "2026-03-09T12:30:00Z",
  },
  {
    id: "seed-occ-002",
    code: "OC-0002",
    orderId: "seed-order-004",
    orderItemId: "seed-order-004-item-3",
    productId: "product-brownie",
    productName: "Brownie Tradicional",
    problemType: "Peso divergente",
    quantityType: "kg",
    quantity: 0.8,
    quantityUnit: "Kg",
    description: "Parte do lote embalado apresentou peso abaixo do acordado no recebimento.",
    status: "em_analise",
    createdAt: "2026-03-10T15:20:00Z",
  },
  {
    id: "seed-occ-003",
    code: "OC-0003",
    orderId: "seed-order-005",
    orderItemId: "seed-order-005-item-2",
    productId: "product-frango-assado",
    productName: "Frango Assado",
    problemType: "Embalagem violada",
    quantityType: "operacional",
    quantity: 2,
    quantityUnit: "Un",
    description: "Duas unidades chegaram com a tampa térmica desalinhada e precisaram ser devolvidas.",
    status: "fechada",
    createdAt: "2026-03-10T16:10:00Z",
    resolvedAt: "2026-03-10T18:00:00Z",
  },
  {
    id: "seed-occ-004",
    code: "OC-0004",
    orderId: "seed-order-006",
    orderItemId: "seed-order-006-item-1",
    productId: "product-lasanha",
    productName: "Lasanha Bolonhesa",
    problemType: "Quebra de rendimento",
    quantityType: "percentual",
    quantity: 50,
    quantityUnit: "%",
    description: "Metade das travessas apresentou perda visual após a exposição na ilha quente.",
    status: "resolvida",
    createdAt: "2026-03-08T18:10:00Z",
    resolvedAt: "2026-03-08T19:00:00Z",
  },
  {
    id: "seed-occ-005",
    code: "OC-0005",
    orderId: "seed-order-007",
    orderItemId: "seed-order-007-item-3",
    productId: "product-coxinha",
    productName: "Coxinha",
    problemType: "Tentativa de entrega sem recebimento",
    quantityType: "operacional",
    quantity: 24,
    quantityUnit: "Un",
    description: "A equipe da loja não estava na doca e parte do pedido retornou para a central.",
    status: "aberta",
    createdAt: "2026-03-08T18:50:00Z",
  },
  {
    id: "seed-occ-006",
    code: "OC-0006",
    orderId: "seed-order-001",
    orderItemId: "seed-order-001-item-2",
    productId: "product-pudim-mini",
    productName: "Pudim Leite Condensado Mini",
    problemType: "Falta de identificação",
    quantityType: "operacional",
    quantity: 5,
    quantityUnit: "Un",
    description: "Cinco unidades saíram sem etiqueta de validade e foram segregadas na loja.",
    status: "em_analise",
    createdAt: "2026-03-09T12:50:00Z",
  },
];

const seedLines: string[] = [];

seedLines.push("-- Generated by scripts/supabase/generate-seed.ts");
seedLines.push("begin;");
seedLines.push("");
seedLines.push(
  "truncate table public.store_occurrence_events, public.store_order_events, public.store_occurrences, public.delivery_executions, public.workflow_production_items, public.workflow_order_releases, public.store_order_items, public.store_orders, public.business_code_sequences, public.product_recipe_items, public.ingredient_components, public.schedule_line_item_snapshots, public.schedule_lines, public.products, public.ingredients, public.profile_store_access, public.user_permissions, public.permission_modules, public.subcategories, public.categories, public.stores, public.operational_settings, public.profiles, public.tenants restart identity cascade;",
);
seedLines.push("");

seedLines.push(
  `insert into public.tenants (legacy_id, slug, name, status) values (${sqlString(seedTenant.legacyId)}, ${sqlString(seedTenant.slug)}, ${sqlString(seedTenant.name)}, 'ativo'::public.record_status);`,
);
seedLines.push("");

seedLines.push(
  `insert into public.operational_settings (tenant_id, order_cutoff_time, expedition_lead_days) values (${seedTenantLookup}, ${sqlString(operationalSettings.orderCutoffTime)}, ${operationalSettings.expeditionLeadDays});`,
);
seedLines.push("");

seedLines.push(
  `insert into public.categories (legacy_id, tenant_id, code, name, responsible, status) values\n${productionSectors
    .map(
      (sector) =>
        `  (${sqlString(sector.id)}, ${seedTenantLookup}, ${sqlString(sector.code)}, ${sqlString(sector.name)}, ${sqlString(sector.responsible)}, ${sqlString(sector.status)}::public.record_status)`,
    )
    .join(",\n")};`,
);
seedLines.push("");

seedLines.push(
  `insert into public.subcategories (legacy_id, tenant_id, code, name, category_id, type, operating_hours, capacity_per_day_kg, status) values\n${productionLines
    .map(
      (line) =>
        `  (${sqlString(line.id)}, ${seedTenantLookup}, ${sqlString(line.code)}, ${sqlString(line.name)}, (select id from public.categories where legacy_id = ${sqlString(line.sectorId)}), ${sqlString(line.type)}::public.line_type, ${sqlString(line.operatingHours)}, ${line.capacityPerDayKg}, ${sqlString(line.status)}::public.record_status)`,
    )
    .join(",\n")};`,
);
seedLines.push("");

seedLines.push(
  `insert into public.stores (legacy_id, tenant_id, code, name, responsible, email, phone, status, receive_window, ordering_days, receiving_days) values\n${storesMasterData
    .map(
      (store) =>
        `  (${sqlString(store.id)}, ${seedTenantLookup}, ${sqlString(store.code)}, ${sqlString(store.name)}, ${sqlString(store.responsible)}, ${sqlString(store.email)}, ${sqlString(store.phone)}, ${sqlString(store.status)}::public.record_status, ${sqlString(store.receiveWindow)}, ${sqlArray(store.orderingDays, "public.weekday_code")}, ${sqlArray(store.receivingDays, "public.weekday_code")})`,
    )
    .join(",\n")};`,
);
seedLines.push("");

seedLines.push(
  `insert into public.ingredients (legacy_id, tenant_id, code, name, type, unit, metadata, observation, status) values\n${productionIngredients
    .map(
      (ingredient) =>
        `  (${sqlString(ingredient.id)}, ${seedTenantLookup}, ${sqlString(ingredient.code)}, ${sqlString(ingredient.name)}, ${sqlString(ingredient.type)}::public.ingredient_type, ${sqlString(ingredient.unit)}::public.unit_code, ${sqlString(ingredient.metadata)}, ${sqlString(ingredient.observation)}, ${sqlString(ingredient.status)}::public.record_status)`,
    )
    .join(",\n")};`,
);
seedLines.push("");

seedLines.push(
  `insert into public.products (legacy_id, tenant_id, code, name, description, subcategory_id, operational_subcategory_id, active, available_for_ordering, validity_days, minimum_production_kg, economic_production_kg, allows_storage, production_days, unit_profiles, packaging_profile, is_sold_loose, preparation_mode, break_percent, break_stage, break_comment, can_be_ingredient, ingredient_profile, weight_label, production_unit, sales_unit, sales_to_kg_factor, expedition_unit, expedition_to_kg_factor, is_mpi_ingredient) values\n${productionProducts
    .map(
      (product) =>
        `  (${sqlString(product.id)}, ${seedTenantLookup}, ${sqlString(product.code)}, ${sqlString(product.name)}, ${sqlString(product.description)}, (select id from public.subcategories where legacy_id = ${sqlString(product.lineId)}), (select id from public.subcategories where legacy_id = ${sqlString(product.operationalLineId ?? product.lineId)}), ${product.active}, ${product.availableForOrdering}, ${product.validityDays}, ${product.minimumProductionKg}, ${product.economicProductionKg}, ${product.allowsStorage}, ${sqlArray(product.productionDays, "public.weekday_code")}, ${sqlJson(product.unitProfiles)}, ${product.packagingProfile ? sqlJson(product.packagingProfile) : "null"}, ${product.isSoldLoose}, ${sqlString(product.preparationMode)}, ${product.breakPercent}, ${sqlString(product.breakStage)}::public.break_stage, ${sqlString(product.breakComment)}, ${product.canBeIngredient}, ${product.ingredientProfile ? sqlJson(product.ingredientProfile) : "null"}, ${sqlString(product.weight)}, ${sqlString(product.productionUnit)}::public.unit_code, ${sqlString(product.salesUnit)}::public.unit_code, ${product.salesToKgFactor}, ${sqlString(product.expeditionUnit)}::public.unit_code, ${product.expeditionToKgFactor}, ${product.isMpiIngredient})`,
    )
    .join(",\n")};`,
);
seedLines.push("");

const ingredientComponents = productionIngredients.flatMap((ingredient) =>
  ingredient.composition.map((component, index) => ({ ingredient, component, index })),
);
if (ingredientComponents.length > 0) {
  seedLines.push(
    `insert into public.ingredient_components (tenant_id, ingredient_id, ingredient_reference_id, product_reference_id, name, quantity, unit, observation, sort_order) values\n${ingredientComponents
      .map(
        ({ ingredient, component, index }) =>
          `  (${seedTenantLookup}, (select id from public.ingredients where legacy_id = ${sqlString(ingredient.id)}), ${
            component.ingredientId
              ? `(select id from public.ingredients where legacy_id = ${sqlString(component.ingredientId)})`
              : "null"
          }, ${
            component.productId
              ? `(select id from public.products where legacy_id = ${sqlString(component.productId)})`
              : "null"
          }, ${sqlString(component.name)}, ${component.quantity}, ${sqlString(component.unit)}::public.unit_code, ${sqlString(component.observation)}, ${index})`,
      )
      .join(",\n")};`,
  );
  seedLines.push("");
}

const recipeItems = productionProducts.flatMap((product) =>
  product.recipe.map((item, index) => ({ product, item, index })),
);
if (recipeItems.length > 0) {
  seedLines.push(
    `insert into public.product_recipe_items (tenant_id, product_id, source_type, ingredient_source_id, product_source_id, label, quantity, unit, sort_order) values\n${recipeItems
      .map(
        ({ product, item, index }) =>
          `  (${seedTenantLookup}, (select id from public.products where legacy_id = ${sqlString(product.id)}), ${sqlString(item.sourceType)}::public.recipe_source_type, ${
            item.sourceType === "ingrediente"
              ? `(select id from public.ingredients where legacy_id = ${sqlString(item.sourceId)})`
              : "null"
          }, ${
            item.sourceType === "produto"
              ? `(select id from public.products where legacy_id = ${sqlString(item.sourceId)})`
              : "null"
          }, ${sqlString(item.label)}, ${item.quantity}, ${sqlString(item.unit)}::public.unit_code, ${index})`,
      )
      .join(",\n")};`,
  );
  seedLines.push("");
}

seedLines.push(
  `insert into public.schedule_lines (legacy_id, tenant_id, code, name, subcategory_id, revision_of_id, status, created_at, created_by_profile_id, audited_at, audited_by_profile_id, audit_notes, deactivated_at, deactivated_by_profile_id) values\n${weeklySchedules
    .map(
      (schedule) =>
        `  (${sqlString(schedule.id)}, ${seedTenantLookup}, ${sqlString(schedule.code)}, ${sqlString(schedule.name)}, (select id from public.subcategories where legacy_id = ${sqlString(schedule.lineId)}), ${
          schedule.revisionOfId
            ? `(select id from public.schedule_lines where legacy_id = ${sqlString(schedule.revisionOfId)})`
            : "null"
        }, ${sqlString(schedule.status)}::public.schedule_status, ${toSqlTimestamp(schedule.createdAt)}, null, ${schedule.auditedAt ? toSqlTimestamp(schedule.auditedAt) : "null"}, null, ${sqlString(schedule.auditNotes ?? "")}, ${schedule.deactivatedAt ? toSqlTimestamp(schedule.deactivatedAt) : "null"}, null)`,
    )
    .join(",\n")};`,
);
seedLines.push("");

const scheduleSnapshots = weeklySchedules.flatMap((schedule) =>
  schedule.items.map((item) => ({ schedule, item })),
);
if (scheduleSnapshots.length > 0) {
  seedLines.push(
    `insert into public.schedule_line_item_snapshots (tenant_id, schedule_line_id, product_id, minimum_production, production_days) values\n${scheduleSnapshots
      .map(
        ({ schedule, item }) =>
          `  (${seedTenantLookup}, (select id from public.schedule_lines where legacy_id = ${sqlString(schedule.id)}), (select id from public.products where legacy_id = ${sqlString(item.productId)}), ${item.minimumProduction}, ${sqlArray(item.productionDays, "public.weekday_code")})`,
      )
      .join(",\n")};`,
  );
  seedLines.push("");
}

seedLines.push(
  `insert into public.permission_modules (module_key, label, route, group_key) values\n${permissionModules
    .map(
      (module) =>
        `  (${sqlString(module.id)}, ${sqlString(module.label)}, ${sqlString(module.route)}, ${sqlString(module.group)}::public.permission_group)`,
    )
    .join(",\n")};`,
);
seedLines.push("");

seedLines.push(
  `insert into public.profiles (legacy_id, tenant_id, role, status, name, email, phone, zip_code, street, number, complement, neighborhood, city, state, country, avatar_path, password_updated_at, created_at, updated_at) values\n${initialUsers
    .map(
      (user) =>
        `  (${sqlString(user.id)}, ${user.tenantId ? `(select id from public.tenants where legacy_id = ${sqlString(user.tenantId)})` : "null"}, ${sqlString(user.role)}::public.user_role, ${sqlString(user.status)}::public.record_status, ${sqlString(user.name)}, ${sqlString(user.email)}, ${sqlString(user.profile.phone || null)}, ${sqlString(user.profile.address.zipCode || null)}, ${sqlString(user.profile.address.street || null)}, ${sqlString(user.profile.address.number || null)}, ${sqlString(user.profile.address.complement || null)}, ${sqlString(user.profile.address.neighborhood || null)}, ${sqlString(user.profile.address.city || null)}, ${sqlString(user.profile.address.state || null)}, ${sqlString(user.profile.address.country || null)}, ${sqlString(user.profile.avatarUrl || null)}, ${user.profile.passwordUpdatedAt !== "-" ? sqlString("2026-02-19T08:00:00Z") : "null"}, ${sqlString("2026-02-19T08:00:00Z")}, ${sqlString("2026-02-19T10:00:00Z")})`,
    )
    .join(",\n")};`,
);
seedLines.push("");

seedLines.push(
  `update public.stores
set responsible_profile_id = (select id from public.profiles where legacy_id = 'user-loja')
where tenant_id = ${seedTenantLookup};`,
);
seedLines.push("");

seedLines.push(
  `update public.schedule_lines
set created_by_profile_id = (select id from public.profiles where legacy_id = 'user-dados'),
    audited_by_profile_id = case
      when status = 'ativo'::public.schedule_status then (select id from public.profiles where legacy_id = 'user-fabrica')
      else null
    end,
    audit_notes = case
      when status = 'ativo'::public.schedule_status and (audit_notes is null or audit_notes = '') then 'Cronograma homologado para a semana operacional de 09/03.'
      else audit_notes
    end;`,
);
seedLines.push("");

const permissionRows = initialUsers.flatMap((user) =>
  Object.entries(user.permissions).map(([moduleKey, accessLevel]) => ({ userId: user.id, moduleKey, accessLevel })),
);
seedLines.push(
  `insert into public.user_permissions (tenant_id, profile_id, module_key, access_level) values\n${permissionRows
    .map(
      (row) =>
        `  ((select tenant_id from public.profiles where legacy_id = ${sqlString(row.userId)}), (select id from public.profiles where legacy_id = ${sqlString(row.userId)}), ${sqlString(row.moduleKey)}, ${sqlString(row.accessLevel)}::public.permission_level)`,
    )
    .join(",\n")};`,
);
seedLines.push("");

seedLines.push(
  `insert into public.profile_store_access (tenant_id, profile_id, store_id) values\n${storesMasterData
    .map(
      (store) =>
        `  (${seedTenantLookup}, (select id from public.profiles where legacy_id = 'user-loja'), (select id from public.stores where legacy_id = ${sqlString(store.id)}))`,
    )
    .join(",\n")};`,
);
seedLines.push("");

seedLines.push(
  `insert into public.store_orders (legacy_id, tenant_id, code, store_id, created_by_profile_id, ordered_at, base_date, delivery_date, receive_window_snapshot, expedition_lead_days_snapshot, note) values\n${seededStoreOrders
    .map((order) => {
      const store = storeProfiles.find((item) => item.id === order.storeId);
      if (!store) {
        throw new Error(`Store not found for order ${order.id}`);
      }

      const metadata = buildStoreOrderMetadata(order, store);

      return `  (${sqlString(order.id)}, ${seedTenantLookup}, ${sqlString(order.code)}, (select id from public.stores where legacy_id = ${sqlString(order.storeId)}), (select id from public.profiles where legacy_id = 'user-loja'), ${toSqlTimestamp(order.orderedAt)}, ${sqlString(metadata.baseDate)}, ${sqlString(metadata.deliveryDate)}, ${sqlString(metadata.receiveWindowSnapshot)}, ${metadata.expeditionLeadDaysSnapshot}, ${sqlString(`Pedido fictício ${order.code} para validação integrada do fluxo.`)})`;
    })
    .join(",\n")};`,
);
seedLines.push("");

const storeOrderItemRows = seededStoreOrders.flatMap((order) =>
  order.items.map((item) => {
    const product = productionProducts.find((productRow) => productRow.id === item.productId);
    if (!product) {
      throw new Error(`Product not found for order item ${item.id}`);
    }

    return {
      order,
      item,
      product,
      internalKg: Number((item.quantity * product.salesToKgFactor).toFixed(3)),
    };
  }),
);

seedLines.push(
  `insert into public.store_order_items (legacy_id, tenant_id, order_id, product_id, product_code_snapshot, product_name_snapshot, requested_quantity, requested_unit, sales_to_kg_factor_snapshot, internal_kg_snapshot, expedition_unit_snapshot, expedition_to_kg_factor_snapshot, operational_unit_snapshot) values\n${storeOrderItemRows
    .map(
      (row) =>
        `  (${sqlString(row.item.id)}, ${seedTenantLookup}, (select id from public.store_orders where legacy_id = ${sqlString(row.order.id)}), (select id from public.products where legacy_id = ${sqlString(row.product.id)}), ${sqlString(row.product.code)}, ${sqlString(row.product.name)}, ${row.item.quantity}, ${sqlString(row.item.unit)}::public.unit_code, ${row.product.salesToKgFactor}, ${row.internalKg}, ${sqlString(row.product.expeditionUnit)}::public.unit_code, ${row.product.expeditionToKgFactor}, ${sqlString(row.product.productionUnit)}::public.unit_code)`,
    )
    .join(",\n")};`,
);
seedLines.push("");

seedLines.push(
  `insert into public.workflow_order_releases (tenant_id, order_id, released_at, released_by_profile_id) values\n${releasedOrderEntries
    .map(
      (entry) =>
        `  (${seedTenantLookup}, (select id from public.store_orders where legacy_id = ${sqlString(entry.orderId)}), ${sqlString(entry.releasedAt)}, (select id from public.profiles where legacy_id = 'user-fabrica'))`,
    )
    .join(",\n")};`,
);
seedLines.push("");

if (workflowItems.length > 0) {
  seedLines.push(
    `insert into public.workflow_production_items (tenant_id, production_item_key, status, progress, updated_at, updated_by_profile_id) values\n${workflowItems
      .map(
        (item) =>
          `  (${seedTenantLookup}, ${sqlString(item.key)}, ${sqlString(item.status)}::public.production_item_status, ${item.progress}, ${sqlString("2026-03-09T12:00:00Z")}, (select id from public.profiles where legacy_id = 'user-chao'))`,
      )
      .join(",\n")};`,
  );
  seedLines.push("");
}

seedLines.push(
  `insert into public.delivery_executions (tenant_id, order_id, status, updated_at, updated_by_profile_id) values\n${deliveryEntries
    .map(
      (entry) =>
        `  (${seedTenantLookup}, (select id from public.store_orders where legacy_id = ${sqlString(entry.orderId)}), ${sqlString(entry.status)}::public.delivery_execution_status, ${sqlString(entry.updatedAt)}, (select id from public.profiles where legacy_id = 'user-fabrica'))`,
    )
    .join(",\n")};`,
);
seedLines.push("");

seedLines.push(
  `insert into public.store_occurrences (legacy_id, tenant_id, code, order_id, order_item_id, product_id, product_name_snapshot, problem_type, quantity_type, quantity, quantity_unit_snapshot, description, status, opened_by_profile_id, resolved_by_profile_id, resolved_at, created_at, updated_at) values\n${storeOccurrences
    .map(
      (occurrence) =>
        `  (${sqlString(occurrence.id)}, ${seedTenantLookup}, ${sqlString(occurrence.code)}, (select id from public.store_orders where legacy_id = ${sqlString(occurrence.orderId)}), (select id from public.store_order_items where legacy_id = ${sqlString(occurrence.orderItemId)}), (select id from public.products where legacy_id = ${sqlString(occurrence.productId)}), ${sqlString(occurrence.productName)}, ${sqlString(occurrence.problemType)}, ${sqlString(occurrence.quantityType)}::public.occurrence_quantity_type, ${occurrence.quantity}, ${sqlString(occurrence.quantityUnit)}, ${sqlString(occurrence.description)}, ${sqlString(occurrence.status)}::public.occurrence_status, (select id from public.profiles where legacy_id = 'user-loja'), ${
          occurrence.resolvedAt
            ? "(select id from public.profiles where legacy_id = 'user-fabrica')"
            : "null"
        }, ${occurrence.resolvedAt ? sqlString(occurrence.resolvedAt) : "null"}, ${sqlString(occurrence.createdAt)}, ${sqlString(occurrence.resolvedAt ?? occurrence.createdAt)})`,
    )
    .join(",\n")};`,
);
seedLines.push("");

seedLines.push(
  "insert into storage.buckets (id, name, public) values ('profile-avatars', 'profile-avatars', false) on conflict (id) do nothing;",
);
seedLines.push("");
seedLines.push("select public.rebuild_business_code_sequences();");
seedLines.push("");
seedLines.push("commit;");

process.stdout.write(`${seedLines.join("\n")}\n`);
