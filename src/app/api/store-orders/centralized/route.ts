import { NextResponse } from "next/server";
import { authorizeApiRequest, canAccessStore } from "@/lib/api-auth";
import { reviewOrderEntries, type OrderEntryCatalog, type OrderEntryRow } from "@/lib/centralized-orders";
import { buildStoreOrderCatalog } from "@/lib/store-order-catalog";
import { getMasterDataSnapshot } from "@/lib/supabase-data/master-data";
import { createCentralizedStoreOrders, type CreateStoreOrderInput } from "@/lib/supabase-data/store-orders";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { invalidatePlanningCaches } from "@/lib/server-data-cache";

async function context(write: boolean) {
  const auth = await authorizeApiRequest({ contextLabel: "Pedidos centralizados", permission: "gestor-fabrica.pedidos", minimumLevel: "operar", includeStoreScope: true, requireTenantContext: true, requireWritableTenant: write });
  if ("response" in auth) return auth;
  const supabase = createTenantScopedSupabaseClient(auth.effectiveTenantId, createSupabaseAdminClient());
  const snapshot = await getMasterDataSnapshot({ supabase, tenantId: auth.effectiveTenantId, includeProfileNames: false, forceRefresh: true });
  const catalog: OrderEntryCatalog = {
    stores: snapshot.stores.filter(s => s.status === "ativo" && canAccessStore(auth, s.id)).map(s => ({ id: s.id, code: s.code, name: s.name })),
    products: snapshot.products.filter(p => p.active && p.availableForOrdering).map(p => ({ id: p.id, code: p.code, externalCode: p.externalCode, name: p.name, unit: p.unitProfiles.sales.unit })),
  };
  return { auth, supabase, snapshot, catalog };
}

export async function GET() {
  try {
    const ctx = await context(false);
    if ("response" in ctx) return ctx.response;
    return NextResponse.json(ctx.catalog);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Falha ao carregar cadastros." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await context(true);
    if ("response" in ctx) return ctx.response;
    const body = await request.json();
    if (!Array.isArray(body.rows) || body.rows.length > 5000 || !body.rows.every((r: OrderEntryRow) => r && Number.isInteger(r.row) && typeof r.store === "string" && typeof r.product === "string" && ["number", "string"].includes(typeof r.quantity))) {
      return NextResponse.json({ message: "Informe até 5.000 linhas válidas." }, { status: 400 });
    }
    const date = typeof body.deliveryDate === "string" ? body.deliveryDate : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
      return NextResponse.json({ message: "Informe uma data de entrega válida." }, { status: 400 });
    }
    const review = reviewOrderEntries(body.rows, ctx.catalog);
    const now = new Date().toISOString();
    const storeCatalogs = new Map<string, ReturnType<typeof buildStoreOrderCatalog>>();
    for (const row of review.rows) {
      if (!storeCatalogs.has(row.storeId)) storeCatalogs.set(row.storeId, buildStoreOrderCatalog(ctx.snapshot, { storeId: row.storeId, orderedAt: now, targetDeliveryDate: date }));
      const product = storeCatalogs.get(row.storeId)!.find(p => p.productId === row.productId);
      if (!product?.available) review.errors.push({ row: row.row, message: product?.blockedReason ?? "Produto indisponível para esta loja/data no cronograma." });
    }
    if (body.confirm !== true || review.errors.length) return NextResponse.json(review, { status: body.confirm === true && review.errors.length ? 400 : 200 });
    if (typeof body.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) {
      return NextResponse.json({ message: "Identificador de confirmação inválido." }, { status: 400 });
    }
    const orders = new Map<string, CreateStoreOrderInput>();
    for (const row of review.rows) {
      if (!orders.has(row.storeId)) orders.set(row.storeId, { storeId: row.storeId, deliveryDate: date, items: [] });
      orders.get(row.storeId)!.items.push({ productId: row.productId, quantity: row.quantity, unit: row.unit });
    }
    const created = await createCentralizedStoreOrders({ orders: [...orders.values()], tenantId: ctx.auth.effectiveTenantId!, actorId: ctx.auth.user.id, requestId: body.requestId, source: body.source === "excel" ? "excel" : "centralizado" }, ctx.supabase);
    invalidatePlanningCaches(ctx.auth.effectiveTenantId);
    return NextResponse.json({ created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Falha ao registrar pedidos." }, { status: 400 });
  }
}
