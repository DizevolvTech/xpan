import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/master-data/line-types",
    permission: "gestor-dados.linhas",
    minimumLevel: "visualizar",
    requireTenantContext: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const supabase = createTenantScopedSupabaseClient(
    authorization.effectiveTenantId,
    createSupabaseAdminClient(),
  );

  const { data, error } = await supabase
    .from("production_line_types")
    .select("id, name, status, sort_order")
    .eq("tenant_id", authorization.effectiveTenantId)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ message: "Falha ao listar tipos." }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/master-data/line-types",
    permission: "gestor-dados.linhas",
    minimumLevel: "gerenciar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const payload = (await request.json().catch(() => null)) as { name?: string } | null;

  if (!payload?.name?.trim()) {
    return NextResponse.json({ message: "Informe o nome do tipo." }, { status: 400 });
  }

  const supabase = createTenantScopedSupabaseClient(
    authorization.effectiveTenantId,
    createSupabaseAdminClient(),
  );

  const { data, error } = await supabase
    .from("production_line_types")
    .insert({ name: payload.name.trim(), tenant_id: authorization.effectiveTenantId })
    .select("id, name")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ message: "Já existe um tipo com este nome." }, { status: 409 });
    }
    return NextResponse.json({ message: "Falha ao criar tipo." }, { status: 500 });
  }

  invalidateMasterDataCaches(authorization.effectiveTenantId);
  return NextResponse.json(data, { status: 201 });
}
