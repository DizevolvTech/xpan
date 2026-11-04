import "server-only";

import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

import type { LooseClient } from "./server";

/**
 * Cartão #241: só administrador e master levam cadastros de um ambiente para outro, além da
 * permissão de gerenciar produtos. Gestor de fábrica/loja recebem 403 mesmo chamando a API direto.
 */
export async function authorizeCatalogTransfer(label: string, write: boolean) {
  const authorization = await authorizeApiRequest({
    contextLabel: label,
    permission: "gestor-dados.produtos",
    minimumLevel: "gerenciar",
    requireTenantContext: true,
    ...(write ? { requireWritableTenant: true } : {}),
  });
  if ("response" in authorization) return authorization;
  if (authorization.actorRole !== "administrador" && authorization.actorRole !== "administrador-master") {
    return {
      response: NextResponse.json(
        { message: "Só administrador pode exportar ou importar cadastros." },
        { status: 403 },
      ),
    };
  }
  const tenantId = authorization.effectiveTenantId;
  if (!tenantId) {
    return { response: NextResponse.json({ message: "Escolha a empresa." }, { status: 400 }) };
  }
  const client = createTenantScopedSupabaseClient(tenantId, createSupabaseAdminClient()) as unknown as LooseClient;
  return { authorization, tenantId, client };
}
