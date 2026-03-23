import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { getTenantByIdentifier } from "@/lib/supabase-data/tenants";
import {
  MASTER_TENANT_COOKIE_NAME,
  getTenantIdentifier,
  isMasterRole,
} from "@/lib/tenant";

function buildMasterOnlyResponse() {
  return NextResponse.json(
    { message: "Apenas o administrador master pode acessar este recurso." },
    { status: 403 },
  );
}

function buildMissingTenantResponse() {
  return NextResponse.json(
    { message: "Informe o cliente que deve ser aberto em modo leitura." },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    permission: "administrador-master.clientes",
    minimumLevel: "visualizar",
    contextLabel: "master.context.tenant.enter",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  if (!isMasterRole(authorization.actorRole)) {
    return buildMasterOnlyResponse();
  }

  const body = (await request.json().catch(() => null)) as { tenantId?: unknown } | null;
  const tenantIdentifier =
    typeof body?.tenantId === "string" ? body.tenantId.trim() : "";

  if (!tenantIdentifier) {
    return buildMissingTenantResponse();
  }

  try {
    const tenant = await getTenantByIdentifier(tenantIdentifier);

    if (!tenant) {
      return NextResponse.json({ message: "Cliente não encontrado." }, { status: 404 });
    }

    const cookieStore = await cookies();
    cookieStore.set(MASTER_TENANT_COOKIE_NAME, getTenantIdentifier(tenant), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 12,
      path: "/",
    });

    return NextResponse.json({
      tenant,
      redirectTo: "/administrador",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível abrir o cliente em modo leitura.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const authorization = await authorizeApiRequest({
    permission: "administrador-master.clientes",
    minimumLevel: "visualizar",
    contextLabel: "master.context.tenant.leave",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  if (!isMasterRole(authorization.actorRole)) {
    return buildMasterOnlyResponse();
  }

  const cookieStore = await cookies();
  cookieStore.delete(MASTER_TENANT_COOKIE_NAME);

  return NextResponse.json({ success: true });
}
