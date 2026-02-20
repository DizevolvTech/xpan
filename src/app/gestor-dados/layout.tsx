import { AppShell } from "@/components/layout/app-shell";
import { resolveShellProfile } from "@/lib/shell-profile";

export default async function GestorDadosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await resolveShellProfile("gestor-dados");
  return <AppShell profile={profile}>{children}</AppShell>;
}
