import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import {
  buildCustomRecipeStageKey,
  isBuiltinRecipeStage,
  isCustomRecipeStage,
  recipeStageLabels,
} from "@/lib/production-planning";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { mapRecipeStageDefinitionRows } from "@/lib/supabase-data/master-data";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

/**
 * Cartão #173: cadastro das etapas da ficha técnica da empresa.
 * GET lista; POST cria etapa nova; PATCH renomeia / liga-desliga; DELETE apaga etapa sem uso.
 */
const columns = "id, key, label, base_stage, active, sort_order";

async function authorize(method: string, minimumLevel: "visualizar" | "gerenciar") {
  return authorizeApiRequest({
    contextLabel: `${method} /api/master-data/recipe-stages`,
    permission: "gestor-dados.produtos",
    minimumLevel,
    requireTenantContext: true,
    ...(minimumLevel === "gerenciar" ? { requireWritableTenant: true } : {}),
  });
}

function client(tenantId: string) {
  return createTenantScopedSupabaseClient(tenantId, createSupabaseAdminClient());
}

function cleanLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.replace(/\s+/g, " ").trim();
  return label.length >= 1 && label.length <= 60 ? label : null;
}

export async function GET() {
  const authorization = await authorize("GET", "visualizar");
  if ("response" in authorization) return authorization.response;
  if (!authorization.effectiveTenantId) return NextResponse.json({ message: "Escolha a empresa." }, { status: 400 });
  const { data, error } = await client(authorization.effectiveTenantId!)
    .from("recipe_stage_definitions")
    .select(columns)
    .eq("tenant_id", authorization.effectiveTenantId!)
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ message: "Falha ao listar as etapas." }, { status: 500 });
  return NextResponse.json(mapRecipeStageDefinitionRows(data ?? []), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const authorization = await authorize("POST", "gerenciar");
  if ("response" in authorization) return authorization.response;
  if (!authorization.effectiveTenantId) return NextResponse.json({ message: "Escolha a empresa." }, { status: 400 });
  const payload = (await request.json().catch(() => null)) as { name?: unknown; baseStage?: unknown } | null;
  const label = cleanLabel(payload?.name);
  if (!label) return NextResponse.json({ message: "Informe o nome da etapa (até 60 letras)." }, { status: 400 });
  if (!isBuiltinRecipeStage(payload?.baseStage)) {
    return NextResponse.json({ message: "Escolha como a etapa entra nos cálculos." }, { status: 400 });
  }
  const baseStage = payload.baseStage;
  if (Object.values(recipeStageLabels).some((builtin) => builtin.localeCompare(label, "pt-BR", { sensitivity: "base" }) === 0)) {
    return NextResponse.json({ message: "Já existe uma etapa padrão com este nome." }, { status: 409 });
  }
  const key = buildCustomRecipeStageKey(baseStage, label);
  if (!key) return NextResponse.json({ message: "Use letras ou números no nome da etapa." }, { status: 400 });
  const supabase = client(authorization.effectiveTenantId!);
  const { data: existing } = await supabase
    .from("recipe_stage_definitions")
    .select("sort_order")
    .eq("tenant_id", authorization.effectiveTenantId!)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSort = Number((existing?.[0] as { sort_order?: number } | undefined)?.sort_order ?? 0) + 1;
  const { data, error } = await supabase
    .from("recipe_stage_definitions")
    .insert({ tenant_id: authorization.effectiveTenantId!, key, label, base_stage: baseStage, sort_order: nextSort })
    .select(columns)
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ message: "Já existe uma etapa com este nome." }, { status: 409 });
    return NextResponse.json({ message: "Falha ao criar a etapa." }, { status: 500 });
  }
  invalidateMasterDataCaches(authorization.effectiveTenantId!);
  return NextResponse.json(mapRecipeStageDefinitionRows([data])[0], { status: 201 });
}

export async function PATCH(request: Request) {
  const authorization = await authorize("PATCH", "gerenciar");
  if ("response" in authorization) return authorization.response;
  if (!authorization.effectiveTenantId) return NextResponse.json({ message: "Escolha a empresa." }, { status: 400 });
  const payload = (await request.json().catch(() => null)) as
    | { key?: unknown; label?: unknown; active?: unknown }
    | null;
  const key = payload?.key;
  const supabase = client(authorization.effectiveTenantId!);
  const tenantId = authorization.effectiveTenantId!;

  if (isBuiltinRecipeStage(key)) {
    // Etapa padrão: só liga/desliga na lista de "Adicionar etapa"; o nome é fixo.
    if (typeof payload?.active !== "boolean") {
      return NextResponse.json({ message: "Etapa padrão: só dá para mostrar ou esconder." }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("recipe_stage_definitions")
      .upsert(
        { tenant_id: tenantId, key, label: recipeStageLabels[key], base_stage: key, active: payload.active },
        { onConflict: "tenant_id,key" },
      )
      .select(columns)
      .single();
    if (error) return NextResponse.json({ message: "Falha ao salvar a etapa." }, { status: 500 });
    invalidateMasterDataCaches(tenantId);
    return NextResponse.json(mapRecipeStageDefinitionRows([data])[0]);
  }

  if (!isCustomRecipeStage(key)) return NextResponse.json({ message: "Etapa não encontrada." }, { status: 404 });
  const update: Record<string, unknown> = {};
  if (payload?.label !== undefined) {
    const label = cleanLabel(payload.label);
    if (!label) return NextResponse.json({ message: "Informe o nome da etapa (até 60 letras)." }, { status: 400 });
    update.label = label;
  }
  if (typeof payload?.active === "boolean") update.active = payload.active;
  if (Object.keys(update).length === 0) return NextResponse.json({ message: "Nada para salvar." }, { status: 400 });
  const { data, error } = await supabase
    .from("recipe_stage_definitions")
    .update(update)
    .eq("tenant_id", tenantId)
    .eq("key", key)
    .select(columns)
    .maybeSingle();
  if (error) return NextResponse.json({ message: "Falha ao salvar a etapa." }, { status: 500 });
  if (!data) return NextResponse.json({ message: "Etapa não encontrada." }, { status: 404 });
  invalidateMasterDataCaches(tenantId);
  return NextResponse.json(mapRecipeStageDefinitionRows([data])[0]);
}

export async function DELETE(request: Request) {
  const authorization = await authorize("DELETE", "gerenciar");
  if ("response" in authorization) return authorization.response;
  if (!authorization.effectiveTenantId) return NextResponse.json({ message: "Escolha a empresa." }, { status: 400 });
  const key = new URL(request.url).searchParams.get("key");
  if (!isCustomRecipeStage(key)) {
    return NextResponse.json({ message: "Só etapas cadastradas podem ser apagadas." }, { status: 400 });
  }
  const tenantId = authorization.effectiveTenantId!;
  const supabase = client(tenantId);
  const [{ data: usedItems, error: itemsError }, { data: configured, error: configError }] = await Promise.all([
    supabase
      .from("product_recipe_items")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("stage", key)
      .limit(1),
    supabase
      .from("products")
      .select("id")
      .eq("tenant_id", tenantId)
      // jsonb: o filtro "contém" precisa do JSON como texto (array de objetos).
      .filter("recipe_stage_config", "cs", JSON.stringify([{ stage: key }]))
      .limit(1),
  ]);
  if (itemsError || configError) {
    console.error("recipe-stages DELETE: falha ao conferir o uso", itemsError ?? configError);
    return NextResponse.json(
      { message: "Falha ao conferir o uso da etapa.", detail: (itemsError ?? configError)?.message ?? null },
      { status: 500 },
    );
  }
  if ((usedItems?.length ?? 0) > 0 || (configured?.length ?? 0) > 0) {
    return NextResponse.json(
      { message: "A etapa está em uso em fichas técnicas. Desative-a para não aparecer mais como opção." },
      { status: 409 },
    );
  }
  const { error } = await supabase.from("recipe_stage_definitions").delete().eq("tenant_id", tenantId).eq("key", key);
  if (error) return NextResponse.json({ message: "Falha ao apagar a etapa." }, { status: 500 });
  invalidateMasterDataCaches(tenantId);
  return new NextResponse(null, { status: 204 });
}
