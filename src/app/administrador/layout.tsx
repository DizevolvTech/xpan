import { AppShell } from "@/components/layout/app-shell";

export default function AdministradorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell profile="administrador">{children}</AppShell>;
}
