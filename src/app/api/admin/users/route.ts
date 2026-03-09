import { NextResponse } from "next/server";

import type { UserFormState } from "@/lib/admin-users";
import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createManagedUser, listManagedUsers } from "@/lib/supabase-data/admin-users";

type CreateUserBody = UserFormState | null;

export async function GET() {
  const authorization = await authorizeApiRequest({
    permission: "administrador.usuarios",
    minimumLevel: "gerenciar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const users = await listManagedUsers({ supabase });
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
    permission: "administrador.usuarios",
    minimumLevel: "gerenciar",
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

  try {
    const supabase = await createSupabaseServerClient();
    const user = await createManagedUser(payload, { supabase });
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
