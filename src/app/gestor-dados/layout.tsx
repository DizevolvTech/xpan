import { AppShell } from "@/components/layout/app-shell";
import { getShellContext } from "@/lib/shell-profile";

export default async function GestorDadosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await getShellContext("gestor-dados");
  return (
    <AppShell profile={context.profile} canSwitchProfiles={context.canSwitchProfiles}>
      {children}
    </AppShell>
  );
}
