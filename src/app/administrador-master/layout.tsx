import { AreaShellLayout } from "@/components/layout/area-shell-layout";

export default async function AdministradorMasterLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AreaShellLayout areaGroup="administrador-master">{children}</AreaShellLayout>;
}
