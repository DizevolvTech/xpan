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
  const [isLeavingReadOnly, setIsLeavingReadOnly] = useState(false);
  const [leaveReadOnlyError, setLeaveReadOnlyError] = useState<string | null>(null);

  async function handleLeaveReadOnly() {
    setIsLeavingReadOnly(true);
    setLeaveReadOnlyError(null);

    try {
      const response = await fetch("/api/master/context/tenant", {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Não foi possível voltar ao painel master.");
      }

      window.location.assign("/administrador-master/clientes");
    } catch (error) {
      setLeaveReadOnlyError(
        error instanceof Error ? error.message : "Não foi possível voltar ao painel master.",
      );
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
          size="icon-lg"
          className="fixed top-4 left-4 z-30 lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir navegação"
        >
          <Menu className="size-5" />
        </Button>
        {navigationContext.accessMode === "read-only-tenant" && navigationContext.selectedTenant ? (
          <div className="border-b border-border/[var(--opacity-strong)] bg-amber-50/90 px-4 py-3 text-amber-950 backdrop-blur-sm lg:px-6">
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
                className="h-11 lg:h-8"
              >
                Voltar ao painel master
              </Button>
            </div>
            {leaveReadOnlyError ? (
              <div className="mt-3 rounded-lg border border-danger/[var(--opacity-border)] bg-danger/[var(--opacity-faint)] px-3 py-2 text-sm text-danger-foreground">
                {leaveReadOnlyError}
              </div>
            ) : null}
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
