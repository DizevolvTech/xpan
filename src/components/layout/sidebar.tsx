"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
} from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

const iconByKey: Record<PermissionIconKey, React.ComponentType<{ className?: string }>> = {
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

function isNavigationItemActive(pathname: string, item: NavigationItemDefinition) {
  const moduleDefinition = getPermissionModule(item.id as PermissionModuleId);

  if (!moduleDefinition) {
    return pathname === item.route;
  }

  return matchesPermissionModulePath(pathname, moduleDefinition);
}

function getActiveItemId(pathname: string, sections: NavigationSectionDefinition[]) {
  const allItems = sections.flatMap((section) => section.items);
  const matches = allItems.filter((item) => isNavigationItemActive(pathname, item));

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
    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-[background-color,color,transform,box-shadow] duration-300 ease-out";
  const visibleModuleCount = navigationContext.sections.reduce(
    (total, section) => total + section.items.length,
    0,
  );
  const profileGroupMeta = permissionGroupMeta[navigationContext.currentUser.baseRole];

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
      <div className="border-sidebar-border/80 border-b px-4 py-4">
        <Link
          href={navigationContext.landingPath}
          className={cn(
            "block rounded-xl border border-sidebar-border/70 bg-sidebar-accent/45 px-3.5 py-3 transition-[border-color,background-color] duration-300 ease-out hover:border-sidebar-border hover:bg-sidebar-accent/65",
            collapsed && "flex items-center justify-center px-0",
          )}
          onClick={onNavigate}
        >
          {!collapsed ? (
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl p-1.5">
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
        <div className="border-b border-sidebar-border/80 px-4 py-3">
          <div className="flex items-center gap-2.5">
            {navigationContext.selectedTenant.logoUrl ? (
              <img
                src={navigationContext.selectedTenant.logoUrl}
                alt={navigationContext.selectedTenant.name}
                className="h-8 w-8 rounded-lg object-contain"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent/60 text-xs font-bold text-foreground/70">
                {navigationContext.selectedTenant.name.charAt(0).toUpperCase()}
              </div>
            )}
            <p className="min-w-0 truncate text-sm font-medium text-foreground/85">
              {navigationContext.selectedTenant.name}
            </p>
          </div>
        </div>
      ) : null}

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navigationContext.sections.map((section, sectionIndex) => (
          <div
            key={`${section.group}-${sectionIndex}`}
            className={cn(
              "space-y-1",
              sectionIndex > 0 &&
                (collapsed ? "mt-2" : "mt-3 border-t border-sidebar-border/65 pt-3"),
            )}
          >
            {!collapsed && (
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
                      active && "drop-shadow-[0_0_8px_color-mix(in_oklch,var(--accent)_40%,transparent)]",
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
        <div className="border-sidebar-border/80 border-t p-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {profileGroupMeta.badge}
            </p>
            <p className="text-sm font-medium text-sidebar-foreground">
              {navigationContext.currentUser.name}
            </p>
            <p className="text-xs text-muted-foreground">
              Perfil-base: {navigationContext.currentUser.baseRoleLabel}
            </p>
            <p className="text-xs text-muted-foreground">
              {visibleModuleCount} módulo{visibleModuleCount === 1 ? "" : "s"} visíveis
            </p>
          </div>

          <Link
            href={navigationContext.currentUser.profilePath}
            onClick={onNavigate}
            className={cn(
              navItemBaseClass,
              "mt-3 border border-sidebar-border/70",
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
            className="mt-2 w-full justify-start text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-4" />
            {loggingOut ? "Saindo..." : "Sair"}
          </Button>
        </div>
      ) : (
        <div className="border-sidebar-border/80 border-t p-3">
          <div className="flex flex-col gap-2">
            <Link
              href={navigationContext.currentUser.profilePath}
              onClick={onNavigate}
              className={cn(
                "inline-flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground transition hover:text-foreground",
                activeProfile && "bg-sidebar-primary text-sidebar-primary-foreground",
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

export function Sidebar({ navigationContext, mobileOpen, onMobileClose, className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const desktopSidebar = useMemo(
    () => (
      <aside
        className={cn(
          "border-sidebar-border/80 bg-sidebar text-sidebar-foreground sticky top-0 hidden h-screen flex-col border-r transition-[width] duration-300 ease-out lg:flex",
          collapsed ? "w-20" : "w-72",
          className,
        )}
      >
        <div className="flex justify-end border-b border-sidebar-border/70 px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expandir navegação" : "Recolher navegação"}
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>
        <SidebarNav navigationContext={navigationContext} collapsed={collapsed} />
      </aside>
    ),
    [className, collapsed, navigationContext],
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
        <SheetContent side="left" className={cn("w-[90%] p-0 sm:max-w-sm", className)}>
          <SheetHeader className="sr-only">
            <SheetTitle>Navegação</SheetTitle>
            <SheetDescription>Selecione um módulo disponível para o seu usuário.</SheetDescription>
          </SheetHeader>
          <SidebarNav navigationContext={navigationContext} collapsed={false} onNavigate={onMobileClose} />
        </SheetContent>
      </Sheet>
    );
  }

  return desktopSidebar;
}
