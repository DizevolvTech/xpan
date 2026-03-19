import { NextResponse } from "next/server";

import type {
  ManagedUserProfileInput,
  UserFormState,
} from "@/lib/admin-users";
import { authorizeApiRequest } from "@/lib/api-auth";
import type { PermissionMap } from "@/lib/permission-modules";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  saveManagedUserPermissions,
  saveManagedUserProfile,
  updateManagedUser,
} from "@/lib/supabase-data/admin-users";

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
    userId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel: "PATCH /api/admin/users/[userId]",
    permission: "administrador.usuarios",
    minimumLevel: "gerenciar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const { userId } = await context.params;
  const payload = (await request.json().catch(() => null)) as UpdateUserBody | null;

  if (!payload) {
    return NextResponse.json(
      { message: "Payload inválido." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();

    if (payload.kind === "user") {
      if (!payload.user.name.trim() || !payload.user.email.trim()) {
        return NextResponse.json(
          { message: "Informe nome e e-mail para continuar." },
          { status: 400 },
        );
      }

      const user = await updateManagedUser(userId, {
        ...payload.user,
        resetPermissionsToRoleDefault: payload.resetPermissionsToRoleDefault,
      }, { supabase });
      return NextResponse.json(user);
    }

    if (payload.kind === "permissions") {
      const user = await saveManagedUserPermissions(userId, payload.permissions, { supabase });
      return NextResponse.json(user);
    }

    if (!payload.profile.phone.trim()) {
      return NextResponse.json(
        { message: "Informe o telefone do usuário." },
        { status: 400 },
      );
    }

    const user = await saveManagedUserProfile(userId, payload.profile, { supabase });
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to update managed user",
      },
      { status: 500 },
    );
  }
}
