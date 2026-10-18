import { AreaShellLayout } from "@/components/layout/area-shell-layout";

export default async function GestorFabricaLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return <AreaShellLayout areaGroup="gestor-fabrica">{children}{modal}</AreaShellLayout>;
}
