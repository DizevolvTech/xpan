import { AppShell } from "@/components/layout/app-shell";

export default function GestorDadosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell profile="gestor-dados">{children}</AppShell>;
}
