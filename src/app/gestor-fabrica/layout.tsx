import { AreaShellLayout } from "@/components/layout/area-shell-layout";

export default async function GestorFabricaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AreaShellLayout areaGroup="gestor-fabrica">{children}</AreaShellLayout>;
}
