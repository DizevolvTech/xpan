import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  createTenantSupportOccurrence,
  listTenantSupportOccurrences,
} from "@/lib/supabase-data/tenant-support-occurrences";
import {
  isTenantSupportOccurrenceCategory,
  isTenantSupportOccurrencePriority,
  type CreateTenantSupportOccurrenceInput,
} from "@/lib/tenant-support-occurrences";

function normalizeCreatePayload(
  payload: unknown,
): CreateTenantSupportOccurrenceInput | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as {
    title?: unknown;
    category?: unknown;
    priority?: unknown;
    description?: unknown;
  };

  if (
    typeof candidate.title !== "string" ||
    typeof candidate.description !== "string" ||
    !isTenantSupportOccurrenceCategory(candidate.category) ||
    !isTenantSupportOccurrencePriority(candidate.priority)
  ) {
    return null;
  }

  return {
    title: candidate.title,
    category: candidate.category,
    priority: candidate.priority,
    description: candidate.description,
  };
}

function isValidationError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("ocorrência") ||
    normalized.includes("contexto") ||
    normalized.includes("assunto") ||
    normalized.includes("descreva") ||
    normalized.includes("mensagem") ||
    normalized.includes("required") ||
    normalized.includes("not found")
  );
}

export async function GET() {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/admin/support-occurrences",
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
    const supabase = createSupabaseAdminClient();
    const occurrences = await listTenantSupportOccurrences({
      supabase,
      tenantId,
    });
    return NextResponse.json(occurrences);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o canal de ocorrências.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/admin/support-occurrences",
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

  const payload = normalizeCreatePayload(await request.json().catch(() => null));

  if (!payload) {
    return NextResponse.json(
      { message: "Informe assunto, categoria, prioridade e descrição." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const occurrence = await createTenantSupportOccurrence(payload, {
      supabase,
      tenantId,
      actorProfileId: authorization.user.id,
      actorSide: "cliente",
    });
    return NextResponse.json(occurrence, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível abrir a ocorrência.";

    return NextResponse.json(
      { message },
      { status: isValidationError(message) ? 400 : 500 },
    );
  }
}
