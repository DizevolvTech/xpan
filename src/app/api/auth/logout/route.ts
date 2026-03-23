import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { getSupabaseProjectRef } from "@/lib/supabase-env";
import { createSupabaseRequestClient } from "@/lib/supabase-request-client";
import { MASTER_TENANT_COOKIE_NAME } from "@/lib/tenant";

export async function POST(request: NextRequest) {
  const { supabase, applyResponseCookies } = createSupabaseRequestClient(request);
  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  const authCookieBaseName = `sb-${getSupabaseProjectRef()}-auth-token`;

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    path: "/",
    expires: new Date(0),
  });
  response.cookies.set({
    name: MASTER_TENANT_COOKIE_NAME,
    value: "",
    path: "/",
    expires: new Date(0),
  });

  response.cookies.set({
    name: authCookieBaseName,
    value: "",
    path: "/",
    expires: new Date(0),
  });

  for (let index = 0; index < 5; index += 1) {
    response.cookies.set({
      name: `${authCookieBaseName}.${index}`,
      value: "",
      path: "/",
      expires: new Date(0),
    });
  }

  return applyResponseCookies(response);
}
