"use client";

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

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type ProfileKey =
  | "administrador"
  | "gestor-dados"
  | "gestor-fabrica"
  | "chao-fabrica"
  | "loja";

type MenuItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type MenuSection = {
  label?: string;
  items: MenuItem[];
};

type ProfileConfig = {
  title: string;
  subtitle: string;
  badge: string;
  items?: MenuItem[];
  sections?: MenuSection[];
};

const gestorDadosItems: MenuItem[] = [
  { href: "/gestor-dados", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/gestor-dados/ingredientes", label: "Ingredientes", icon: Package },
  { href: "/gestor-dados/produtos", label: "Produtos", icon: ShoppingCart },
  { href: "/gestor-dados/setores", label: "Categorias", icon: Users },
  { href: "/gestor-dados/linhas-producao", label: "Subcategorias", icon: Factory },
  { href: "/gestor-dados/lojas", label: "Lojas", icon: Store },
];

const gestorFabricaItems: MenuItem[] = [
  { href: "/gestor-fabrica", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/gestor-fabrica/sublinhas-producao", label: "Linhas", icon: ClipboardList },
  { href: "/gestor-fabrica/pedidos", label: "Pedidos", icon: ShoppingCart },
  { href: "/gestor-fabrica/ordens-producao", label: "Ordens de Produção", icon: Factory },
  { href: "/gestor-fabrica/expedicao", label: "Expedição", icon: Truck },
];

const chaoFabricaItems: MenuItem[] = [
  { href: "/chao-fabrica", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/chao-fabrica/ordens-producao", label: "Ordens de Produção", icon: Factory },
  { href: "/chao-fabrica/expedicao", label: "Expedição", icon: Truck },
  { href: "/chao-fabrica/entregas", label: "Entregas", icon: Navigation },
];

const lojaItems: MenuItem[] = [
  { href: "/loja", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/loja/pedidos", label: "Meus Pedidos", icon: ShoppingCart },
  { href: "/loja/ocorrencias", label: "Ocorrências", icon: AlertCircle },
];

const gestorDadosSelfItems: MenuItem[] = [
  ...gestorDadosItems,
  { href: "/gestor-dados/perfil", label: "Meu Perfil", icon: UserRound },
];

const gestorFabricaSelfItems: MenuItem[] = [
  ...gestorFabricaItems,
  { href: "/gestor-fabrica/perfil", label: "Meu Perfil", icon: UserRound },
];

const chaoFabricaSelfItems: MenuItem[] = [
  ...chaoFabricaItems,
  { href: "/chao-fabrica/perfil", label: "Meu Perfil", icon: UserRound },
];

const lojaSelfItems: MenuItem[] = [
  ...lojaItems,
  { href: "/loja/perfil", label: "Meu Perfil", icon: UserRound },
];

export const profileConfig: Record<ProfileKey, ProfileConfig> = {
  administrador: {
    title: "Administrador",
    subtitle: "Governança e visão total",
    badge: "Acesso Total",
    sections: [
      {
        label: "Administração",
        items: [
          { href: "/administrador", label: "Dashboard Executivo", icon: LayoutDashboard },
          { href: "/administrador/usuarios", label: "Usuários e Permissões", icon: ShieldCheck },
          { href: "/administrador/perfil", label: "Meu Perfil", icon: UserRound },
        ],
      },
      { label: "Gestor de Dados", items: gestorDadosItems },
      { label: "Gestor de Fábrica", items: gestorFabricaItems },
      { label: "Chão de Fábrica", items: chaoFabricaItems },
      { label: "Loja", items: lojaItems },
    ],
  },
  "gestor-dados": {
    title: "Gestor de Dados",
    subtitle: "Engenharia",
    badge: "Dados Mestres",
    items: gestorDadosSelfItems,
  },
  "gestor-fabrica": {
    title: "Gestor de Fábrica",
    subtitle: "Operacional",
    badge: "Produção",
    items: gestorFabricaSelfItems,
  },
  "chao-fabrica": {
    title: "Chão de Fábrica",
    subtitle: "Execução Diária",
    badge: "Operação",
    items: chaoFabricaSelfItems,
  },
  loja: {
    title: "Responsável de Loja",
    subtitle: "Ponto de Venda",
    badge: "Operação Loja",
    items: lojaSelfItems,
  },
};

interface SidebarProps {
  profile: ProfileKey;
  canSwitchProfiles?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  className?: string;
}

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getActiveItemHref(pathname: string, items: MenuItem[]) {
  const matches = items.filter((item) => isItemActive(pathname, item.href));
  if (matches.length === 0) {
    return null;
  }

  // Keep only one active item: the most specific (longest href).
  return matches.reduce((current, item) =>
    item.href.length > current.href.length ? item : current,
  ).href;
}

function SidebarNav({
  profile,
  collapsed,
  onNavigate,
}: {
  profile: ProfileKey;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const config = profileConfig[profile];
  const sections: MenuSection[] = config.sections ?? [{ items: config.items ?? [] }];
  const allItems = sections.flatMap((section) => section.items);
  const activeItemHref = getActiveItemHref(pathname, allItems);
  const navItemBaseClass =
    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-[background-color,color,transform,box-shadow] duration-300 ease-out";
  const [loggingOut, setLoggingOut] = useState(false);

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
          href="/"
          className={cn(
            "block rounded-xl border border-sidebar-border/70 bg-sidebar-accent/45 px-3.5 py-3 transition-[border-color,background-color] duration-300 ease-out hover:border-sidebar-border hover:bg-sidebar-accent/65",
            collapsed && "flex items-center justify-center px-0",
          )}
          onClick={onNavigate}
        >
          {!collapsed ? (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">
                Software
              </p>
              <p className="font-heading text-base font-semibold leading-none text-foreground">
                Casa Express
              </p>
              <p className="text-xs text-muted-foreground">Gestão de produção e pedidos</p>
            </div>
          ) : (
            <span className="font-heading text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
              CE
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {sections.map((section, sectionIndex) => (
          <div
            key={`${section.label ?? "menu"}-${sectionIndex}`}
            className={cn(
              "space-y-1",
              sectionIndex > 0 &&
                (collapsed ? "mt-2" : "mt-3 border-t border-sidebar-border/65 pt-3"),
            )}
          >
            {!collapsed && section.label && (
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {section.label}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = item.href === activeItemHref;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    navItemBaseClass,
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[var(--shadow-soft)]"
                      : "text-sidebar-foreground/90 hover:translate-x-0.5 hover:bg-sidebar-accent/85 hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center px-2",
                  )}
                  title={item.label}
                >
                  <Icon className="size-4 shrink-0 transition-transform duration-300 ease-out group-hover:scale-105" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-sidebar-border/80 border-t p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {config.badge}
          </p>
          <p className="mt-1 text-sm text-sidebar-foreground">{config.subtitle}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-3 w-full justify-start text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-4" />
            {loggingOut ? "Saindo..." : "Sair"}
          </Button>
        </div>
      )}

      {collapsed && (
        <div className="border-sidebar-border/80 border-t p-3">
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
      )}
    </div>
  );
}

export function Sidebar({ profile, mobileOpen, onMobileClose, className }: SidebarProps) {
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
        <SidebarNav profile={profile} collapsed={collapsed} />
      </aside>
    ),
    [className, collapsed, profile],
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
            <SheetDescription>Selecione um módulo do sistema.</SheetDescription>
          </SheetHeader>
          <SidebarNav profile={profile} collapsed={false} onNavigate={onMobileClose} />
        </SheetContent>
      </Sheet>
    );
  }

  return desktopSidebar;
}
