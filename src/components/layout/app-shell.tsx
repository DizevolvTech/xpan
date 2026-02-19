"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sidebar, type ProfileKey } from "@/components/layout/sidebar";

interface AppShellProps {
  profile: ProfileKey;
  children: React.ReactNode;
}

export function AppShell({ profile, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[auto_1fr]">
      <Sidebar profile={profile} className="hidden lg:flex" />
      <Sidebar
        profile={profile}
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
