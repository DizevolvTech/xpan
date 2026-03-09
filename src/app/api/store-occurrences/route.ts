import { NextResponse } from "next/server";

import { authorizeApiRequest, getAllowedStoreIds } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createStoreOccurrence, listStoreOccurrences } from "@/lib/supabase-data/store-occurrences";

export async function GET() {
  const authorization = await authorizeApiRequest({
    permission: "loja.ocorrencias",
    minimumLevel: "operar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const occurrences = await listStoreOccurrences({
      allowedStoreIds: getAllowedStoreIds(authorization.user),
    }, supabase);
    return NextResponse.json(occurrences);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load store occurrences",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    permission: "loja.ocorrencias",
    minimumLevel: "operar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const body = (await request.json()) as Parameters<typeof createStoreOccurrence>[0];
    await createStoreOccurrence(
      {
        ...body,
        openedByProfileId: authorization.user.id,
      },
      {
        allowedStoreIds: getAllowedStoreIds(authorization.user),
      },
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Authenticated store does not have access to this order") {
      return NextResponse.json(
        { message: "A loja autenticada não tem acesso ao pedido informado." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to create store occurrence",
      },
      { status: 500 },
    );
  }
}
