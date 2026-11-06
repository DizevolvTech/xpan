import { AreaShellLayout } from "@/components/layout/area-shell-layout";

export default async function LojaLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return <AreaShellLayout areaGroup="loja">{children}{modal}</AreaShellLayout>;
}
