import { AreaShellLayout } from "@/components/layout/area-shell-layout";

export default async function ChaoFabricaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AreaShellLayout areaGroup="chao-fabrica">{children}</AreaShellLayout>;
}
