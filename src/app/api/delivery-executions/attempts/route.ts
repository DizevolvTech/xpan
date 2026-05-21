import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateDeliveryExecutionCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { registerDeliveryAttempt, type DeliveryFailureReason } from "@/lib/supabase-data/delivery";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

const VALID_REASONS = new Set<DeliveryFailureReason>([
  "cliente_ausente",
  "endereco_errado",
  "recusa_cliente",
  "estabelecimento_fechado",
  "veiculo_avaria",
  "acesso_bloqueado",
  "documentacao_pendente",
  "outro",
]);

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/delivery-executions/attempts",
    anyOfPermissions: ["gestor-fabrica.expedicao", "chao-fabrica.expedicao"],
    minimumLevel: "operar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  let body: {
    orderId?: unknown;
    reason?: unknown;
    notes?: unknown;
    rescheduleTo?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { message: "Invalid attempt: body precisa ser JSON válido." },
      { status: 400 },
    );
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const rescheduleTo =
    typeof body.rescheduleTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.rescheduleTo)
      ? body.rescheduleTo
      : null;

  if (!orderId) {
    return NextResponse.json(
      { message: "Invalid attempt: orderId é obrigatório." },
      { status: 400 },
    );
  }

  if (!VALID_REASONS.has(reason as DeliveryFailureReason)) {
    return NextResponse.json(
      { message: "Invalid attempt: motivo inválido." },
      { status: 400 },
    );
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const result = await registerDeliveryAttempt(
      orderId,
      {
        reason: reason as DeliveryFailureReason,
        notes: notes.length > 0 ? notes : null,
        rescheduleTo,
      },
      authorization.user.id,
      { tenantId: authorization.effectiveTenantId },
      supabase,
    );
    invalidateDeliveryExecutionCaches(authorization.effectiveTenantId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Failed to register delivery attempt", error);
    const message =
      error instanceof Error ? error.message : "Failed to register delivery attempt";
    return NextResponse.json(
      { message },
      { status: message.toLowerCase().includes("invalid") ? 400 : 500 },
    );
  }
}
