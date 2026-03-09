import { AppShell } from "@/components/layout/app-shell";
import { getShellContext } from "@/lib/shell-profile";

export default async function LojaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await getShellContext("loja");
  return (
    <AppShell profile={context.profile} canSwitchProfiles={context.canSwitchProfiles}>
      {children}
    </AppShell>
  );
}
