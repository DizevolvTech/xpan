import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getTenantByIdentifier,
  updateTenantStatus,
} from "@/lib/supabase-data/tenants";
import { isMasterRole } from "@/lib/tenant";

type RouteContext = {
  params: Promise<{
    tenantId: string;
  }>;
};

function buildMasterOnlyResponse() {
  return NextResponse.json(
    { message: "Apenas o administrador master pode acessar este recurso." },
    { status: 403 },
  );
}

function isRecordStatus(value: unknown): value is "ativo" | "inativo" {
  return value === "ativo" || value === "inativo";
}

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    permission: "administrador-master.clientes",
    minimumLevel: "gerenciar",
    contextLabel: "master.clients.update",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  if (!isMasterRole(authorization.actorRole)) {
    return buildMasterOnlyResponse();
  }

  const { tenantId } = await context.params;
  const payload = (await request.json().catch(() => null)) as {
    status?: unknown;
  } | null;

  if (!isRecordStatus(payload?.status)) {
    return NextResponse.json(
      { message: "Informe um status válido para o cliente." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const tenant = await getTenantByIdentifier(tenantId, { supabase });

    if (!tenant) {
      return NextResponse.json(
        { message: "Cliente não encontrado." },
        { status: 404 },
      );
    }

    const updatedTenant = await updateTenantStatus(tenant.id, payload.status, {
      supabase,
    });
    return NextResponse.json(updatedTenant);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o status do cliente.",
      },
      { status: 500 },
    );
  }
}
