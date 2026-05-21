import "server-only";

import type { Database } from "@/lib/database.types";
import type {
  CreateMasterClientPayload,
  CreateMasterClientResult,
  MasterClient,
  MasterClientMetrics,
} from "@/lib/master-clients";
import {
  isMasterClientAdminEmailConflictMessage,
  MASTER_CLIENT_ADMIN_EMAIL_CONFLICT_MESSAGE,
} from "@/lib/master-clients";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createManagedUser } from "@/lib/supabase-data/admin-users";
import {
  assertSupabaseResult,
  isUuid,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";
import { slugifyTenantName, type TenantSummary } from "@/lib/tenant";

type TenantRow = Database["public"]["Tables"]["tenants"]["Row"];

type QueryOptions = {
  supabase?: SupabaseDataClient;
};
type CreateTenantInput = CreateMasterClientPayload;
type CreateTenantResult = CreateMasterClientResult;

function mapTenantSummary(row: TenantRow): TenantSummary {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    logoUrl: (row as Record<string, unknown>).logo_url as string | null ?? null,
  };
}

function mapTenantClient(
  row: TenantRow,
  metrics: MasterClientMetrics,
): MasterClient {
  return {
    ...mapTenantSummary(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metrics,
  };
}

function countByTenant<T extends { tenant_id: string | null }>(rows: T[]) {
  return rows.reduce<Map<string, number>>((acc, row) => {
    if (!row.tenant_id) {
      return acc;
    }

    acc.set(row.tenant_id, (acc.get(row.tenant_id) ?? 0) + 1);
    return acc;
  }, new Map());
}

/**
 * AJ-A6.2: lista os ids de todos os tenants ativos. Usado pelo cron de
 * auto-release pra iterar sem precisar de session de usuário. Bypassa RLS
 * intencionalmente — chamado só do contexto do scheduler com service-role.
 */
export async function listActiveTenantIds(
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<string[]> {
  const result = await supabase
    .from("tenants")
    .select("id")
    .eq("status", "ativo");
  const rows = assertSupabaseResult(result, "Failed to list active tenants");
  return rows.map((row) => row.id);
}

async function buildUniqueTenantSlug(
  name: string,
  supabase: SupabaseDataClient,
) {
  const baseSlug = slugifyTenantName(name) || "cliente";
  const result = await supabase
    .from("tenants")
    .select("slug")
    .ilike("slug", `${baseSlug}%`);
  const rows = assertSupabaseResult(result, "Failed to load tenant slugs");
  const existing = new Set(rows.map((row) => row.slug));

  if (!existing.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (existing.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

async function assertTenantAdminEmailAvailable(
  email: string,
  supabase: SupabaseDataClient,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await supabase
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (result.error) {
    throw new Error(`Failed to validate tenant admin email: ${result.error.message}`);
  }

  if (result.data) {
    throw new Error(MASTER_CLIENT_ADMIN_EMAIL_CONFLICT_MESSAGE);
  }
}

async function rollbackProvisionedTenant(
  tenantId: string,
  supabase: SupabaseDataClient,
) {
  const deleteProfilesResult = await supabase.from("profiles").delete().eq("tenant_id", tenantId);

  if (deleteProfilesResult.error) {
    throw new Error(`Failed to remove tenant users during rollback: ${deleteProfilesResult.error.message}`);
  }

  const deleteTenantResult = await supabase.from("tenants").delete().eq("id", tenantId);

  if (deleteTenantResult.error) {
    throw new Error(`Failed to remove tenant during rollback: ${deleteTenantResult.error.message}`);
  }
}

export async function getTenantByIdentifier(
  identifier: string,
  options: QueryOptions = {},
): Promise<MasterClient | null> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const baseQuery = supabase.from("tenants").select("*");

  const result = await (
    isUuid(identifier)
      ? baseQuery.eq("id", identifier)
      : baseQuery.or(`legacy_id.eq.${identifier},slug.eq.${identifier}`)
  ).maybeSingle();

  if (result.error) {
    throw new Error(`Failed to resolve tenant: ${result.error.message}`);
  }

  if (!result.data) {
    return null;
  }

  return mapTenantClient(result.data as TenantRow, {
    users: 0,
    activeUsers: 0,
    stores: 0,
    products: 0,
    orders: 0,
    openOccurrences: 0,
  });
}

export async function listMasterClients(
  options: QueryOptions = {},
): Promise<MasterClient[]> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const [
    tenantsResult,
    profilesResult,
    storesResult,
    productsResult,
    ordersResult,
    occurrencesResult,
  ] = await Promise.all([
    supabase.from("tenants").select("*").order("updated_at", { ascending: false }),
    supabase.from("profiles").select("tenant_id, status").not("tenant_id", "is", null),
    supabase.from("stores").select("tenant_id"),
    supabase.from("products").select("tenant_id"),
    supabase.from("store_orders").select("tenant_id"),
    supabase
      .from("store_occurrences")
      .select("tenant_id, status")
      .neq("status", "fechada"),
  ]);

  const tenants = assertSupabaseResult(tenantsResult, "Failed to load tenants") as TenantRow[];
  const profiles = assertSupabaseResult(profilesResult, "Failed to load tenant users");
  const stores = assertSupabaseResult(storesResult, "Failed to load tenant stores");
  const products = assertSupabaseResult(productsResult, "Failed to load tenant products");
  const orders = assertSupabaseResult(ordersResult, "Failed to load tenant orders");
  const occurrences = assertSupabaseResult(occurrencesResult, "Failed to load tenant occurrences");

  const usersByTenant = countByTenant(profiles);
  const activeUsersByTenant = countByTenant(profiles.filter((row) => row.status === "ativo"));
  const storesByTenant = countByTenant(stores);
  const productsByTenant = countByTenant(products);
  const ordersByTenant = countByTenant(orders);
  const occurrencesByTenant = countByTenant(occurrences);

  return tenants.map((tenant) =>
    mapTenantClient(tenant, {
      users: usersByTenant.get(tenant.id) ?? 0,
      activeUsers: activeUsersByTenant.get(tenant.id) ?? 0,
      stores: storesByTenant.get(tenant.id) ?? 0,
      products: productsByTenant.get(tenant.id) ?? 0,
      orders: ordersByTenant.get(tenant.id) ?? 0,
      openOccurrences: occurrencesByTenant.get(tenant.id) ?? 0,
    }),
  );
}

export async function createTenantWithAdmin(
  input: CreateTenantInput,
  options: QueryOptions = {},
): Promise<CreateTenantResult> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const tenantName = input.tenant.name.trim();
  const adminName = input.admin.name.trim();
  const adminEmail = input.admin.email.trim().toLowerCase();

  await assertTenantAdminEmailAvailable(adminEmail, supabase);

  const slug = await buildUniqueTenantSlug(tenantName, supabase);
  let tenant: TenantRow | null = null;

  try {
    const tenantInsertResult = await supabase
      .from("tenants")
      .insert({
        legacy_id: `tenant-${crypto.randomUUID()}`,
        slug,
        name: tenantName,
        status: input.tenant.status,
      })
      .select("*")
      .single();

    tenant = assertSupabaseResult(tenantInsertResult, "Failed to create tenant") as TenantRow;

    const settingsResult = await supabase.from("operational_settings").insert({
      tenant_id: tenant.id,
      order_cutoff_time: "18:00",
      expedition_lead_days: 0,
      sale_lead_days: 1,
    });

    if (settingsResult.error) {
      throw new Error(`Failed to create tenant operational settings: ${settingsResult.error.message}`);
    }

    const createdAdmin = await createManagedUser(
      {
        name: adminName,
        email: adminEmail,
        role: "administrador",
        status: input.admin.status,
        storeIds: [],
      },
      {
        supabase,
        tenantId: tenant.id,
      },
    );

    return {
      tenant: mapTenantClient(tenant, {
        users: 1,
        activeUsers: input.admin.status === "ativo" ? 1 : 0,
        stores: 0,
        products: 0,
        orders: 0,
        openOccurrences: 0,
      }),
      admin: createdAdmin.user,
      temporaryPassword: createdAdmin.temporaryPassword,
    };
  } catch (error) {
    if (tenant?.id) {
      try {
        await rollbackProvisionedTenant(tenant.id, supabase);
      } catch (rollbackError) {
        const baseMessage =
          error instanceof Error ? error.message : "Não foi possível criar o cliente.";
        const rollbackMessage =
          rollbackError instanceof Error
            ? rollbackError.message
            : "Não foi possível limpar o cadastro parcial.";
        throw new Error(`${baseMessage} Também não foi possível limpar o cadastro parcial: ${rollbackMessage}`);
      }
    }

    if (error instanceof Error && isMasterClientAdminEmailConflictMessage(error.message)) {
      throw new Error(MASTER_CLIENT_ADMIN_EMAIL_CONFLICT_MESSAGE);
    }

    throw error;
  }
}

export async function updateTenantStatus(
  identifier: string,
  status: TenantRow["status"],
  options: QueryOptions = {},
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const baseQuery = supabase
    .from("tenants")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .select("*");

  const result = await (
    isUuid(identifier)
      ? baseQuery.eq("id", identifier)
      : baseQuery.or(`legacy_id.eq.${identifier},slug.eq.${identifier}`)
  ).single();

  const row = assertSupabaseResult(result, "Failed to update tenant status") as TenantRow;

  return mapTenantClient(row, {
    users: 0,
    activeUsers: 0,
    stores: 0,
    products: 0,
    orders: 0,
    openOccurrences: 0,
  });
}
