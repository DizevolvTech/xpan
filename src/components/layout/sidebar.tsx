"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Factory,
  LayoutDashboard,
  LogOut,
  Navigation,
  Package,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  UserRound,
  Users,
  X,
} from "lucide-react";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";
import {
  getPermissionModule,
  matchesPermissionModulePath,
  permissionGroupMeta,
  type AppShellNavigationContext,
  type NavigationItemDefinition,
  type NavigationSectionDefinition,
  type PermissionIconKey,
  type PermissionModuleId,
} from "@/lib/permission-modules";
import { cn } from "@/lib/utils";

const iconByKey: Record<
  PermissionIconKey,
  React.ComponentType<{ className?: string }>
> = {
  "alert-circle": AlertCircle,
  "clipboard-list": ClipboardList,
  factory: Factory,
  "layout-dashboard": LayoutDashboard,
  navigation: Navigation,
  package: Package,
  "shield-check": ShieldCheck,
  "shopping-cart": ShoppingCart,
  store: Store,
  truck: Truck,
  users: Users,
};

interface SidebarProps {
  navigationContext: AppShellNavigationContext;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  className?: string;
}

function isNavigationItemActive(
  pathname: string,
  item: NavigationItemDefinition,
) {
  const moduleDefinition = getPermissionModule(item.id as PermissionModuleId);

  if (!moduleDefinition) {
    return pathname === item.route;
  }

  return matchesPermissionModulePath(pathname, moduleDefinition);
}

function getActiveItemId(
  pathname: string,
  sections: NavigationSectionDefinition[],
) {
  const allItems = sections.flatMap((section) => section.items);
  const matches = allItems.filter((item) =>
    isNavigationItemActive(pathname, item),
  );

  if (matches.length === 0) {
    return null;
  }

  return matches.reduce((current, item) =>
    item.route.length > current.route.length ? item : current,
  ).id;
}

function SidebarNav({
  navigationContext,
  collapsed,
  onNavigate,
}: {
  navigationContext: AppShellNavigationContext;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const activeItemId = getActiveItemId(pathname, navigationContext.sections);
  const activeProfile = pathname === navigationContext.currentUser.profilePath;
  const navItemBaseClass =
    "group relative flex min-h-11 lg:min-h-0 items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm lg:py-1.5 font-medium transition-[background-color,color,transform,box-shadow] duration-300 ease-out";
  const visibleModuleCount = navigationContext.sections.reduce(
    (total, section) => total + section.items.length,
    0,
  );
  const profileGroupMeta =
    permissionGroupMeta[navigationContext.currentUser.baseRole];

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-sidebar-border/[var(--opacity-prominent)] border-b px-3 py-2">
        <Link
          href={navigationContext.landingPath}
          className={cn(
            "block rounded-xl border border-sidebar-border/[var(--opacity-strong)] bg-sidebar-accent/45 px-2.5 py-1.5 transition-[border-color,background-color] duration-300 ease-out hover:border-sidebar-border hover:bg-sidebar-accent/[var(--opacity-strong)]",
            collapsed && "flex items-center justify-center px-0",
          )}
          onClick={onNavigate}
        >
          {!collapsed ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-1">
                <Image
                  src={brand.logoPath}
                  alt={brand.name}
                  width={40}
                  height={40}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">
                  Software
                </p>
                <p className="font-heading text-base font-semibold leading-none text-foreground">
                  {brand.name}
                </p>
              </div>
            </div>
          ) : (
            <span className="font-heading text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
              {brand.shortName}
            </span>
          )}
        </Link>
      </div>

      {!collapsed && navigationContext.selectedTenant ? (
        <div className="border-b border-sidebar-border/[var(--opacity-prominent)] px-3 py-1.5">
          <div className="flex items-center gap-2">
            {navigationContext.selectedTenant.logoUrl ? (
              <img
                src={navigationContext.selectedTenant.logoUrl}
                alt={navigationContext.selectedTenant.name}
                className="h-6 w-6 rounded-md object-contain"
              />
            ) : (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sidebar-accent/[var(--opacity-strong)] text-xs font-bold text-foreground/[var(--opacity-strong)]">
                {navigationContext.selectedTenant.name.charAt(0).toUpperCase()}
              </div>
            )}
            <p className="min-w-0 truncate text-sm font-medium text-foreground/85">
              {navigationContext.selectedTenant.name}
            </p>
          </div>
        </div>
      ) : null}

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {navigationContext.sections.map((section, sectionIndex) => (
          <div
            key={`${section.group}-${sectionIndex}`}
            className={cn(
              "space-y-0.5",
              sectionIndex > 0 &&
                (collapsed
                  ? "mt-1.5"
                  : "mt-2 border-t border-sidebar-border/[var(--opacity-strong)] pt-2"),
            )}
          >
            {!collapsed && (
              <p className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {section.label}
              </p>
            )}

            {section.items.map((item) => {
              const Icon = iconByKey[item.icon];
              const active = item.id === activeItemId;

              return (
                <Link
                  key={item.id}
                  href={item.route}
                  onClick={onNavigate}
                  className={cn(
                    navItemBaseClass,
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[var(--shadow-soft)] before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-x-1 before:-translate-y-1/2 before:rounded-r-full before:bg-accent"
                      : "text-sidebar-foreground/85 hover:translate-x-0.5 hover:bg-sidebar-accent/85 hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center px-2",
                  )}
                  title={item.label}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0 transition-transform duration-300 ease-out group-hover:scale-105",
                      active &&
                        "drop-shadow-[0_0_8px_color-mix(in_oklch,var(--accent)_40%,transparent)]",
                    )}
                  />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {!collapsed ? (
        <div className="border-sidebar-border/[var(--opacity-prominent)] border-t px-3 py-2">
          {/* Quadro #7 (28/10): rodapé enxuto, estilo ERP — perfil em duas linhas curtas. */}
          <div className="space-y-0.5 px-1">
            <p className="truncate text-sm font-medium leading-tight text-sidebar-foreground">
              {navigationContext.currentUser.name}
            </p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {profileGroupMeta.badge} ·{" "}
              {navigationContext.currentUser.baseRoleLabel} ·{" "}
              {visibleModuleCount} módulo
              {visibleModuleCount === 1 ? "" : "s"}
            </p>
          </div>

          {/* Meu Perfil e Sair na mesma linha: o rodapé cabe em 1280×800 mesmo com a faixa de TESTE. */}
          <div className="mt-1.5 flex items-center gap-1">
            <Link
              href={navigationContext.currentUser.profilePath}
              onClick={onNavigate}
              className={cn(
                navItemBaseClass,
                "min-w-0 flex-1 border border-sidebar-border/[var(--opacity-strong)]",
                activeProfile
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[var(--shadow-soft)]"
                  : "text-sidebar-foreground/90 hover:bg-sidebar-accent/85 hover:text-sidebar-accent-foreground",
              )}
            >
              <UserRound className="size-4 shrink-0" />
              <span>Meu Perfil</span>
            </Link>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={loggingOut}
              className="h-11 shrink-0 justify-start px-2.5 text-muted-foreground hover:text-foreground lg:h-8"
            >
              <LogOut className="size-4" />
              {loggingOut ? "Saindo..." : "Sair"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-sidebar-border/[var(--opacity-prominent)] border-t p-3">
          <div className="flex flex-col gap-2">
            <Link
              href={navigationContext.currentUser.profilePath}
              onClick={onNavigate}
              className={cn(
                "inline-flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground transition hover:text-foreground",
                activeProfile &&
                  "bg-sidebar-primary text-sidebar-primary-foreground",
              )}
              aria-label="Meu perfil"
              title="Meu Perfil"
            >
              <UserRound className="size-4" />
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full text-muted-foreground hover:text-foreground"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const SIDEBAR_COLLAPSED_KEY = "xpan:sidebar-collapsed";
const SIDEBAR_COLLAPSED_EVENT = "xpan:sidebar-collapsed-change";

function subscribeSidebarCollapsed(onChange: () => void) {
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readSidebarCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSidebarCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    // sem storage: não lembra
  }
  window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT));
}

export function Sidebar({
  navigationContext,
  mobileOpen,
  onMobileClose,
  className,
}: SidebarProps) {
  // Reunião 22/10 (bloco 3): menu recolhido fica lembrado, para a tela ganhar largura.
  const collapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    readSidebarCollapsed,
    () => false,
  );
  const toggleCollapsed = useCallback(
    () => writeSidebarCollapsed(!collapsed),
    [collapsed],
  );

  const desktopSidebar = useMemo(
    () => (
      <aside
        className={cn(
          "border-sidebar-border/[var(--opacity-prominent)] bg-sidebar text-sidebar-foreground sticky top-[var(--test-banner-h,0px)] hidden h-[calc(100dvh-var(--test-banner-h,0px))] flex-col border-r transition-[width] duration-300 ease-out lg:flex",
          collapsed ? "w-20" : "w-64",
          className,
        )}
      >
        <div className="flex justify-end border-b border-sidebar-border/[var(--opacity-strong)] px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expandir navegação" : "Recolher navegação"}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </Button>
        </div>
        <SidebarNav
          navigationContext={navigationContext}
          collapsed={collapsed}
        />
      </aside>
    ),
    [className, collapsed, navigationContext, toggleCollapsed],
  );

  if (typeof mobileOpen === "boolean") {
    return (
      <Sheet
        open={mobileOpen}
        onOpenChange={(open) => {
          if (!open) {
            onMobileClose?.();
          }
        }}
      >
        <SheetContent
          side="left"
          // O botão "Fechar navegação" próprio já existe; o X padrão do Sheet duplicava o ícone.
          showCloseButton={false}
          className={cn(
            // Abaixo da faixa "Sistema de TESTE" (z-60) para não cobrir o logo no celular.
            "top-[var(--test-banner-h,0px)] h-[calc(100dvh-var(--test-banner-h,0px))] w-[90%] p-0 sm:max-w-sm",
            className,
          )}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navegação</SheetTitle>
            <SheetDescription>
              Selecione um módulo disponível para o seu usuário.
            </SheetDescription>
          </SheetHeader>
          {/* UX-0010: alvo de fechar touch ≥44px — só mobile (Sheet só existe <lg) */}
          <SheetClose
            aria-label="Fechar navegação"
            className="absolute right-3 top-3 z-10 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-ring/45 focus-visible:ring-[3px]"
          >
            <X className="size-5" />
          </SheetClose>
          <SidebarNav
            navigationContext={navigationContext}
            collapsed={false}
            onNavigate={onMobileClose}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return desktopSidebar;
}
