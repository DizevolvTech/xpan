import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { normalizeStoreProductMix, toggleProductInMixList } from "@/lib/store-product-mix";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

/**
 * Cartão #602: no cadastro do PRODUTO, marcar em quais modelos de mix e em quais lojas de
 * lista manual ele é vendido. Só muda o que a tela mandou (`templates` / `stores`, id -> sim/não).
 * Loja em "Todos os produtos" ou com modelo não é mexida aqui (o modelo é marcado direto).
 */
type Payload = { productId?: unknown; templates?: unknown; stores?: unknown };

function readToggles(value: unknown): Array<[string, boolean]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, boolean] => typeof entry[1] === "boolean" && entry[0].length > 0,
  );
}

export async function PUT(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "PUT /api/master-data/product-store-mix",
    permission: "gestor-dados.produtos",
    minimumLevel: "gerenciar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });
  if ("response" in authorization) return authorization.response;
  const tenantId = authorization.effectiveTenantId;
  if (!tenantId) return NextResponse.json({ message: "Escolha a empresa." }, { status: 400 });

  const payload = (await request.json().catch(() => null)) as Payload | null;
  const productId = typeof payload?.productId === "string" ? payload.productId.trim() : "";
  if (!productId) return NextResponse.json({ message: "Produto não informado." }, { status: 400 });
  const templateToggles = readToggles(payload?.templates);
  const storeToggles = readToggles(payload?.stores);
  if (templateToggles.length === 0 && storeToggles.length === 0) {
    return NextResponse.json({ ok: true, changed: 0 });
  }

  const supabase = createTenantScopedSupabaseClient(tenantId, createSupabaseAdminClient());
  const [templatesResult, storesResult] = await Promise.all([
    templateToggles.length > 0
      ? supabase
          .from("store_product_mix_templates")
          .select("id, name, product_ids")
          .in("id", templateToggles.map(([id]) => id))
      : Promise.resolve({ data: [], error: null }),
    storeToggles.length > 0
      ? supabase.from("stores").select("id, legacy_id, name, product_mix, product_mix_template_id")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (templatesResult.error || storesResult.error) {
    return NextResponse.json({ message: "Falha ao ler o mix das lojas." }, { status: 500 });
  }

  type TemplateRow = { id: string; name: string; product_ids: unknown };
  type StoreRow = { id: string; legacy_id: string | null; name: string; product_mix: unknown; product_mix_template_id: string | null };
  const templateRows = (templatesResult.data ?? []) as TemplateRow[];
  const storeRows = (storesResult.data ?? []) as StoreRow[];

  // Planeja tudo antes de gravar: se alguma lista ficaria vazia, nada é gravado.
  const templateUpdates: Array<{ id: string; productIds: string[] }> = [];
  for (const [id, include] of templateToggles) {
    const row = templateRows.find((entry) => entry.id === id);
    if (!row) return NextResponse.json({ message: "Modelo de mix não encontrado." }, { status: 404 });
    const current = normalizeStoreProductMix(row.product_ids) ?? [];
    if (current.includes(productId) === include) continue;
    const next = toggleProductInMixList(current, productId, include);
    if (!next) {
      return NextResponse.json(
        { message: `O modelo "${row.name}" ficaria sem produtos. Apague o modelo ou marque outro produto nele antes.` },
        { status: 409 },
      );
    }
    templateUpdates.push({ id, productIds: next });
  }

  const storeUpdates: Array<{ id: string; productMix: string[] }> = [];
  for (const [identifier, include] of storeToggles) {
    const row = storeRows.find((entry) => (entry.legacy_id ?? entry.id) === identifier || entry.id === identifier);
    if (!row) return NextResponse.json({ message: "Loja não encontrada." }, { status: 404 });
    const current = normalizeStoreProductMix(row.product_mix);
    if (row.product_mix_template_id || !current) {
      return NextResponse.json(
        { message: `A loja ${row.name} não usa lista própria de produtos. Ajuste o mix dela no cadastro da loja.` },
        { status: 409 },
      );
    }
    if (current.includes(productId) === include) continue;
    const next = toggleProductInMixList(current, productId, include);
    if (!next) {
      return NextResponse.json(
        { message: `A loja ${row.name} ficaria sem produtos. Ajuste o mix dela no cadastro da loja.` },
        { status: 409 },
      );
    }
    storeUpdates.push({ id: row.id, productMix: next });
  }

  const results = await Promise.all([
    ...templateUpdates.map((update) =>
      supabase.from("store_product_mix_templates").update({ product_ids: update.productIds }).eq("id", update.id),
    ),
    ...storeUpdates.map((update) =>
      supabase
        .from("stores")
        .update({ product_mix: update.productMix, updated_at: new Date().toISOString() })
        .eq("id", update.id),
    ),
  ]);
  const failed = results.find((result) => result.error);
  invalidateMasterDataCaches(tenantId);
  if (failed) {
    return NextResponse.json({ message: "Falha ao salvar o mix das lojas. Confira e tente de novo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, changed: templateUpdates.length + storeUpdates.length });
}
