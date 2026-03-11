import type { CookieOptions } from "@supabase/ssr";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";

type PendingCookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export function createSupabaseRequestClient(request: NextRequest) {
  const pendingCookies: PendingCookie[] = [];

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          pendingCookies.push({ name, value, options });
          request.cookies.set(name, value);
        });
      },
    },
  });

  function applyResponseCookies(response: NextResponse) {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    return response;
  }

  return {
    supabase,
    applyResponseCookies,
  };
}
