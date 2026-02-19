import { AppShell } from "@/components/layout/app-shell";

export default function LojaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell profile="loja">{children}</AppShell>;
}
