import { NextResponse } from "next/server";

import type { ManagedUserProfileInput, UserFormState } from "@/lib/admin-users";
import { authorizeApiRequest } from "@/lib/api-auth";
import type { PermissionMap } from "@/lib/permission-modules";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  saveManagedUserPermissions,
  saveManagedUserProfile,
  updateManagedUser,
} from "@/lib/supabase-data/admin-users";
import { getTenantByIdentifier } from "@/lib/supabase-data/tenants";
import { isMasterRole } from "@/lib/tenant";

type UpdateUserBody =
  | {
      kind: "user";
      user: UserFormState;
      resetPermissionsToRoleDefault?: boolean;
    }
  | {
      kind: "permissions";
      permissions: PermissionMap;
    }
  | {
      kind: "profile";
      profile: ManagedUserProfileInput;
    };

type RouteContext = {
  params: Promise<{
    tenantId: string;
    userId: string;
  }>;
};

function buildMasterOnlyResponse() {
  return NextResponse.json(
    { message: "Apenas o administrador master pode acessar este recurso." },
    { status: 403 },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel: "PATCH /api/master/clients/[tenantId]/users/[userId]",
    permission: "administrador-master.clientes",
    minimumLevel: "gerenciar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  if (!isMasterRole(authorization.actorRole)) {
    return buildMasterOnlyResponse();
  }

  const { tenantId, userId } = await context.params;
  const payload = (await request.json().catch(() => null)) as UpdateUserBody | null;

  if (!payload) {
    return NextResponse.json({ message: "Payload inválido." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const tenant = await getTenantByIdentifier(tenantId, { supabase });

    if (!tenant) {
      return NextResponse.json(
        { message: "Cliente não encontrado." },
        { status: 404 },
      );
    }

    if (payload.kind === "user") {
      if (!payload.user.name.trim() || !payload.user.email.trim()) {
        return NextResponse.json(
          { message: "Informe nome e e-mail para continuar." },
          { status: 400 },
        );
      }

      if (isMasterRole(payload.user.role)) {
        return NextResponse.json(
          { message: "Usuários master não podem ser vinculados a um cliente." },
          { status: 400 },
        );
      }

      const user = await updateManagedUser(
        userId,
        {
          ...payload.user,
          resetPermissionsToRoleDefault: payload.resetPermissionsToRoleDefault,
        },
        {
          supabase,
          tenantId: tenant.id,
        },
      );

      return NextResponse.json(user);
    }

    if (payload.kind === "permissions") {
      const user = await saveManagedUserPermissions(userId, payload.permissions, {
        supabase,
        tenantId: tenant.id,
      });
      return NextResponse.json(user);
    }

    const user = await saveManagedUserProfile(userId, payload.profile, {
      supabase,
      tenantId: tenant.id,
    });
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o usuário do cliente.",
      },
      { status: 500 },
    );
  }
}
