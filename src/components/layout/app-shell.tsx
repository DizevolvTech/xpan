"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Sidebar, type ProfileKey } from "@/components/layout/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { roleHomePath } from "@/lib/auth";
import { SHELL_PROFILE_COOKIE_NAME } from "@/lib/shell-profile-constants";

interface AppShellProps {
  profile: ProfileKey;
  canSwitchProfiles?: boolean;
  children: React.ReactNode;
}

const profileLabels: Record<ProfileKey, string> = {
  administrador: "Administrador",
  "gestor-dados": "Gestor de Dados",
  "gestor-fabrica": "Gestor de Fábrica",
  "chao-fabrica": "Chão de Fábrica",
  loja: "Loja",
};

export function AppShell({ profile, canSwitchProfiles = false, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  function handleProfileChange(value: string) {
    const nextProfile = value as ProfileKey;
    document.cookie = `${SHELL_PROFILE_COOKIE_NAME}=${nextProfile}; path=/; max-age=${60 * 60 * 8}; samesite=lax`;
    router.push(roleHomePath[nextProfile]);
    router.refresh();
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[auto_1fr]">
      <Sidebar profile={profile} canSwitchProfiles={canSwitchProfiles} className="hidden lg:flex" />
      <Sidebar
        profile={profile}
        canSwitchProfiles={canSwitchProfiles}
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
        {canSwitchProfiles ? (
          <div className="sticky top-0 z-20 border-b border-border/70 bg-background/92 px-4 py-3 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Contexto de Visualização
                </p>
                <p className="text-sm text-foreground">
                  Navegue entre perfis sem trocar o usuário autenticado.
                </p>
              </div>
              <Select value={profile} onValueChange={handleProfileChange}>
                <SelectTrigger className="w-full bg-card sm:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(profileLabels) as ProfileKey[]).map((profileKey) => (
                    <SelectItem key={profileKey} value={profileKey}>
                      {profileLabels[profileKey]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
