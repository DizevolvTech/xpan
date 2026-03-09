import type { UserRole } from "@/lib/auth";

export type PermissionGroup =
  | "administrador"
  | "gestor-dados"
  | "gestor-fabrica"
  | "chao-fabrica"
  | "loja";

export type PermissionLevel = "sem_acesso" | "visualizar" | "operar" | "gerenciar";

export type PermissionModuleDefinition = {
  id: string;
  label: string;
  route: string;
  group: PermissionGroup;
};

export const permissionModules = [
  { id: "administrador.dashboard", label: "Dashboard administrativo", route: "/administrador", group: "administrador" },
  { id: "administrador.usuarios", label: "Gestao de usuarios", route: "/administrador/usuarios", group: "administrador" },
  { id: "gestor-dados.dashboard", label: "Visao geral de dados", route: "/gestor-dados", group: "gestor-dados" },
  { id: "gestor-dados.ingredientes", label: "Ingredientes", route: "/gestor-dados/ingredientes", group: "gestor-dados" },
  { id: "gestor-dados.produtos", label: "Produtos", route: "/gestor-dados/produtos", group: "gestor-dados" },
  { id: "gestor-dados.setores", label: "Categorias", route: "/gestor-dados/setores", group: "gestor-dados" },
  { id: "gestor-dados.linhas", label: "Subcategorias", route: "/gestor-dados/linhas-producao", group: "gestor-dados" },
  { id: "gestor-dados.lojas", label: "Lojas", route: "/gestor-dados/lojas", group: "gestor-dados" },
  { id: "gestor-fabrica.dashboard", label: "Visao geral da fabrica", route: "/gestor-fabrica", group: "gestor-fabrica" },
  { id: "gestor-fabrica.sublinhas", label: "Linhas", route: "/gestor-fabrica/sublinhas-producao", group: "gestor-fabrica" },
  { id: "gestor-fabrica.pedidos", label: "Pedidos", route: "/gestor-fabrica/pedidos", group: "gestor-fabrica" },
  { id: "gestor-fabrica.ops", label: "Ordens de producao", route: "/gestor-fabrica/ordens-producao", group: "gestor-fabrica" },
  { id: "gestor-fabrica.expedicao", label: "Expedicao", route: "/gestor-fabrica/expedicao", group: "gestor-fabrica" },
  { id: "chao-fabrica.dashboard", label: "Visao geral de execucao", route: "/chao-fabrica", group: "chao-fabrica" },
  { id: "chao-fabrica.ops", label: "Execucao de OP", route: "/chao-fabrica/ordens-producao", group: "chao-fabrica" },
  { id: "chao-fabrica.expedicao", label: "Execucao da expedicao", route: "/chao-fabrica/expedicao", group: "chao-fabrica" },
  { id: "loja.dashboard", label: "Visao geral da loja", route: "/loja", group: "loja" },
  { id: "loja.pedidos", label: "Pedidos da loja", route: "/loja/pedidos", group: "loja" },
  { id: "loja.ocorrencias", label: "Ocorrencias da loja", route: "/loja/ocorrencias", group: "loja" },
] as const satisfies ReadonlyArray<PermissionModuleDefinition>;

export type PermissionModuleId = (typeof permissionModules)[number]["id"];
export type PermissionMap = Record<PermissionModuleId, PermissionLevel>;

export const permissionGroupOrder: PermissionGroup[] = [
  "administrador",
  "gestor-dados",
  "gestor-fabrica",
  "chao-fabrica",
  "loja",
];

export const permissionGroupLabels: Record<PermissionGroup, string> = {
  administrador: "Administracao",
  "gestor-dados": "Gestor de Dados",
  "gestor-fabrica": "Gestor de Fabrica",
  "chao-fabrica": "Chao de Fabrica",
  loja: "Loja",
};

export const permissionLevelLabels: Record<PermissionLevel, string> = {
  sem_acesso: "Sem acesso",
  visualizar: "Visualizar",
  operar: "Operar",
  gerenciar: "Gerenciar",
};

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
        permissions[module.id] = "gerenciar";
      });
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

export function countAllowedModules(permissions: PermissionMap) {
  return permissionModules.filter((module) => permissions[module.id] !== "sem_acesso").length;
}

export function countManagementPermissions(permissions: PermissionMap) {
  return permissionModules.filter((module) => permissions[module.id] === "gerenciar").length;
}

export function hasAdministrativeAccess(permissions: PermissionMap) {
  return permissionModules.some(
    (module) =>
      module.group === "administrador" && permissions[module.id] !== "sem_acesso",
  );
}
