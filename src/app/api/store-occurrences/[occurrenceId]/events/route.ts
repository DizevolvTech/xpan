import { NextResponse } from "next/server";

import { authorizeApiRequest, getAllowedStoreIds } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { addStoreOccurrenceComment } from "@/lib/supabase-data/store-occurrences";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

type RouteContext = {
  params: Promise<{
    occurrenceId: string;
  }>;
};

function isOccurrenceValidationError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("invalid") ||
    normalized.includes("cannot") ||
    normalized.includes("required") ||
    normalized.includes("empty")
  );
}

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/store-occurrences/[occurrenceId]/events",
    anyOfPermissions: ["loja.ocorrencias", "gestor-fabrica.ocorrencias"],
    minimumLevel: "operar",
    includeStoreScope: true,
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const { occurrenceId } = await context.params;
    const body = (await request.json()) as { content: string };
    const updated = await addStoreOccurrenceComment(
      {
        occurrenceId,
        content: body.content,
        createdByProfileId: authorization.user.id,
      },
      {
        allowedStoreIds: getAllowedStoreIds(authorization),
      },
      supabase,
    );

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create occurrence event";
    return NextResponse.json(
      { message },
      { status: isOccurrenceValidationError(message) ? 400 : message.includes("not found") ? 404 : 500 },
    );
  }
}
