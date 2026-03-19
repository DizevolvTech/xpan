import { AreaShellLayout } from "@/components/layout/area-shell-layout";

export default async function AdministradorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AreaShellLayout areaGroup="administrador">{children}</AreaShellLayout>;
}
