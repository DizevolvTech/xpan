import { NextRequest, NextResponse } from "next/server";

import { resolveLandingPath } from "@/lib/permission-modules";
import {
  findManagedUserByAuthUserId,
} from "@/lib/supabase-data/admin-users";
import { createSupabaseRequestClient } from "@/lib/supabase-request-client";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as LoginBody | null;

  if (!payload?.email || !payload?.password) {
    return NextResponse.json(
      { message: "Informe e-mail e senha." },
      { status: 400 },
    );
  }

  const normalizedEmail = payload.email.trim().toLowerCase();
  const { supabase, applyResponseCookies } = createSupabaseRequestClient(request);
  const signInResult = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: payload.password,
  });

  if (signInResult.error || !signInResult.data.user) {
    return applyResponseCookies(
      NextResponse.json(
        {
          message: signInResult.error?.message ?? "Credenciais inválidas.",
        },
        { status: 401 },
      ),
    );
  }

  const managedUser = await findManagedUserByAuthUserId(signInResult.data.user.id, {
    supabase,
  });

  if (!managedUser) {
    await supabase.auth.signOut();

    return applyResponseCookies(
      NextResponse.json(
        { message: "Usuário autenticado, mas sem cadastro operacional válido." },
        { status: 403 },
      ),
    );
  }

  if (managedUser.status !== "ativo") {
    await supabase.auth.signOut();

    return applyResponseCookies(
      NextResponse.json(
        { message: "Usuário autenticado, mas o cadastro está inativo." },
        { status: 403 },
      ),
    );
  }

  const response = NextResponse.json({
    user: {
      role: managedUser.role,
      email: managedUser.email,
      name: managedUser.name,
    },
    redirectTo: resolveLandingPath(managedUser.permissions, managedUser.role),
  });

  return applyResponseCookies(response);
}
