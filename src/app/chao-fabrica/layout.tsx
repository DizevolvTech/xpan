import { AppShell } from "@/components/layout/app-shell";
import { resolveShellProfile } from "@/lib/shell-profile";

export default async function ChaoFabricaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await resolveShellProfile("chao-fabrica");
  return <AppShell profile={profile}>{children}</AppShell>;
}

