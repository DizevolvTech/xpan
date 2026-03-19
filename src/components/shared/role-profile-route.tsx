import { redirect } from "next/navigation";

import { ProfilePage } from "@/components/shared/profile-page";
import { permissionGroupMeta, type PermissionGroup } from "@/lib/permission-modules";
import { resolveServerSession } from "@/lib/server-session";

type RoleProfileRouteProps = {
  role: PermissionGroup;
};

export async function RoleProfileRoute({ role }: RoleProfileRouteProps) {
  const session = await resolveServerSession();

  if (!session) {
    redirect("/login");
  }

  const groupMeta = permissionGroupMeta[role];

  return (
    <ProfilePage
      homeHref={groupMeta.route}
      homeLabel={groupMeta.label}
      roleLabel={groupMeta.label}
      initialName={session.name}
      initialEmail={session.email}
    />
  );
}
