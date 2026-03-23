import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import type { DeliveryChecklistState, DeliveryExecutionStatus } from "@/lib/delivery-workflow";
import { invalidateDeliveryExecutionCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPersistedDeliveryExecutions, updateDeliveryExecution } from "@/lib/supabase-data/delivery";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

function isClientValidationError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("invalid") ||
    normalized.includes("checklist") ||
    normalized.includes("expedi") ||
    normalized.includes("pronto para expedi")
  );
}

export async function GET() {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/delivery-executions",
    anyOfPermissions: ["gestor-fabrica.expedicao", "chao-fabrica.expedicao"],
    minimumLevel: "visualizar",
    requireTenantContext: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const executions = await getPersistedDeliveryExecutions({
      tenantId: authorization.effectiveTenantId,
      supabase,
    });
    return NextResponse.json(executions);
  } catch (error) {
    console.error("Failed to load delivery executions", error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load delivery executions",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "PATCH /api/delivery-executions",
    anyOfPermissions: ["gestor-fabrica.expedicao", "chao-fabrica.expedicao"],
    minimumLevel: "operar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const body = (await request.json()) as {
      orderId: string;
      status: DeliveryExecutionStatus;
      checklistState?: DeliveryChecklistState;
      checklistCompletedAt?: string | null;
    };

    await updateDeliveryExecution(
      body.orderId,
      body.status,
      {
        checklistState: body.checklistState,
        checklistCompletedAt: body.checklistCompletedAt,
        tenantId: authorization.effectiveTenantId,
      },
      authorization.user.id,
      supabase,
    );
    invalidateDeliveryExecutionCaches(authorization.effectiveTenantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to update delivery execution", error);
    const message =
      error instanceof Error ? error.message : "Failed to update delivery execution";
    return NextResponse.json(
      {
        message,
      },
      { status: isClientValidationError(message) ? 400 : 500 },
    );
  }
}
