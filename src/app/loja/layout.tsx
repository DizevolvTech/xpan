import { AppShell } from "@/components/layout/app-shell";
import { resolveShellProfile } from "@/lib/shell-profile";

export default async function LojaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await resolveShellProfile("loja");
  return <AppShell profile={profile}>{children}</AppShell>;
}
