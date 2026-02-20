import { AppShell } from "@/components/layout/app-shell";
import { resolveShellProfile } from "@/lib/shell-profile";

export default async function GestorFabricaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await resolveShellProfile("gestor-fabrica");
  return <AppShell profile={profile}>{children}</AppShell>;
}
