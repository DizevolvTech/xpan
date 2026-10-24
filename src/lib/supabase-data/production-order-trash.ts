import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  assertSupabaseResult,
  isSupabaseMissingSchemaError,
  resolveProfileDatabaseId,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";

export interface TrashedProductionOrder {
  id: string;
  planningKey: string;
  opCode: string | null;
  productionDate: string | null;
  lineName: string | null;
  productsCount: number | null;
  totalKg: number | null;
  orderCodes: string[];
  deletedAt: string;
}

interface TrashRow {
  id: string;
  planning_key: string;
  op_code: string | null;
  production_date: string | null;
  line_name: string | null;
  products_count: number | null;
  total_kg: number | string | null;
  order_codes: string[] | null;
  deleted_at: string;
}

/** OPs na lixeira (não restauradas) do tenant. Sem a tabela (migração pendente) = lista vazia. */
export async function listTrashedProductionOrders(
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<TrashedProductionOrder[]> {
  const result = await supabase
    .from("production_order_trash")
    .select("id, planning_key, op_code, production_date, line_name, products_count, total_kg, order_codes, deleted_at")
    .is("restored_at", null)
    .order("deleted_at", { ascending: false });
  if (result.error && isSupabaseMissingSchemaError(result.error, ["production_order_trash"])) {
    return [];
  }
  const rows = assertSupabaseResult(result, "Failed to load production order trash") as TrashRow[];
  return rows.map((row) => ({
    id: row.id,
    planningKey: row.planning_key,
    opCode: row.op_code,
    productionDate: row.production_date,
    lineName: row.line_name,
    productsCount: row.products_count,
    totalKg: row.total_kg == null ? null : Number(row.total_kg),
    orderCodes: Array.isArray(row.order_codes) ? row.order_codes : [],
    deletedAt: row.deleted_at,
  }));
}

export async function trashProductionOrder(
  input: {
    planningKey: string;
    opCode: string | null;
    productionDate: string | null;
    lineName: string | null;
    productsCount: number | null;
    totalKg: number | null;
    orderCodes: string[];
    profileId: string | null;
  },
  supabase: SupabaseDataClient,
) {
  // O Master não pertence ao tenant: busca o perfil fora do escopo do cliente.
  const deletedBy = await resolveProfileDatabaseId(createSupabaseAdminClient(), input.profileId, { allowMasterProfile: true });
  const result = await supabase.from("production_order_trash").insert({
    planning_key: input.planningKey,
    op_code: input.opCode,
    production_date: input.productionDate,
    line_name: input.lineName,
    products_count: input.productsCount,
    total_kg: input.totalKg,
    order_codes: input.orderCodes,
    deleted_by_profile_id: deletedBy,
  });
  if (result.error && /duplicate|unique/i.test(result.error.message)) {
    return; // já está na lixeira: idempotente
  }
  assertSupabaseResult({ data: [], error: result.error }, "Failed to trash production order");
}

export async function restoreProductionOrder(trashId: string, profileId: string | null, supabase: SupabaseDataClient) {
  const restoredBy = await resolveProfileDatabaseId(createSupabaseAdminClient(), profileId, { allowMasterProfile: true });
  const result = await supabase
    .from("production_order_trash")
    .update({ restored_at: new Date().toISOString(), restored_by_profile_id: restoredBy })
    .eq("id", trashId)
    .is("restored_at", null);
  assertSupabaseResult({ data: [], error: result.error }, "Failed to restore production order");
}
