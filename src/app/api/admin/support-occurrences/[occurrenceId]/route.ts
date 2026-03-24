import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getTenantSupportOccurrenceDetail,
  updateTenantSupportOccurrenceStatus,
} from "@/lib/supabase-data/tenant-support-occurrences";
import { isTenantSupportOccurrenceStatus } from "@/lib/tenant-support-occurrences";

type RouteContext = {
  params: Promise<{
    occurrenceId: string;
  }>;
};

function isValidationError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("reabrir") ||
    normalized.includes("fechamento") ||
    normalized.includes("transition") ||
    normalized.includes("not found")
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/admin/support-occurrences/[occurrenceId]",
    permission: "administrador.ocorrencias",
    minimumLevel: "visualizar",
    requireTenantContext: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const tenantId = authorization.effectiveTenantId;

  if (!tenantId) {
    return NextResponse.json(
      { message: "Selecione um cliente para acessar o canal." },
      { status: 403 },
    );
  }

  try {
    const { occurrenceId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const occurrence = await getTenantSupportOccurrenceDetail(occurrenceId, {
      supabase,
      tenantId,
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
    contextLabel: "PATCH /api/admin/support-occurrences/[occurrenceId]",
    permission: "administrador.ocorrencias",
    minimumLevel: "operar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const tenantId = authorization.effectiveTenantId;

  if (!tenantId) {
    return NextResponse.json(
      { message: "Selecione um cliente para acessar o canal." },
      { status: 403 },
    );
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
    const { occurrenceId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const updated = await updateTenantSupportOccurrenceStatus(
      occurrenceId,
      payload.status,
      {
        supabase,
        tenantId,
        actorProfileId: authorization.user.id,
        actorSide: "cliente",
      },
    );

    return NextResponse.json(updated);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível atualizar a ocorrência.";

    return NextResponse.json(
      { message },
      { status: isValidationError(message) ? 400 : 500 },
    );
  }
}
