"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import type { AppShellNavigationContext } from "@/lib/permission-modules";

interface AppShellProps {
  navigationContext: AppShellNavigationContext;
  children: React.ReactNode;
}

export function AppShell({ navigationContext, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLeavingReadOnly, setIsLeavingReadOnly] = useState(false);
  const router = useRouter();

  async function handleLeaveReadOnly() {
    setIsLeavingReadOnly(true);

    try {
      await fetch("/api/master/context/tenant", {
        method: "DELETE",
      });
      router.replace("/administrador-master/clientes");
      router.refresh();
    } finally {
      setIsLeavingReadOnly(false);
    }
  }

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
        {navigationContext.accessMode === "read-only-tenant" && navigationContext.selectedTenant ? (
          <div className="border-b border-border/70 bg-amber-50/90 px-4 py-3 text-amber-950 backdrop-blur-sm lg:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">
                  Modo leitura
                </p>
                <p className="text-sm font-medium">
                  Visualizando cliente {navigationContext.selectedTenant.name} em modo leitura.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLeavingReadOnly}
                onClick={handleLeaveReadOnly}
              >
                Voltar ao painel master
              </Button>
            </div>
          </div>
        ) : null}
        <div
          data-app-read-only={navigationContext.accessMode === "read-only-tenant" ? "true" : "false"}
          data-app-tenant-id={navigationContext.effectiveTenantId ?? ""}
          data-app-access-mode={navigationContext.accessMode}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
