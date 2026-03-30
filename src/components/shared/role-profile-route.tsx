import { redirect } from "next/navigation";

import { ProfilePage } from "@/components/shared/profile-page";
import {
  permissionGroupMeta,
  resolveLandingPath,
  type PermissionGroup,
} from "@/lib/permission-modules";
import { resolveServerAccess } from "@/lib/server-session";

type RoleProfileRouteProps = {
  role: PermissionGroup;
};

export async function RoleProfileRoute({ role }: RoleProfileRouteProps) {
  const access = await resolveServerAccess();

  if (!access) {
    redirect("/login");
  }

  const groupMeta = permissionGroupMeta[role];
  const homeHref = resolveLandingPath(access.user.permissions, access.user.role);

  return (
    <ProfilePage
      homeHref={homeHref}
      homeLabel={groupMeta.label}
      roleLabel={groupMeta.label}
      initialName={access.user.name}
      initialEmail={access.user.email}
    />
  );
}
