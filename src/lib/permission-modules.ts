import type { UserRole } from "@/lib/auth";
import type { AccessMode, TenantSummary } from "@/lib/tenant";

export type PermissionGroup =
  | "administrador-master"
  | "administrador"
  | "gestor-dados"
  | "gestor-fabrica"
  | "chao-fabrica"
  | "loja";

export type PermissionLevel = "sem_acesso" | "visualizar" | "operar" | "gerenciar";

export type PermissionIconKey =
  | "layout-dashboard"
  | "shield-check"
  | "package"
  | "shopping-cart"
  | "users"
  | "factory"
  | "store"
  | "clipboard-list"
  | "truck"
  | "navigation"
  | "alert-circle";

export type PermissionModuleDefinition = {
  id: string;
  label: string;
  route: string;
  group: PermissionGroup;
  icon: PermissionIconKey;
  sidebarOrder: number;
  landingOrder: number;
  minimumNavLevel: PermissionLevel;
  matchSubRoutes?: boolean;
};

export type NavigationItemDefinition = Pick<
  PermissionModuleDefinition,
  "id" | "label" | "route" | "group" | "icon"
>;

export type NavigationSectionDefinition = {
  group: PermissionGroup;
  label: string;
  items: NavigationItemDefinition[];
};

export type AppShellCurrentUser = {
  name: string;
  email: string;
  baseRole: UserRole;
  baseRoleLabel: string;
  profilePath: string;
};

export type AppShellNavigationContext = {
  currentUser: AppShellCurrentUser;
  landingPath: string;
  sections: NavigationSectionDefinition[];
  accessMode: AccessMode;
  effectiveTenantId: string | null;
  selectedTenant: TenantSummary | null;
};

export type NavigationAccessSummary = {
  landingPath: string;
  sections: NavigationSectionDefinition[];
  visibleModuleCount: number;
  visibleGroupCount: number;
};

export const appAreaPath: Record<PermissionGroup, string> = {
  "administrador-master": "/administrador-master",
  administrador: "/administrador",
  "gestor-dados": "/gestor-dados",
  "gestor-fabrica": "/gestor-fabrica",
  "chao-fabrica": "/chao-fabrica",
  loja: "/loja",
};

export const roleProfilePath: Record<UserRole, string> = {
  "administrador-master": "/administrador-master/perfil",
  administrador: "/administrador/perfil",
  "gestor-dados": "/gestor-dados/perfil",
  "gestor-fabrica": "/gestor-fabrica/perfil",
  "chao-fabrica": "/chao-fabrica/perfil",
  loja: "/loja/perfil",
};

export const permissionGroupOrder: PermissionGroup[] = [
  "administrador-master",
  "administrador",
  "gestor-dados",
  "gestor-fabrica",
  "chao-fabrica",
  "loja",
];

export const permissionGroupLabels: Record<PermissionGroup, string> = {
  "administrador-master": "Administrador Master",
  administrador: "Administracao",
  "gestor-dados": "Gestor de Dados",
  "gestor-fabrica": "Gestor de Fabrica",
  "chao-fabrica": "Chao de Fabrica",
  loja: "Loja",
};

export const permissionGroupMeta: Record<
  PermissionGroup,
  {
    label: string;
    subtitle: string;
    badge: string;
    route: string;
  }
> = {
  "administrador-master": {
    label: "Administrador Master",
    subtitle: "SaaS, clientes e governança central",
    badge: "Controle SaaS",
    route: appAreaPath["administrador-master"],
  },
  administrador: {
    label: "Administrador",
    subtitle: "Governança e visão total",
    badge: "Acesso por capacidade",
    route: appAreaPath.administrador,
  },
  "gestor-dados": {
    label: "Gestor de Dados",
    subtitle: "Dados mestres e estrutura operacional",
    badge: "Dados Mestres",
    route: appAreaPath["gestor-dados"],
  },
  "gestor-fabrica": {
    label: "Gestor de Fábrica",
    subtitle: "Planejamento e coordenação da fábrica",
    badge: "Produção",
    route: appAreaPath["gestor-fabrica"],
  },
  "chao-fabrica": {
    label: "Chão de Fábrica",
    subtitle: "Execução diária da operação",
    badge: "Execução",
    route: appAreaPath["chao-fabrica"],
  },
  loja: {
    label: "Loja",
    subtitle: "Operação do ponto de venda",
    badge: "Operação Loja",
    route: appAreaPath.loja,
  },
};

export const permissionLevelLabels: Record<PermissionLevel, string> = {
  sem_acesso: "Sem acesso",
  visualizar: "Visualizar",
  operar: "Operar",
  gerenciar: "Gerenciar",
};

export const permissionLevelRank: Record<PermissionLevel, number> = {
  sem_acesso: 0,
  visualizar: 1,
  operar: 2,
  gerenciar: 3,
};

export const permissionModules = [
  {
    id: "administrador-master.dashboard",
    label: "Painel SaaS",
    route: "/administrador-master",
    group: "administrador-master",
    icon: "layout-dashboard",
    sidebarOrder: 10,
    landingOrder: 10,
    minimumNavLevel: "visualizar",
  },
  {
    id: "administrador-master.clientes",
    label: "Clientes",
    route: "/administrador-master/clientes",
    group: "administrador-master",
    icon: "shield-check",
    sidebarOrder: 20,
    landingOrder: 20,
    minimumNavLevel: "visualizar",
    matchSubRoutes: true,
  },
  {
    id: "administrador.dashboard",
    label: "Dashboard Executivo",
    route: "/administrador",
    group: "administrador",
    icon: "layout-dashboard",
    sidebarOrder: 10,
    landingOrder: 10,
    minimumNavLevel: "visualizar",
  },
  {
    id: "administrador.usuarios",
    label: "Usuários e Permissões",
    route: "/administrador/usuarios",
    group: "administrador",
    icon: "shield-check",
    sidebarOrder: 20,
    landingOrder: 20,
    minimumNavLevel: "visualizar",
    matchSubRoutes: true,
  },
  {
    id: "administrador.ocorrencias",
    label: "Canal com o Sistema",
    route: "/administrador/ocorrencias",
    group: "administrador",
    icon: "alert-circle",
    sidebarOrder: 30,
    landingOrder: 30,
    minimumNavLevel: "visualizar",
    matchSubRoutes: true,
  },
  {
    id: "gestor-dados.dashboard",
    label: "Visão Geral",
    route: "/gestor-dados",
    group: "gestor-dados",
    icon: "layout-dashboard",
    sidebarOrder: 10,
    landingOrder: 110,
    minimumNavLevel: "visualizar",
  },
  {
    id: "gestor-dados.ingredientes",
    label: "Ingredientes",
    route: "/gestor-dados/ingredientes",
    group: "gestor-dados",
    icon: "package",
    sidebarOrder: 20,
    landingOrder: 120,
    minimumNavLevel: "visualizar",
  },
  {
    id: "gestor-dados.produtos",
    label: "Produtos",
    route: "/gestor-dados/produtos",
    group: "gestor-dados",
    icon: "shopping-cart",
    sidebarOrder: 30,
    landingOrder: 130,
    minimumNavLevel: "visualizar",
  },
  {
    id: "gestor-dados.setores",
    label: "Categorias",
    route: "/gestor-dados/setores",
    group: "gestor-dados",
    icon: "users",
    sidebarOrder: 40,
    landingOrder: 140,
    minimumNavLevel: "visualizar",
    matchSubRoutes: true,
  },
  {
    id: "gestor-dados.linhas",
    label: "Subcategorias",
    route: "/gestor-dados/linhas-producao",
    group: "gestor-dados",
    icon: "factory",
    sidebarOrder: 50,
    landingOrder: 150,
    minimumNavLevel: "visualizar",
    matchSubRoutes: true,
  },
  {
    id: "gestor-dados.lojas",
    label: "Lojas",
    route: "/gestor-dados/lojas",
    group: "gestor-dados",
    icon: "store",
    sidebarOrder: 60,
    landingOrder: 160,
    minimumNavLevel: "visualizar",
    matchSubRoutes: true,
  },
  {
    id: "gestor-fabrica.dashboard",
    label: "Visão Geral",
    route: "/gestor-fabrica",
    group: "gestor-fabrica",
    icon: "layout-dashboard",
    sidebarOrder: 10,
    landingOrder: 210,
    minimumNavLevel: "visualizar",
  },
  {
    id: "gestor-fabrica.sublinhas",
    label: "Linhas - Subcategoria",
    route: "/gestor-fabrica/sublinhas-producao",
    group: "gestor-fabrica",
    icon: "clipboard-list",
    sidebarOrder: 20,
    landingOrder: 220,
    minimumNavLevel: "visualizar",
  },
  {
    id: "gestor-fabrica.pedidos",
    label: "Pedidos",
    route: "/gestor-fabrica/pedidos",
    group: "gestor-fabrica",
    icon: "shopping-cart",
    sidebarOrder: 30,
    landingOrder: 230,
    minimumNavLevel: "visualizar",
    matchSubRoutes: true,
  },
  {
    id: "gestor-fabrica.ops",
    label: "Ordens de Produção",
    route: "/gestor-fabrica/ordens-producao",
    group: "gestor-fabrica",
    icon: "factory",
    sidebarOrder: 40,
    landingOrder: 240,
    minimumNavLevel: "visualizar",
    matchSubRoutes: true,
  },
  {
    id: "gestor-fabrica.expedicao",
    label: "Expedição",
    route: "/gestor-fabrica/expedicao",
    group: "gestor-fabrica",
    icon: "truck",
    sidebarOrder: 50,
    landingOrder: 250,
    minimumNavLevel: "visualizar",
    matchSubRoutes: true,
  },
  {
    id: "gestor-fabrica.ocorrencias",
    label: "Ocorrências",
    route: "/gestor-fabrica/ocorrencias",
    group: "gestor-fabrica",
    icon: "alert-circle",
    sidebarOrder: 60,
    landingOrder: 260,
    minimumNavLevel: "visualizar",
    matchSubRoutes: true,
  },
  {
    id: "chao-fabrica.dashboard",
    label: "Visão Geral",
    route: "/chao-fabrica",
    group: "chao-fabrica",
    icon: "layout-dashboard",
    sidebarOrder: 10,
    landingOrder: 310,
    minimumNavLevel: "visualizar",
  },
  {
    id: "chao-fabrica.ops",
    label: "Ordens de Produção",
    route: "/chao-fabrica/ordens-producao",
    group: "chao-fabrica",
    icon: "factory",
    sidebarOrder: 20,
    landingOrder: 320,
    minimumNavLevel: "visualizar",
    matchSubRoutes: true,
  },
  {
    id: "chao-fabrica.expedicao",
    label: "Expedição",
    route: "/chao-fabrica/expedicao",
    group: "chao-fabrica",
    icon: "truck",
    sidebarOrder: 30,
    landingOrder: 330,
    minimumNavLevel: "visualizar",
    matchSubRoutes: true,
  },
  {
    id: "chao-fabrica.entregas",
    label: "Entregas",
    route: "/chao-fabrica/entregas",
    group: "chao-fabrica",
    icon: "navigation",
    sidebarOrder: 40,
    landingOrder: 340,
    minimumNavLevel: "visualizar",
  },
  {
    id: "loja.dashboard",
    label: "Visão Geral",
    route: "/loja",
    group: "loja",
    icon: "layout-dashboard",
    sidebarOrder: 10,
    landingOrder: 410,
    minimumNavLevel: "visualizar",
  },
  {
    id: "loja.pedidos",
    label: "Meus Pedidos",
    route: "/loja/pedidos",
    group: "loja",
    icon: "shopping-cart",
    sidebarOrder: 20,
    landingOrder: 420,
    minimumNavLevel: "visualizar",
    matchSubRoutes: true,
  },
  {
    id: "loja.ocorrencias",
    label: "Ocorrências",
    route: "/loja/ocorrencias",
    group: "loja",
    icon: "alert-circle",
    sidebarOrder: 30,
    landingOrder: 430,
    minimumNavLevel: "visualizar",
  },
] as const satisfies ReadonlyArray<PermissionModuleDefinition>;

export type PermissionModuleId = (typeof permissionModules)[number]["id"];
export type PermissionMap = Record<PermissionModuleId, PermissionLevel>;

export function buildEmptyPermissions(): PermissionMap {
  return permissionModules.reduce<PermissionMap>((acc, module) => {
    acc[module.id] = "sem_acesso";
    return acc;
  }, {} as PermissionMap);
}

function applyGroupLevel(
  permissions: PermissionMap,
  group: PermissionGroup,
  level: PermissionLevel,
) {
  permissionModules.forEach((module) => {
    if (module.group === group) {
      permissions[module.id] = level;
    }
  });
}

export function buildDefaultPermissions(role: UserRole): PermissionMap {
  const permissions = buildEmptyPermissions();

  switch (role) {
    case "administrador":
      permissionModules.forEach((module) => {
        if (module.group !== "administrador-master") {
          permissions[module.id] = "gerenciar";
        }
      });
      break;
    case "administrador-master":
      applyGroupLevel(permissions, "administrador-master", "gerenciar");
      break;
    case "gestor-dados":
      applyGroupLevel(permissions, "gestor-dados", "gerenciar");
      break;
    case "gestor-fabrica":
      applyGroupLevel(permissions, "gestor-fabrica", "gerenciar");
      applyGroupLevel(permissions, "chao-fabrica", "visualizar");
      break;
    case "chao-fabrica":
      applyGroupLevel(permissions, "chao-fabrica", "operar");
      break;
    case "loja":
      applyGroupLevel(permissions, "loja", "operar");
      break;
    default:
      break;
  }

  return permissions;
}

export function sanitizePermissionsForRole(
  permissions: PermissionMap,
  role: UserRole,
): PermissionMap {
  const nextPermissions = { ...permissions };

  permissionModules.forEach((module) => {
    if (role === "administrador-master" && module.group !== "administrador-master") {
      nextPermissions[module.id] = "sem_acesso";
      return;
    }

    if (role !== "administrador-master" && module.group === "administrador-master") {
      nextPermissions[module.id] = "sem_acesso";
    }
  });

  return nextPermissions;
}

export function hasPermissionLevel(
  currentLevel: PermissionLevel | undefined,
  minimumLevel: PermissionLevel,
) {
  return permissionLevelRank[currentLevel ?? "sem_acesso"] >= permissionLevelRank[minimumLevel];
}

export function canAccessPermission(
  permissions: PermissionMap,
  permissionId: PermissionModuleId,
  minimumLevel: PermissionLevel = "visualizar",
) {
  return hasPermissionLevel(permissions[permissionId], minimumLevel);
}

export function canAccessAnyPermission(
  permissions: PermissionMap,
  permissionIds: PermissionModuleId[],
  minimumLevel: PermissionLevel = "visualizar",
) {
  return permissionIds.some((permissionId) =>
    canAccessPermission(permissions, permissionId, minimumLevel),
  );
}

export function getPermissionModule(permissionId: PermissionModuleId) {
  return permissionModules.find((module) => module.id === permissionId) ?? null;
}

export function matchesPermissionModulePath(pathname: string, module: PermissionModuleDefinition) {
  if (pathname === module.route) {
    return true;
  }

  if (!module.matchSubRoutes) {
    return false;
  }

  return pathname.startsWith(`${module.route}/`);
}

export function findPermissionModuleByPath(pathname: string) {
  const matches = permissionModules.filter((module) =>
    matchesPermissionModulePath(pathname, module),
  );

  if (matches.length === 0) {
    return null;
  }

  return matches.reduce((current, module) =>
    module.route.length > current.route.length ? module : current,
  );
}

export function getVisibleNavigationModules(permissions: PermissionMap) {
  return permissionModules
    .filter((module) =>
      canAccessPermission(permissions, module.id, module.minimumNavLevel),
    )
    .sort((left, right) => {
      const groupDelta =
        permissionGroupOrder.indexOf(left.group) - permissionGroupOrder.indexOf(right.group);

      if (groupDelta !== 0) {
        return groupDelta;
      }

      return left.sidebarOrder - right.sidebarOrder;
    });
}

export function buildNavigationSections(
  permissions: PermissionMap,
): NavigationSectionDefinition[] {
  return permissionGroupOrder
    .map((group) => {
      const items = getVisibleNavigationModules(permissions)
        .filter((module) => module.group === group)
        .map<NavigationItemDefinition>((module) => ({
          id: module.id,
          label: module.label,
          route: module.route,
          group: module.group,
          icon: module.icon,
        }));

      if (items.length === 0) {
        return null;
      }

      return {
        group,
        label: permissionGroupMeta[group].label,
        items,
      };
    })
    .filter((section): section is NavigationSectionDefinition => section !== null);
}

export function hasVisibleNavigationInGroup(
  permissions: PermissionMap,
  group: PermissionGroup,
) {
  return getVisibleNavigationModules(permissions).some((module) => module.group === group);
}

export function resolveLandingPath(
  permissions: PermissionMap,
  baseRole: UserRole,
) {
  const firstAllowedModule = permissionModules
    .filter((module) =>
      canAccessPermission(permissions, module.id, module.minimumNavLevel),
    )
    .sort((left, right) => left.landingOrder - right.landingOrder)[0];

  return firstAllowedModule?.route ?? roleProfilePath[baseRole];
}

export function describeNavigationAccess(
  permissions: PermissionMap,
  baseRole: UserRole,
): NavigationAccessSummary {
  const sections = buildNavigationSections(permissions);

  return {
    landingPath: resolveLandingPath(permissions, baseRole),
    sections,
    visibleModuleCount: sections.reduce((total, section) => total + section.items.length, 0),
    visibleGroupCount: sections.length,
  };
}

export function countAllowedModules(permissions: PermissionMap) {
  return permissionModules.filter((module) => permissions[module.id] !== "sem_acesso").length;
}

export function countManagementPermissions(permissions: PermissionMap) {
  return permissionModules.filter((module) => permissions[module.id] === "gerenciar").length;
}

export function hasAdministrativeAccess(permissions: PermissionMap) {
  return permissionModules.some(
    (module) =>
      (module.group === "administrador" || module.group === "administrador-master") &&
      permissions[module.id] !== "sem_acesso",
  );
}

export function hasAnyNonStoreAccess(permissions: PermissionMap) {
  return permissionModules.some(
    (module) =>
      module.group !== "loja" && canAccessPermission(permissions, module.id, "visualizar"),
  );
}

export function isProtectedAppPath(pathname: string) {
  return Object.values(appAreaPath).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
