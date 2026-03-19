import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { listStoreUserCandidates } from "@/lib/supabase-data/master-data-admin";

export async function GET() {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/master-data/store-users",
    permission: "gestor-dados.lojas",
    minimumLevel: "visualizar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const users = await listStoreUserCandidates(supabase);
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load store user candidates",
      },
      { status: 500 },
    );
  }
}
