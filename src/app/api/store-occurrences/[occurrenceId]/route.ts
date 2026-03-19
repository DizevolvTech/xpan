import { NextResponse } from "next/server";

import { authorizeApiRequest, getAllowedStoreIds } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  getStoreOccurrenceDetail,
  updateStoreOccurrenceStatus,
} from "@/lib/supabase-data/store-occurrences";

type RouteContext = {
  params: Promise<{
    occurrenceId: string;
  }>;
};

function resolveActorRole(role: string) {
  if (role === "administrador") {
    return "administrador" as const;
  }

  if (role === "gestor-fabrica") {
    return "gestor-fabrica" as const;
  }

  return "loja" as const;
}

function isOccurrenceValidationError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("invalid") ||
    normalized.includes("cannot") ||
    normalized.includes("at least") ||
    normalized.includes("required")
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/store-occurrences/[occurrenceId]",
    anyOfPermissions: ["loja.ocorrencias", "gestor-fabrica.ocorrencias"],
    minimumLevel: "visualizar",
    includeStoreScope: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { occurrenceId } = await context.params;
    const detail = await getStoreOccurrenceDetail(
      occurrenceId,
      {
        allowedStoreIds: getAllowedStoreIds(authorization.user),
      },
      supabase,
    );

    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load store occurrence";
    return NextResponse.json({ message }, { status: message.includes("not found") ? 404 : 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel: "PATCH /api/store-occurrences/[occurrenceId]",
    anyOfPermissions: ["loja.ocorrencias", "gestor-fabrica.ocorrencias"],
    minimumLevel: "operar",
    includeStoreScope: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { occurrenceId } = await context.params;
    const body = (await request.json()) as { status: "aberta" | "em_analise" | "resolvida" | "fechada" };
    const updated = await updateStoreOccurrenceStatus(
      {
        occurrenceId,
        status: body.status,
        actorRole: resolveActorRole(authorization.user.role),
        updatedByProfileId: authorization.user.id,
      },
      {
        allowedStoreIds: getAllowedStoreIds(authorization.user),
      },
      supabase,
    );

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update store occurrence";
    return NextResponse.json(
      { message },
      { status: isOccurrenceValidationError(message) ? 400 : message.includes("not found") ? 404 : 500 },
    );
  }
}
