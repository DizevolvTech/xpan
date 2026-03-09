import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getFactoryPlanningSnapshot } from "@/lib/supabase-data/planning-snapshot";

function getReferenceDate(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("referenceDate") ?? new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest({
    roles: ["gestor-fabrica", "chao-fabrica"],
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const planning = await getFactoryPlanningSnapshot(getReferenceDate(request), {
      supabase,
      includeProfileNames: false,
    });
    return NextResponse.json(planning);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load factory planning snapshot",
      },
      { status: 500 },
    );
  }
}
