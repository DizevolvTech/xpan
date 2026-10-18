import { AreaShellLayout } from "@/components/layout/area-shell-layout";

export default async function ChaoFabricaLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return <AreaShellLayout areaGroup="chao-fabrica">{children}{modal}</AreaShellLayout>;
}
