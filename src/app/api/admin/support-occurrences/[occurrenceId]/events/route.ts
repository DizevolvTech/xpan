import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { addTenantSupportOccurrenceComment } from "@/lib/supabase-data/tenant-support-occurrences";

type RouteContext = {
  params: Promise<{
    occurrenceId: string;
  }>;
};

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
    contextLabel: "POST /api/admin/support-occurrences/[occurrenceId]/events",
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
    content?: unknown;
  } | null;

  if (typeof payload?.content !== "string") {
    return NextResponse.json(
      { message: "Informe a mensagem para continuar." },
      { status: 400 },
    );
  }

  try {
    const { occurrenceId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const updated = await addTenantSupportOccurrenceComment(
      occurrenceId,
      payload.content,
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
        : "Não foi possível registrar a mensagem.";

    return NextResponse.json(
      { message },
      { status: isValidationError(message) ? 400 : 500 },
    );
  }
}
