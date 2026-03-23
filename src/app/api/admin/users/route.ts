import { NextResponse } from "next/server";

import type { UserFormState } from "@/lib/admin-users";
import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createManagedUser, listManagedUsers } from "@/lib/supabase-data/admin-users";
import { isMasterRole } from "@/lib/tenant";

type CreateUserBody = UserFormState | null;

export async function GET() {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/admin/users",
    permission: "administrador.usuarios",
    minimumLevel: "gerenciar",
    requireTenantContext: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const users = await listManagedUsers({
      supabase,
      tenantId: authorization.effectiveTenantId,
    });
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load managed users",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/admin/users",
    permission: "administrador.usuarios",
    minimumLevel: "gerenciar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const payload = (await request.json().catch(() => null)) as CreateUserBody;

  if (!payload?.name?.trim() || !payload?.email?.trim()) {
    return NextResponse.json(
      { message: "Informe nome e e-mail para continuar." },
      { status: 400 },
    );
  }

  if (isMasterRole(payload.role)) {
    return NextResponse.json(
      { message: "O administrador do tenant não pode criar usuários master." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const user = await createManagedUser(payload, {
      supabase,
      tenantId: authorization.effectiveTenantId,
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to create managed user",
      },
      { status: 500 },
    );
  }
}
