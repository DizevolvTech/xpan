import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/store-orders/aggregated-quantities",
    anyOfPermissions: ["loja.pedidos", "gestor-fabrica.pedidos"],
    minimumLevel: "visualizar",
    requireTenantContext: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const { searchParams } = new URL(request.url);
  const deliveryDate = searchParams.get("deliveryDate");

  if (!deliveryDate) {
    return NextResponse.json(
      { message: "Informe o parâmetro deliveryDate (YYYY-MM-DD)." },
      { status: 400 },
    );
  }

  const supabase = createTenantScopedSupabaseClient(
    authorization.effectiveTenantId,
    createSupabaseAdminClient(),
  );

  const { data, error } = await supabase
    .from("store_order_items")
    .select("product_id, internal_kg_snapshot, store_orders!inner(delivery_date, management_status)")
    .eq("store_orders.delivery_date", deliveryDate)
    .eq("store_orders.management_status", "ativo");

  if (error) {
    return NextResponse.json(
      { message: "Falha ao consultar pedidos agregados." },
      { status: 500 },
    );
  }

  const aggregated = new Map<string, number>();

  (data ?? []).forEach((row) => {
    const productId = row.product_id;
    const kg = Number(row.internal_kg_snapshot) || 0;
    aggregated.set(productId, (aggregated.get(productId) ?? 0) + kg);
  });

  const result = Array.from(aggregated.entries()).map(([productId, totalKg]) => ({
    productId,
    totalKg: Number(totalKg.toFixed(3)),
  }));

  return NextResponse.json(result);
}
