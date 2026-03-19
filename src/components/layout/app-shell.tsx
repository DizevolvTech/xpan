"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import type { AppShellNavigationContext } from "@/lib/permission-modules";

interface AppShellProps {
  navigationContext: AppShellNavigationContext;
  children: React.ReactNode;
}

export function AppShell({ navigationContext, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[auto_1fr]">
      <Sidebar navigationContext={navigationContext} className="hidden lg:flex" />
      <Sidebar
        navigationContext={navigationContext}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        className="lg:hidden"
      />

      <div className="min-w-0">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="fixed top-4 left-4 z-30 lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir navegação"
        >
          <Menu className="size-5" />
        </Button>
        {children}
      </div>
    </div>
  );
}
