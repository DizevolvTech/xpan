import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getTenantByIdentifier } from "@/lib/supabase-data/tenants";
import { addTenantSupportOccurrenceComment } from "@/lib/supabase-data/tenant-support-occurrences";
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

function isValidationError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("mensagem") ||
    normalized.includes("fechado") ||
    normalized.includes("reabra")
  );
}

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel:
      "POST /api/master/clients/[tenantId]/support-occurrences/[occurrenceId]/events",
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
    content?: unknown;
  } | null;

  if (typeof payload?.content !== "string") {
    return NextResponse.json(
      { message: "Informe a mensagem para continuar." },
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

    const updated = await addTenantSupportOccurrenceComment(
      occurrenceId,
      payload.content,
      {
        supabase,
        tenantId: tenant.id,
        actorProfileId: authorization.user.id,
        actorSide: "master",
      },
    );
    return NextResponse.json(updated);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível registrar a mensagem.";

    return NextResponse.json(
      { message },
      { status: isValidationError(message) ? 400 : 500 },
    );
  }
}
