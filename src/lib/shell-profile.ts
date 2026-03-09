import "server-only";

import { cookies } from "next/headers";

import { roleHomePath, type UserRole } from "@/lib/auth";
import { resolveServerSession } from "@/lib/server-session";
import { SHELL_PROFILE_COOKIE_NAME } from "@/lib/shell-profile-constants";

function normalizeShellProfile(raw: string | undefined): UserRole | null {
  if (!raw) {
    return null;
  }

  const value = raw as UserRole;
  return value in roleHomePath ? value : null;
}

export async function getShellContext(defaultProfile: UserRole): Promise<{
  profile: UserRole;
  canSwitchProfiles: boolean;
}> {
  const cookieStore = await cookies();
  const session = await resolveServerSession();
  const overrideProfile = normalizeShellProfile(cookieStore.get(SHELL_PROFILE_COOKIE_NAME)?.value);

  if (session?.role === "administrador") {
    return {
      profile: overrideProfile ?? defaultProfile,
      canSwitchProfiles: true,
    };
  }

  return {
    profile: defaultProfile,
    canSwitchProfiles: false,
  };
}

export async function resolveShellProfile(defaultProfile: UserRole): Promise<UserRole> {
  const context = await getShellContext(defaultProfile);
  return context.profile;
}
