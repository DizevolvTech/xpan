import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { logAreaRedirect } from "@/lib/access-audit";
import { getAppShellContext } from "@/lib/app-shell";
import { permissionGroupMeta, type PermissionGroup } from "@/lib/permission-modules";

interface AreaShellLayoutProps {
  areaGroup: PermissionGroup;
  children: React.ReactNode;
}

export async function AreaShellLayout({
  areaGroup,
  children,
}: AreaShellLayoutProps) {
  const context = await getAppShellContext(areaGroup);

  if (!context) {
    logAreaRedirect({
      currentPath: permissionGroupMeta[areaGroup].route,
      redirectTo: "/login",
      reason: "missing-session",
      areaGroup,
    });
    redirect("/login");
  }

  if (!context.canAccessCurrentPath) {
    logAreaRedirect({
      currentPath: context.currentPath,
      redirectTo: context.landingPath,
      reason: context.accessDeniedReason ?? "missing-area-access",
      areaGroup,
      baseRole: context.currentUser.baseRole,
      userEmail: context.currentUser.email,
    });
    redirect(context.landingPath);
  }

  return (
    <AppShell
      navigationContext={{
        currentUser: context.currentUser,
        landingPath: context.landingPath,
        sections: context.sections,
      }}
    >
      {children}
    </AppShell>
  );
}
