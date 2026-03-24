import { NextResponse } from "next/server";

import type { UserFormState } from "@/lib/admin-users";
import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  createManagedUser,
  listManagedUsers,
} from "@/lib/supabase-data/admin-users";
import { getTenantByIdentifier } from "@/lib/supabase-data/tenants";
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

export async function GET(_request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/master/clients/[tenantId]/users",
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

    const users = await listManagedUsers({
      supabase,
      tenantId: tenant.id,
    });
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os usuários do cliente.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/master/clients/[tenantId]/users",
    permission: "administrador-master.clientes",
    minimumLevel: "gerenciar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  if (!isMasterRole(authorization.actorRole)) {
    return buildMasterOnlyResponse();
  }

  const payload = (await request.json().catch(() => null)) as UserFormState | null;

  if (!payload?.name?.trim() || !payload?.email?.trim()) {
    return NextResponse.json(
      { message: "Informe nome e e-mail para continuar." },
      { status: 400 },
    );
  }

  if (isMasterRole(payload.role)) {
    return NextResponse.json(
      { message: "O administrador master não deve ser criado dentro de um cliente." },
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

    const createdUser = await createManagedUser(payload, {
      supabase,
      tenantId: tenant.id,
    });
    return NextResponse.json(createdUser, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível criar o usuário do cliente.",
      },
      { status: 500 },
    );
  }
}
