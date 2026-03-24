import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getTenantByIdentifier } from "@/lib/supabase-data/tenants";
import {
  createTenantSupportOccurrence,
  listTenantSupportOccurrences,
} from "@/lib/supabase-data/tenant-support-occurrences";
import {
  isTenantSupportOccurrenceCategory,
  isTenantSupportOccurrencePriority,
  type CreateTenantSupportOccurrenceInput,
} from "@/lib/tenant-support-occurrences";
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
    normalized.includes("descreva")
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/master/clients/[tenantId]/support-occurrences",
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
    const { tenantId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const tenant = await getTenantByIdentifier(tenantId, { supabase });

    if (!tenant) {
      return NextResponse.json(
        { message: "Cliente não encontrado." },
        { status: 404 },
      );
    }

    const occurrences = await listTenantSupportOccurrences({
      supabase,
      tenantId: tenant.id,
    });
    return NextResponse.json(occurrences);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o canal do cliente.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/master/clients/[tenantId]/support-occurrences",
    permission: "administrador-master.clientes",
    minimumLevel: "gerenciar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  if (!isMasterRole(authorization.actorRole)) {
    return buildMasterOnlyResponse();
  }

  const payload = normalizeCreatePayload(await request.json().catch(() => null));

  if (!payload) {
    return NextResponse.json(
      { message: "Informe assunto, categoria, prioridade e descrição." },
      { status: 400 },
    );
  }

  try {
    const { tenantId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const tenant = await getTenantByIdentifier(tenantId, { supabase });

    if (!tenant) {
      return NextResponse.json(
        { message: "Cliente não encontrado." },
        { status: 404 },
      );
    }

    const occurrence = await createTenantSupportOccurrence(payload, {
      supabase,
      tenantId: tenant.id,
      actorProfileId: authorization.user.id,
      actorSide: "master",
    });
    return NextResponse.json(occurrence, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível abrir a ocorrência do cliente.";

    return NextResponse.json(
      { message },
      { status: isValidationError(message) ? 400 : 500 },
    );
  }
}
