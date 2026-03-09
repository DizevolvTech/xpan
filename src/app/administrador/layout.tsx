import { AppShell } from "@/components/layout/app-shell";
import { getShellContext } from "@/lib/shell-profile";

export default async function AdministradorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await getShellContext("administrador");
  return (
    <AppShell profile={context.profile} canSwitchProfiles={context.canSwitchProfiles}>
      {children}
    </AppShell>
  );
}
