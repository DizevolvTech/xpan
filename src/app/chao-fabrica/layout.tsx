import { AppShell } from "@/components/layout/app-shell";

export default function ChaoFabricaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell profile="chao-fabrica">{children}</AppShell>;
}

