import { AppShell } from "@/components/layout/app-shell";

export default function GestorFabricaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell profile="gestor-fabrica">{children}</AppShell>;
}
