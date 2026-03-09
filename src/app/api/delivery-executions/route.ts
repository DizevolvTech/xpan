import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getPersistedDeliveryExecutions, updateDeliveryExecution } from "@/lib/supabase-data/delivery";

export async function GET() {
  const authorization = await authorizeApiRequest({
    roles: ["gestor-fabrica", "chao-fabrica"],
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const executions = await getPersistedDeliveryExecutions(supabase);
    return NextResponse.json(executions);
  } catch (error) {
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
    roles: ["gestor-fabrica", "chao-fabrica"],
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const body = (await request.json()) as {
      orderId: string;
      status: "aguardando_expedicao" | "pronto_coleta" | "em_rota" | "no_destino" | "entregue" | "tentativa_falha";
    };

    await updateDeliveryExecution(body.orderId, body.status, authorization.user.id, supabase);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to update delivery execution",
      },
      { status: 500 },
    );
  }
}
