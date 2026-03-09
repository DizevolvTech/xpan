import { NextResponse } from "next/server";

import type { ManagedUserProfileInput } from "@/lib/admin-users";
import { resolveCurrentManagedUser } from "@/lib/server-session";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { saveManagedUserProfile } from "@/lib/supabase-data/admin-users";

type CurrentProfileResponse = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  phone: string;
  address: ManagedUserProfileInput["address"];
  passwordUpdatedAt: string;
};

function buildProfileResponse(user: NonNullable<Awaited<ReturnType<typeof resolveCurrentManagedUser>>>): CurrentProfileResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.profile.avatarUrl,
    phone: user.profile.phone,
    address: user.profile.address,
    passwordUpdatedAt: user.profile.passwordUpdatedAt,
  };
}

export async function GET() {
  try {
    const user = await resolveCurrentManagedUser();

    if (!user) {
      return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
    }

    return NextResponse.json(buildProfileResponse(user));
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load current profile",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const payload = (await request.json().catch(() => null)) as ManagedUserProfileInput | null;

  if (!payload?.name?.trim() || !payload?.email?.trim() || !payload.phone.trim()) {
    return NextResponse.json(
      { message: "Informe nome, e-mail e telefone para continuar." },
      { status: 400 },
    );
  }

  if (
    !payload.address.street.trim() ||
    !payload.address.number.trim() ||
    !payload.address.neighborhood.trim() ||
    !payload.address.city.trim() ||
    !payload.address.state.trim()
  ) {
    return NextResponse.json(
      { message: "Preencha rua, número, bairro, cidade e UF para salvar o endereço." },
      { status: 400 },
    );
  }

  try {
    const user = await resolveCurrentManagedUser();

    if (!user) {
      return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const updatedUser = await saveManagedUserProfile(user.id, payload, { supabase });
    return NextResponse.json(buildProfileResponse(updatedUser));
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to update current profile",
      },
      { status: 500 },
    );
  }
}
