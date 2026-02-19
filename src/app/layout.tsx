import type { Metadata } from "next";
import { Sora, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const headingFont = Sora({
  variable: "--font-heading",
  subsets: ["latin"],
});

const bodyFont = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Casa Express - Plataforma de Gestão",
  description: "Casa Express para controle de produção e pedidos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${headingFont.variable} ${bodyFont.variable} ${monoFont.variable} bg-canvas text-foreground antialiased`}
      >
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
