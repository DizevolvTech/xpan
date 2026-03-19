import { AreaShellLayout } from "@/components/layout/area-shell-layout";

export default async function GestorDadosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AreaShellLayout areaGroup="gestor-dados">{children}</AreaShellLayout>;
}
