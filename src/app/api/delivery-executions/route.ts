import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import type { DeliveryChecklistState, DeliveryExecutionStatus } from "@/lib/delivery-workflow";
import { invalidateDeliveryExecutionCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPersistedDeliveryExecutions, updateDeliveryExecution } from "@/lib/supabase-data/delivery";

export async function GET() {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/delivery-executions",
    anyOfPermissions: ["gestor-fabrica.expedicao", "chao-fabrica.expedicao"],
    minimumLevel: "visualizar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const executions = await getPersistedDeliveryExecutions(supabase);
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
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
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
      },
      authorization.user.id,
      supabase,
    );
    invalidateDeliveryExecutionCaches();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to update delivery execution", error);
    const message =
      error instanceof Error ? error.message : "Failed to update delivery execution";
    return NextResponse.json(
      {
        message,
      },
      { status: message.toLowerCase().includes("invalid") ? 400 : 500 },
    );
  }
}
