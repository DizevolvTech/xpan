import { NextResponse } from "next/server";

import {
  applySavedListFilter,
  isValidListFilterPageKey,
  readSavedListFilters,
  sanitizeListFilterValue,
} from "@/lib/saved-list-filters";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Filtros padrão das listas do usuário logado (reunião 22/10, bloco 2).
 * GET devolve o mapa por página; PUT { pageKey, value | null } salva ou remove uma página.
 * O usuário só lê e grava o PRÓPRIO metadata (id vem da sessão validada, nunca do corpo).
 */
async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  return NextResponse.json(readSavedListFilters(user.user_metadata), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { pageKey?: unknown; value?: unknown } | null;
  if (!body || !isValidListFilterPageKey(body.pageKey)) {
    return NextResponse.json({ message: "Página inválida." }, { status: 400 });
  }
  const value = body.value === null ? null : sanitizeListFilterValue(body.value);
  if (body.value !== null && !value) {
    return NextResponse.json({ message: "Filtro inválido." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  // Lê o metadata atual no servidor de autenticação para não perder outras chaves.
  const current = await admin.auth.admin.getUserById(user.id);
  if (current.error || !current.data.user) {
    return NextResponse.json({ message: "Não foi possível ler o usuário." }, { status: 500 });
  }
  const metadata = (current.data.user.user_metadata ?? {}) as Record<string, unknown>;
  let next;
  try {
    next = applySavedListFilter(readSavedListFilters(metadata), body.pageKey, value);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Filtro inválido." }, { status: 400 });
  }
  const updated = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...metadata, list_filters: next },
  });
  if (updated.error) {
    return NextResponse.json({ message: "Não foi possível salvar o filtro." }, { status: 500 });
  }
  return NextResponse.json(next);
}
