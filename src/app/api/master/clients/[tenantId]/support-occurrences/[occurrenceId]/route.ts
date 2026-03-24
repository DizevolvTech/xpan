import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getTenantByIdentifier } from "@/lib/supabase-data/tenants";
import {
  getTenantSupportOccurrenceDetail,
  updateTenantSupportOccurrenceStatus,
} from "@/lib/supabase-data/tenant-support-occurrences";
import { isTenantSupportOccurrenceStatus } from "@/lib/tenant-support-occurrences";
import { isMasterRole } from "@/lib/tenant";

type RouteContext = {
  params: Promise<{
    tenantId: string;
    occurrenceId: string;
  }>;
};

function buildMasterOnlyResponse() {
  return NextResponse.json(
    { message: "Apenas o administrador master pode acessar este recurso." },
    { status: 403 },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel:
      "GET /api/master/clients/[tenantId]/support-occurrences/[occurrenceId]",
    permission: "administrador-master.clientes",
    minimumLevel: "visualizar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  if (!isMasterRole(authorization.actorRole)) {
    return buildMasterOnlyResponse();
  }

  try {
    const { tenantId, occurrenceId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const tenant = await getTenantByIdentifier(tenantId, { supabase });

    if (!tenant) {
      return NextResponse.json(
        { message: "Cliente não encontrado." },
        { status: 404 },
      );
    }

    const occurrence = await getTenantSupportOccurrenceDetail(occurrenceId, {
      supabase,
      tenantId: tenant.id,
    });
    return NextResponse.json(occurrence);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível carregar a ocorrência.";

    return NextResponse.json(
      { message },
      { status: message === "Occurrence not found" ? 404 : 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel:
      "PATCH /api/master/clients/[tenantId]/support-occurrences/[occurrenceId]",
    permission: "administrador-master.clientes",
    minimumLevel: "gerenciar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  if (!isMasterRole(authorization.actorRole)) {
    return buildMasterOnlyResponse();
  }

  const payload = (await request.json().catch(() => null)) as {
    status?: unknown;
  } | null;

  if (!isTenantSupportOccurrenceStatus(payload?.status)) {
    return NextResponse.json(
      { message: "Informe um status válido para a ocorrência." },
      { status: 400 },
    );
  }

  try {
    const { tenantId, occurrenceId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const tenant = await getTenantByIdentifier(tenantId, { supabase });

    if (!tenant) {
      return NextResponse.json(
        { message: "Cliente não encontrado." },
        { status: 404 },
      );
    }

    const updated = await updateTenantSupportOccurrenceStatus(
      occurrenceId,
      payload.status,
      {
        supabase,
        tenantId: tenant.id,
        actorProfileId: authorization.user.id,
        actorSide: "master",
      },
    );
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar a ocorrência.",
      },
      { status: 500 },
    );
  }
}
