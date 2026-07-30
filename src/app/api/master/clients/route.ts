import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import {
  isMasterClientAdminEmailConflictMessage,
  type CreateMasterClientPayload,
} from "@/lib/master-clients";
import { createTenantWithAdmin, listMasterClients } from "@/lib/supabase-data/tenants";
import { isMasterRole } from "@/lib/tenant";

function buildMasterOnlyResponse() {
  return NextResponse.json(
    { message: "Apenas o administrador master pode acessar este recurso." },
    { status: 403 },
  );
}

function isRecordStatus(value: unknown): value is "ativo" | "inativo" {
  return value === "ativo" || value === "inativo";
}

function normalizePayload(payload: unknown): CreateMasterClientPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as {
    tenant?: { name?: unknown; cnpj?: unknown; status?: unknown };
    admin?: { name?: unknown; email?: unknown; status?: unknown };
  };

  if (
    typeof candidate.tenant?.name !== "string" ||
    !isRecordStatus(candidate.tenant.status) ||
    typeof candidate.admin?.name !== "string" ||
    typeof candidate.admin.email !== "string" ||
    !isRecordStatus(candidate.admin.status)
  ) {
    return null;
  }

  return {
    tenant: {
      name: candidate.tenant.name.trim(),
      // Opcional: normalizado e validado em createTenantWithAdmin.
      cnpj: typeof candidate.tenant.cnpj === "string" ? candidate.tenant.cnpj : null,
      status: candidate.tenant.status,
    },
    admin: {
      name: candidate.admin.name.trim(),
      email: candidate.admin.email.trim().toLowerCase(),
      status: candidate.admin.status,
    },
  };
}

export async function GET() {
  const authorization = await authorizeApiRequest({
    permission: "administrador-master.clientes",
    minimumLevel: "visualizar",
    contextLabel: "master.clients.list",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  if (!isMasterRole(authorization.actorRole)) {
    return buildMasterOnlyResponse();
  }

  try {
    const clients = await listMasterClients();
    return NextResponse.json(clients);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Não foi possível carregar os clientes.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    permission: "administrador-master.clientes",
    minimumLevel: "gerenciar",
    contextLabel: "master.clients.create",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  if (!isMasterRole(authorization.actorRole)) {
    return buildMasterOnlyResponse();
  }

  const payload = normalizePayload(await request.json().catch(() => null));

  if (!payload?.tenant.name || !payload.admin.name || !payload.admin.email) {
    return NextResponse.json(
      { message: "Informe o nome do cliente e os dados iniciais do administrador." },
      { status: 400 },
    );
  }

  try {
    const createdClient = await createTenantWithAdmin(payload);
    return NextResponse.json(createdClient, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível criar o cliente.";

    if (isMasterClientAdminEmailConflictMessage(message)) {
      return NextResponse.json({ message }, { status: 409 });
    }

    // CNPJ inválido é erro do formulário, não falha de servidor.
    return NextResponse.json(
      { message },
      { status: message.toLowerCase().includes("cnpj") ? 400 : 500 },
    );
  }
}
