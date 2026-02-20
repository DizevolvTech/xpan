import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME, decodeSession, type UserRole } from "@/lib/auth";

export async function resolveShellProfile(defaultProfile: UserRole): Promise<UserRole> {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (session?.role === "administrador") {
    return "administrador";
  }

  return defaultProfile;
}
