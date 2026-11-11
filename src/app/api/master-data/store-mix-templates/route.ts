import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import {
  cleanStoreProductMixTemplateName,
  mapStoreProductMixTemplateRows,
  normalizeStoreProductMix,
} from "@/lib/store-product-mix";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

/**
 * Cartão #602: modelos de mix de produtos (lista de produtos usada por várias lojas).
 * GET lista; POST cria; PATCH renomeia / troca os produtos; DELETE apaga modelo sem loja.
 * Trocar os produtos de um modelo muda na hora o que as lojas dele veem nos lotes.
 */
const columns = "id, name, product_ids";
const TABLE = "store_product_mix_templates";

async function authorize(method: string, minimumLevel: "visualizar" | "gerenciar") {
  return authorizeApiRequest({
    contextLabel: `${method} /api/master-data/store-mix-templates`,
    permission: "gestor-dados.lojas",
    minimumLevel,
    requireTenantContext: true,
    ...(minimumLevel === "gerenciar" ? { requireWritableTenant: true } : {}),
  });
}

function client(tenantId: string) {
  return createTenantScopedSupabaseClient(tenantId, createSupabaseAdminClient());
}

function readProducts(value: unknown) {
  return normalizeStoreProductMix(value);
}

function duplicateName() {
  return NextResponse.json({ message: "Já existe um modelo com este nome." }, { status: 409 });
}

export async function GET() {
  const authorization = await authorize("GET", "visualizar");
  if ("response" in authorization) return authorization.response;
  const tenantId = authorization.effectiveTenantId;
  if (!tenantId) return NextResponse.json({ message: "Escolha a empresa." }, { status: 400 });
  const { data, error } = await client(tenantId).from(TABLE).select(columns).eq("tenant_id", tenantId);
  if (error) return NextResponse.json({ message: "Falha ao listar os modelos de mix." }, { status: 500 });
  return NextResponse.json(mapStoreProductMixTemplateRows(data ?? []), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const authorization = await authorize("POST", "gerenciar");
  if ("response" in authorization) return authorization.response;
  const tenantId = authorization.effectiveTenantId;
  if (!tenantId) return NextResponse.json({ message: "Escolha a empresa." }, { status: 400 });
  const payload = (await request.json().catch(() => null)) as { name?: unknown; productIds?: unknown } | null;
  const name = cleanStoreProductMixTemplateName(payload?.name);
  if (!name) return NextResponse.json({ message: "Informe o nome do modelo (até 60 letras)." }, { status: 400 });
  const productIds = readProducts(payload?.productIds);
  if (!productIds) return NextResponse.json({ message: "Marque ao menos um produto no modelo." }, { status: 400 });
  const { data, error } = await client(tenantId)
    .from(TABLE)
    .insert({ tenant_id: tenantId, name, product_ids: productIds })
    .select(columns)
    .single();
  if (error) {
    if (error.code === "23505") return duplicateName();
    return NextResponse.json({ message: "Falha ao criar o modelo de mix." }, { status: 500 });
  }
  invalidateMasterDataCaches(tenantId);
  return NextResponse.json(mapStoreProductMixTemplateRows([data])[0], { status: 201 });
}

export async function PATCH(request: Request) {
  const authorization = await authorize("PATCH", "gerenciar");
  if ("response" in authorization) return authorization.response;
  const tenantId = authorization.effectiveTenantId;
  if (!tenantId) return NextResponse.json({ message: "Escolha a empresa." }, { status: 400 });
  const payload = (await request.json().catch(() => null)) as
    | { id?: unknown; name?: unknown; productIds?: unknown }
    | null;
  if (typeof payload?.id !== "string" || !payload.id) {
    return NextResponse.json({ message: "Modelo não encontrado." }, { status: 404 });
  }
  const update: Record<string, unknown> = {};
  if (payload.name !== undefined) {
    const name = cleanStoreProductMixTemplateName(payload.name);
    if (!name) return NextResponse.json({ message: "Informe o nome do modelo (até 60 letras)." }, { status: 400 });
    update.name = name;
  }
  if (payload.productIds !== undefined) {
    const productIds = readProducts(payload.productIds);
    if (!productIds) return NextResponse.json({ message: "Marque ao menos um produto no modelo." }, { status: 400 });
    update.product_ids = productIds;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ message: "Nada para salvar." }, { status: 400 });
  const { data, error } = await client(tenantId)
    .from(TABLE)
    .update(update)
    .eq("id", payload.id)
    .select(columns)
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return duplicateName();
    return NextResponse.json({ message: "Falha ao salvar o modelo de mix." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ message: "Modelo não encontrado." }, { status: 404 });
  invalidateMasterDataCaches(tenantId);
  return NextResponse.json(mapStoreProductMixTemplateRows([data])[0]);
}

export async function DELETE(request: Request) {
  const authorization = await authorize("DELETE", "gerenciar");
  if ("response" in authorization) return authorization.response;
  const tenantId = authorization.effectiveTenantId;
  if (!tenantId) return NextResponse.json({ message: "Escolha a empresa." }, { status: 400 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ message: "Modelo não encontrado." }, { status: 404 });
  const supabase = client(tenantId);
  const { data: usedBy, error: usageError } = await supabase
    .from("stores")
    .select("name")
    .eq("product_mix_template_id", id)
    .order("name", { ascending: true });
  if (usageError) return NextResponse.json({ message: "Falha ao conferir as lojas do modelo." }, { status: 500 });
  if ((usedBy?.length ?? 0) > 0) {
    const names = (usedBy ?? []).map((row) => String((row as { name?: unknown }).name ?? "")).join(", ");
    return NextResponse.json(
      { message: `O modelo está em uso nas lojas: ${names}. Troque o mix dessas lojas antes de apagar.` },
      { status: 409 },
    );
  }
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) return NextResponse.json({ message: "Falha ao apagar o modelo de mix." }, { status: 500 });
  invalidateMasterDataCaches(tenantId);
  return new NextResponse(null, { status: 204 });
}
