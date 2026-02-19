"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, KeyRound, Plus, UserCog, Users, XCircle } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { SearchFilter } from "@/components/shared/search-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserRole } from "@/lib/auth";

type PermissionGroup =
  | "administrador"
  | "gestor-dados"
  | "gestor-fabrica"
  | "chao-fabrica"
  | "loja";
type PermissionLevel = "sem_acesso" | "visualizar" | "operar" | "gerenciar";
type ManagedUserStatus = "ativo" | "inativo";

type PermissionModuleDefinition = {
  id: string;
  label: string;
  route: string;
  group: PermissionGroup;
};

const permissionModules = [
  { id: "administrador.dashboard", label: "Dashboard administrativo", route: "/administrador", group: "administrador" },
  { id: "administrador.usuarios", label: "Gestão de usuários", route: "/administrador/usuarios", group: "administrador" },
  { id: "gestor-dados.dashboard", label: "Visão geral de dados", route: "/gestor-dados", group: "gestor-dados" },
  { id: "gestor-dados.ingredientes", label: "Ingredientes", route: "/gestor-dados/ingredientes", group: "gestor-dados" },
  { id: "gestor-dados.produtos", label: "Produtos", route: "/gestor-dados/produtos", group: "gestor-dados" },
  { id: "gestor-dados.setores", label: "Setores", route: "/gestor-dados/setores", group: "gestor-dados" },
  { id: "gestor-dados.linhas", label: "Linhas de produção", route: "/gestor-dados/linhas-producao", group: "gestor-dados" },
  { id: "gestor-dados.lojas", label: "Lojas", route: "/gestor-dados/lojas", group: "gestor-dados" },
  { id: "gestor-fabrica.dashboard", label: "Visão geral da fábrica", route: "/gestor-fabrica", group: "gestor-fabrica" },
  { id: "gestor-fabrica.sublinhas", label: "Sublinhas de produção", route: "/gestor-fabrica/sublinhas-producao", group: "gestor-fabrica" },
  { id: "gestor-fabrica.pedidos", label: "Pedidos", route: "/gestor-fabrica/pedidos", group: "gestor-fabrica" },
  { id: "gestor-fabrica.ops", label: "Ordens de produção", route: "/gestor-fabrica/ordens-producao", group: "gestor-fabrica" },
  { id: "gestor-fabrica.expedicao", label: "Expedição", route: "/gestor-fabrica/expedicao", group: "gestor-fabrica" },
  { id: "chao-fabrica.dashboard", label: "Visão geral de execução", route: "/chao-fabrica", group: "chao-fabrica" },
  { id: "chao-fabrica.ops", label: "Execução de OP", route: "/chao-fabrica/ordens-producao", group: "chao-fabrica" },
  { id: "chao-fabrica.expedicao", label: "Execução da expedição", route: "/chao-fabrica/expedicao", group: "chao-fabrica" },
  { id: "loja.dashboard", label: "Visão geral da loja", route: "/loja", group: "loja" },
  { id: "loja.pedidos", label: "Pedidos da loja", route: "/loja/pedidos", group: "loja" },
  { id: "loja.ocorrencias", label: "Ocorrências da loja", route: "/loja/ocorrencias", group: "loja" },
] as const satisfies ReadonlyArray<PermissionModuleDefinition>;

type PermissionModuleId = (typeof permissionModules)[number]["id"];
type PermissionMap = Record<PermissionModuleId, PermissionLevel>;

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: ManagedUserStatus;
  updatedAt: string;
  permissions: PermissionMap;
};

type UserFormState = {
  name: string;
  email: string;
  role: UserRole;
  status: ManagedUserStatus;
};

const permissionGroupOrder: PermissionGroup[] = [
  "administrador",
  "gestor-dados",
  "gestor-fabrica",
  "chao-fabrica",
  "loja",
];

const permissionGroupLabels: Record<PermissionGroup, string> = {
  administrador: "Administração",
  "gestor-dados": "Gestor de Dados",
  "gestor-fabrica": "Gestor de Fábrica",
  "chao-fabrica": "Chão de Fábrica",
  loja: "Loja",
};

const permissionLevelLabels: Record<PermissionLevel, string> = {
  sem_acesso: "Sem acesso",
  visualizar: "Visualizar",
  operar: "Operar",
  gerenciar: "Gerenciar",
};

const roleLabels: Record<UserRole, string> = {
  administrador: "Administrador",
  "gestor-dados": "Gestor de Dados",
  "gestor-fabrica": "Gestor de Fábrica",
  "chao-fabrica": "Chão de Fábrica",
  loja: "Loja",
};

function buildEmptyPermissions(): PermissionMap {
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

function buildDefaultPermissions(role: UserRole): PermissionMap {
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

function countAllowedModules(permissions: PermissionMap) {
  return permissionModules.filter((module) => permissions[module.id] !== "sem_acesso").length;
}

function countManagementPermissions(permissions: PermissionMap) {
  return permissionModules.filter((module) => permissions[module.id] === "gerenciar").length;
}

function hasAdministrativeAccess(permissions: PermissionMap) {
  return permissionModules.some(
    (module) =>
      module.group === "administrador" && permissions[module.id] !== "sem_acesso",
  );
}

function isCustomizedPermissions(user: ManagedUser) {
  const defaults = buildDefaultPermissions(user.role);
  return permissionModules.some(
    (module) => user.permissions[module.id] !== defaults[module.id],
  );
}

function nowLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
}

const initialUsers: ManagedUser[] = [
  {
    id: "user-admin",
    name: "Administrador Geral",
    email: "admin@danielaugusto.com",
    role: "administrador",
    status: "ativo",
    updatedAt: "19/02/2026, 10:00",
    permissions: buildDefaultPermissions("administrador"),
  },
  {
    id: "user-dados",
    name: "Fernanda Engenharia",
    email: "engenharia@danielaugusto.com",
    role: "gestor-dados",
    status: "ativo",
    updatedAt: "19/02/2026, 09:20",
    permissions: buildDefaultPermissions("gestor-dados"),
  },
  {
    id: "user-fabrica",
    name: "Marcos Fabrica",
    email: "fabrica@danielaugusto.com",
    role: "gestor-fabrica",
    status: "ativo",
    updatedAt: "19/02/2026, 08:45",
    permissions: buildDefaultPermissions("gestor-fabrica"),
  },
  {
    id: "user-chao",
    name: "Equipe Chão",
    email: "chao@danielaugusto.com",
    role: "chao-fabrica",
    status: "ativo",
    updatedAt: "18/02/2026, 17:10",
    permissions: buildDefaultPermissions("chao-fabrica"),
  },
  {
    id: "user-loja",
    name: "Rommel Filho",
    email: "loja@danielaugusto.com",
    role: "loja",
    status: "inativo",
    updatedAt: "17/02/2026, 15:45",
    permissions: {
      ...buildDefaultPermissions("loja"),
      "gestor-fabrica.pedidos": "visualizar",
    },
  },
];

export default function AdministradorUsuariosPage() {
  const [users, setUsers] = useState<ManagedUser[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>({
    name: "",
    email: "",
    role: "loja",
    status: "ativo",
  });

  const [permissionUserId, setPermissionUserId] = useState<string | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<PermissionMap | null>(null);

  const permissionUser = useMemo(
    () => users.find((user) => user.id === permissionUserId) ?? null,
    [permissionUserId, users],
  );

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch =
          term.length === 0 ||
          user.name.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term);
        const matchesRole = roleFilter === "all" || user.role === roleFilter;
        const matchesStatus = statusFilter === "all" || user.status === statusFilter;

        return matchesSearch && matchesRole && matchesStatus;
      }),
    [roleFilter, searchTerm, statusFilter, users],
  );

  const kpis = useMemo(
    () => ({
      total: users.length,
      ativos: users.filter((user) => user.status === "ativo").length,
      admin: users.filter((user) => hasAdministrativeAccess(user.permissions)).length,
      customizados: users.filter((user) => isCustomizedPermissions(user)).length,
    }),
    [users],
  );

  const columns = [
    {
      key: "name",
      header: "Usuário",
      render: (user: ManagedUser) => (
        <div className="space-y-1">
          <p className="font-medium text-foreground">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Perfil Base",
      render: (user: ManagedUser) => (
        <Badge variant="secondary">{roleLabels[user.role]}</Badge>
      ),
    },
    {
      key: "status",
      header: "Situação",
      render: (user: ManagedUser) =>
        user.status === "ativo" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/35 px-2.5 py-1 text-xs font-semibold text-success-foreground">
            <CheckCircle2 className="size-3.5" />
            Ativo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger/35 px-2.5 py-1 text-xs font-semibold text-danger-foreground">
            <XCircle className="size-3.5" />
            Inativo
          </span>
        ),
    },
    {
      key: "permissions",
      header: "Delegação",
      render: (user: ManagedUser) => (
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {countAllowedModules(user.permissions)} módulos liberados
          </p>
          <p className="text-xs text-muted-foreground">
            {countManagementPermissions(user.permissions)} com nível gerenciar
          </p>
        </div>
      ),
    },
    {
      key: "updatedAt",
      header: "Última Atualização",
      render: (user: ManagedUser) => (
        <span className="text-xs text-muted-foreground">{user.updatedAt}</span>
      ),
    },
  ];

  const actions = [
    {
      icon: "view" as const,
      label: "Delegar permissões",
      onClick: (user: ManagedUser) => {
        setPermissionUserId(user.id);
        setPermissionDraft({ ...user.permissions });
      },
    },
    {
      icon: "edit" as const,
      label: "Editar usuário",
      onClick: (user: ManagedUser) => {
        setEditingUserId(user.id);
        setUserForm({
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        });
        setUserFormError(null);
        setIsUserDialogOpen(true);
      },
    },
    {
      icon: "delete" as const,
      label: "Ativar/Inativar",
      variant: "destructive" as const,
      onClick: (user: ManagedUser) => {
        setUsers((current) =>
          current.map((item) =>
            item.id === user.id
              ? {
                  ...item,
                  status: item.status === "ativo" ? "inativo" : "ativo",
                  updatedAt: nowLabel(),
                }
              : item,
          ),
        );
      },
    },
  ];

  function openNewUserDialog() {
    setEditingUserId(null);
    setUserForm({
      name: "",
      email: "",
      role: "loja",
      status: "ativo",
    });
    setUserFormError(null);
    setIsUserDialogOpen(true);
  }

  function handleSaveUser() {
    const name = userForm.name.trim();
    const email = userForm.email.trim().toLowerCase();

    if (!name || !email) {
      setUserFormError("Preencha nome e e-mail para continuar.");
      return;
    }

    if (editingUserId) {
      setUsers((current) =>
        current.map((user) => {
          if (user.id !== editingUserId) {
            return user;
          }

          const roleChanged = user.role !== userForm.role;

          return {
            ...user,
            name,
            email,
            role: userForm.role,
            status: userForm.status,
            updatedAt: nowLabel(),
            permissions: roleChanged
              ? buildDefaultPermissions(userForm.role)
              : user.permissions,
          };
        }),
      );
    } else {
      const newUser: ManagedUser = {
        id: `user-${Date.now()}`,
        name,
        email,
        role: userForm.role,
        status: userForm.status,
        updatedAt: nowLabel(),
        permissions: buildDefaultPermissions(userForm.role),
      };
      setUsers((current) => [newUser, ...current]);
    }

    setIsUserDialogOpen(false);
  }

  function updatePermissionDraft(moduleId: PermissionModuleId, level: PermissionLevel) {
    setPermissionDraft((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        [moduleId]: level,
      };
    });
  }

  function resetPermissionDraftByRole() {
    if (!permissionUser) {
      return;
    }
    setPermissionDraft(buildDefaultPermissions(permissionUser.role));
  }

  function setAllPermissions(level: PermissionLevel) {
    setPermissionDraft((current) => {
      if (!current) {
        return current;
      }

      const next = { ...current };
      permissionModules.forEach((module) => {
        next[module.id] = level;
      });
      return next;
    });
  }

  function closePermissionDialog() {
    setPermissionUserId(null);
    setPermissionDraft(null);
  }

  function savePermissionDialog() {
    if (!permissionUserId || !permissionDraft) {
      return;
    }

    setUsers((current) =>
      current.map((user) =>
        user.id === permissionUserId
          ? {
              ...user,
              permissions: permissionDraft,
              updatedAt: nowLabel(),
            }
          : user,
      ),
    );
    closePermissionDialog();
  }

  return (
    <PageLayout
      title="Gestão de Usuários"
      description="Delegue acessos e permissões por tipo de usuário e por página do sistema."
      badge="Administração"
      breadcrumbs={[
        { label: "Administrador", href: "/administrador" },
        { label: "Usuários e Permissões" },
      ]}
      actions={
        <Button type="button" onClick={openNewUserDialog}>
          <Plus className="size-4" />
          Novo Usuário
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard title="Usuários cadastrados" value={kpis.total} icon={Users} tone="info" />
        <KPICard title="Usuários ativos" value={kpis.ativos} icon={CheckCircle2} tone="success" />
        <KPICard title="Com acesso admin" value={kpis.admin} icon={KeyRound} tone="warning" />
        <KPICard title="Permissões customizadas" value={kpis.customizados} icon={UserCog} tone="neutral" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cadastro e Delegação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchFilter
            searchPlaceholder="Buscar por nome ou e-mail..."
            searchValue={searchTerm}
            onSearch={setSearchTerm}
            filters={[
              {
                key: "role",
                label: "Perfil",
                value: roleFilter,
                onChange: setRoleFilter,
                options: (Object.keys(roleLabels) as UserRole[]).map((role) => ({
                  value: role,
                  label: roleLabels[role],
                })),
              },
              {
                key: "status",
                label: "Situação",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: "ativo", label: "Ativo" },
                  { value: "inativo", label: "Inativo" },
                ],
              },
            ]}
          />

          <DataTable
            data={filteredUsers}
            columns={columns}
            actions={actions}
            keyField="id"
            emptyMessage="Nenhum usuário encontrado para os filtros informados."
            stickyHeader
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <div className="rounded-lg border border-border/70 bg-panel/45 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Passo 1
            </p>
            <p className="mt-1 font-medium text-foreground">
              Defina o perfil base do usuário ao criar ou editar o cadastro.
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/45 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Passo 2
            </p>
            <p className="mt-1 font-medium text-foreground">
              Abra a delegação e habilite os módulos necessários por tipo de usuário.
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/45 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Passo 3
            </p>
            <p className="mt-1 font-medium text-foreground">
              Ajuste o nível de acesso: visualizar, operar ou gerenciar cada módulo.
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isUserDialogOpen}
        onOpenChange={(open) => {
          setIsUserDialogOpen(open);
          if (!open) {
            setUserFormError(null);
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{editingUserId ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            <DialogDescription>
              O perfil base define permissões padrão. Ajustes finos podem ser feitos em
              delegação de permissões.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="user-name">Nome</Label>
              <Input
                id="user-name"
                value={userForm.name}
                onChange={(event) =>
                  setUserForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Nome do usuário"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-email">E-mail</Label>
              <Input
                id="user-email"
                type="email"
                value={userForm.email}
                onChange={(event) =>
                  setUserForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="usuario@empresa.com"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Perfil base</Label>
                <Select
                  value={userForm.role}
                  onValueChange={(value) =>
                    setUserForm((current) => ({ ...current, role: value as UserRole }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(roleLabels) as UserRole[]).map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabels[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Situação</Label>
                <Select
                  value={userForm.status}
                  onValueChange={(value) =>
                    setUserForm((current) => ({
                      ...current,
                      status: value as ManagedUserStatus,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {userFormError && (
              <div className="rounded-lg border border-danger/40 bg-danger/25 px-3 py-2 text-sm text-danger-foreground">
                {userFormError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUserDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSaveUser}>
              {editingUserId ? "Salvar alterações" : "Cadastrar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(permissionUserId)}
        onOpenChange={(open) => {
          if (!open) {
            closePermissionDialog();
          }
        }}
      >
        <DialogContent size="3xl">
          <DialogHeader>
            <DialogTitle>Delegação de Permissões</DialogTitle>
            <DialogDescription>
              {permissionUser
                ? `Usuário: ${permissionUser.name} (${roleLabels[permissionUser.role]}).`
                : "Ajuste os níveis de acesso por módulo."}
            </DialogDescription>
          </DialogHeader>

          {permissionUser && permissionDraft && (
            <div className="space-y-4 py-1">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={resetPermissionDraftByRole}>
                  Aplicar perfil base
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAllPermissions("operar")}>
                  Liberar todos como Operar
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAllPermissions("sem_acesso")}>
                  Bloquear todos
                </Button>
              </div>

              <div className="max-h-[58vh] space-y-4 overflow-y-auto pr-1">
                {permissionGroupOrder.map((group) => {
                  const groupModules = permissionModules.filter(
                    (module) => module.group === group,
                  );
                  const allowedCount = groupModules.filter(
                    (module) => permissionDraft[module.id] !== "sem_acesso",
                  ).length;

                  return (
                    <section key={group} className="space-y-2 rounded-xl border border-border/80 p-3">
                      <div className="flex items-center justify-between border-b border-border/70 pb-2">
                        <h4 className="text-sm font-semibold text-foreground">
                          {permissionGroupLabels[group]}
                        </h4>
                        <span className="text-xs text-muted-foreground">
                          {allowedCount}/{groupModules.length} liberados
                        </span>
                      </div>

                      <div className="space-y-2">
                        {groupModules.map((module) => {
                          const currentLevel = permissionDraft[module.id];
                          const hasAccess = currentLevel !== "sem_acesso";

                          return (
                            <div
                              key={module.id}
                              className="grid gap-3 rounded-lg border border-border/65 bg-panel/30 p-3 md:grid-cols-[1fr_140px_200px]"
                            >
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">{module.label}</p>
                                <p className="text-xs text-muted-foreground">{module.route}</p>
                              </div>

                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`permission-${module.id}`}
                                  checked={hasAccess}
                                  onCheckedChange={(checked) => {
                                    updatePermissionDraft(
                                      module.id,
                                      checked === true ? "visualizar" : "sem_acesso",
                                    );
                                  }}
                                />
                                <Label
                                  htmlFor={`permission-${module.id}`}
                                  className="text-xs text-muted-foreground"
                                >
                                  Acesso
                                </Label>
                              </div>

                              <Select
                                value={currentLevel}
                                onValueChange={(value) =>
                                  updatePermissionDraft(
                                    module.id,
                                    value as PermissionLevel,
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(permissionLevelLabels) as PermissionLevel[]).map(
                                    (level) => (
                                      <SelectItem key={level} value={level}>
                                        {permissionLevelLabels[level]}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closePermissionDialog}>
              Cancelar
            </Button>
            <Button type="button" onClick={savePermissionDialog}>
              Salvar permissões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
