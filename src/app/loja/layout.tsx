import { AreaShellLayout } from "@/components/layout/area-shell-layout";

export default async function LojaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AreaShellLayout areaGroup="loja">{children}</AreaShellLayout>;
}
