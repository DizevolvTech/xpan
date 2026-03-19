import { NextResponse } from "next/server";

import { authorizeApiRequest, getAllowedStoreIds } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createStoreOccurrence, listStoreOccurrences } from "@/lib/supabase-data/store-occurrences";

function resolveScopedStoreIds(
  allowedStoreIds: string[] | null | undefined,
  requestedStoreId?: string,
) {
  if (!requestedStoreId) {
    return allowedStoreIds;
  }

  if (!allowedStoreIds || allowedStoreIds.length === 0) {
    return [requestedStoreId];
  }

  return allowedStoreIds.includes(requestedStoreId) ? [requestedStoreId] : [];
}

function isOccurrenceValidationError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("can only be opened") ||
    normalized.includes("invalid") ||
    normalized.includes("not found") ||
    normalized.includes("does not belong") ||
    normalized.includes("does not match") ||
    normalized.includes("required") ||
    normalized.includes("cannot") ||
    normalized.includes("at least")
  );
}

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/store-occurrences",
    anyOfPermissions: ["loja.ocorrencias", "gestor-fabrica.ocorrencias"],
    minimumLevel: "visualizar",
    includeStoreScope: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("storeId") ?? undefined;
    const allowedStoreIds = getAllowedStoreIds(authorization.user);
    const occurrences = await listStoreOccurrences({
      allowedStoreIds: resolveScopedStoreIds(allowedStoreIds, storeId),
    }, supabase);
    return NextResponse.json(occurrences);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load store occurrences",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/store-occurrences",
    permission: "loja.ocorrencias",
    minimumLevel: "operar",
    includeStoreScope: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const body = (await request.json()) as Parameters<typeof createStoreOccurrence>[0];
    const occurrence = await createStoreOccurrence(
      {
        ...body,
        openedByProfileId: authorization.user.id,
      },
      {
        allowedStoreIds: getAllowedStoreIds(authorization.user),
      },
    );
    return NextResponse.json(occurrence, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Authenticated store does not have access to this order") {
      return NextResponse.json(
        { message: "O usuário autenticado não tem acesso ao pedido informado." },
        { status: 403 },
      );
    }

    const message = error instanceof Error ? error.message : "Failed to create store occurrence";

    return NextResponse.json(
      {
        message,
      },
      { status: isOccurrenceValidationError(message) ? 400 : 500 },
    );
  }
}
