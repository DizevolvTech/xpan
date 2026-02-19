"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import {
  Camera,
  CheckCircle2,
  KeyRound,
  Plus,
  ShieldCheck,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { SearchFilter } from "@/components/shared/search-filter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

type UserAddress = {
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
};

type ManagedUserProfile = {
  avatarUrl: string;
  phone: string;
  address: UserAddress;
  passwordUpdatedAt: string;
};

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: ManagedUserStatus;
  updatedAt: string;
  permissions: PermissionMap;
  profile: ManagedUserProfile;
};

type UserFormState = {
  name: string;
  email: string;
  role: UserRole;
  status: ManagedUserStatus;
};

type ProfileFormState = {
  avatarUrl: string;
  phone: string;
  address: UserAddress;
  newPassword: string;
  confirmPassword: string;
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

function buildEmptyAddress(): UserAddress {
  return {
    zipCode: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    country: "Brasil",
  };
}

function buildProfile(
  profile?: Partial<Omit<ManagedUserProfile, "address">> & {
    address?: Partial<UserAddress>;
  },
): ManagedUserProfile {
  return {
    avatarUrl: profile?.avatarUrl ?? "",
    phone: profile?.phone ?? "",
    address: {
      ...buildEmptyAddress(),
      ...profile?.address,
    },
    passwordUpdatedAt: profile?.passwordUpdatedAt ?? "-",
  };
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

function isProfileComplete(user: ManagedUser) {
  const { phone, address } = user.profile;
  return Boolean(
    phone.trim() &&
      address.street.trim() &&
      address.number.trim() &&
      address.neighborhood.trim() &&
      address.city.trim() &&
      address.state.trim(),
  );
}

function getInitials(name: string) {
  const pieces = name.trim().split(/\s+/).filter(Boolean);
  if (pieces.length === 0) {
    return "US";
  }
  if (pieces.length === 1) {
    return pieces[0].slice(0, 2).toUpperCase();
  }
  return `${pieces[0][0] ?? ""}${pieces[pieces.length - 1][0] ?? ""}`.toUpperCase();
}

function buildAddressSummary(address: UserAddress) {
  const cityState = [address.city.trim(), address.state.trim()].filter(Boolean).join(" / ");
  return cityState || "Endereço não informado";
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
    profile: buildProfile({
      phone: "(85) 98888-1000",
      address: {
        zipCode: "60000-001",
        street: "Av. Dom Luís",
        number: "1000",
        complement: "Sala 201",
        neighborhood: "Aldeota",
        city: "Fortaleza",
        state: "CE",
        country: "Brasil",
      },
      passwordUpdatedAt: "19/02/2026, 08:00",
    }),
  },
  {
    id: "user-dados",
    name: "Fernanda Engenharia",
    email: "engenharia@danielaugusto.com",
    role: "gestor-dados",
    status: "ativo",
    updatedAt: "19/02/2026, 09:20",
    permissions: buildDefaultPermissions("gestor-dados"),
    profile: buildProfile({
      phone: "(85) 98888-1001",
      address: {
        zipCode: "60115-080",
        street: "Rua Joaquim Nabuco",
        number: "340",
        complement: "Bloco B",
        neighborhood: "Meireles",
        city: "Fortaleza",
        state: "CE",
        country: "Brasil",
      },
      passwordUpdatedAt: "18/02/2026, 15:40",
    }),
  },
  {
    id: "user-fabrica",
    name: "Marcos Fabrica",
    email: "fabrica@danielaugusto.com",
    role: "gestor-fabrica",
    status: "ativo",
    updatedAt: "19/02/2026, 08:45",
    permissions: buildDefaultPermissions("gestor-fabrica"),
    profile: buildProfile({
      phone: "(85) 98888-1002",
      address: {
        zipCode: "60833-120",
        street: "Rua das Oficinas",
        number: "82",
        complement: "",
        neighborhood: "Distrito Industrial",
        city: "Fortaleza",
        state: "CE",
        country: "Brasil",
      },
      passwordUpdatedAt: "17/02/2026, 11:25",
    }),
  },
  {
    id: "user-chao",
    name: "Equipe Chão",
    email: "chao@danielaugusto.com",
    role: "chao-fabrica",
    status: "ativo",
    updatedAt: "18/02/2026, 17:10",
    permissions: buildDefaultPermissions("chao-fabrica"),
    profile: buildProfile({
      phone: "(85) 98888-1003",
      address: {
        zipCode: "60833-120",
        street: "Rua das Oficinas",
        number: "120",
        complement: "Galpão 3",
        neighborhood: "Distrito Industrial",
        city: "Fortaleza",
        state: "CE",
        country: "Brasil",
      },
      passwordUpdatedAt: "16/02/2026, 10:05",
    }),
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
    profile: buildProfile({
      phone: "",
      address: {
        zipCode: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        country: "Brasil",
      },
      passwordUpdatedAt: "14/02/2026, 09:00",
    }),
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
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState | null>(null);
  const [profileFormError, setProfileFormError] = useState<string | null>(null);

  const permissionUser = useMemo(
    () => users.find((user) => user.id === permissionUserId) ?? null,
    [permissionUserId, users],
  );
  const profileUser = useMemo(
    () => users.find((user) => user.id === profileUserId) ?? null,
    [profileUserId, users],
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
      perfisCompletos: users.filter((user) => isProfileComplete(user)).length,
      customizados: users.filter((user) => isCustomizedPermissions(user)).length,
    }),
    [users],
  );

  const columns = [
    {
      key: "name",
      header: "Usuário",
      render: (user: ManagedUser) => (
        <div className="flex items-center gap-3">
          <Avatar size="sm" className="border border-border/70">
            {user.profile.avatarUrl ? (
              <AvatarImage src={user.profile.avatarUrl} alt={`Foto de ${user.name}`} />
            ) : null}
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
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
      key: "profile",
      header: "Perfil",
      render: (user: ManagedUser) => (
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {user.profile.phone || "Telefone não informado"}
          </p>
          <p className="text-xs text-muted-foreground">
            {buildAddressSummary(user.profile.address)}
          </p>
        </div>
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
      icon: "user" as const,
      label: "Perfil e senha",
      onClick: (user: ManagedUser) => {
        openProfileDialog(user);
      },
    },
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

    const hasDuplicatedEmail = users.some(
      (user) => user.email.toLowerCase() === email && user.id !== editingUserId,
    );
    if (hasDuplicatedEmail) {
      setUserFormError("Já existe um usuário cadastrado com este e-mail.");
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
        profile: buildProfile(),
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

  function openProfileDialog(user: ManagedUser) {
    setProfileUserId(user.id);
    setProfileForm({
      avatarUrl: user.profile.avatarUrl,
      phone: user.profile.phone,
      address: { ...user.profile.address },
      newPassword: "",
      confirmPassword: "",
    });
    setProfileFormError(null);
  }

  function updateProfileField<K extends keyof Omit<ProfileFormState, "address">>(
    field: K,
    value: ProfileFormState[K],
  ) {
    setProfileForm((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        [field]: value,
      };
    });
  }

  function updateProfileAddressField<K extends keyof UserAddress>(
    field: K,
    value: UserAddress[K],
  ) {
    setProfileForm((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        address: {
          ...current.address,
          [field]: value,
        },
      };
    });
  }

  function handleProfilePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setProfileFormError("Selecione um arquivo de imagem válido.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setProfileFormError("A foto deve ter no máximo 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      updateProfileField("avatarUrl", result);
      setProfileFormError(null);
    };
    reader.onerror = () => {
      setProfileFormError("Não foi possível carregar a foto selecionada.");
    };
    reader.readAsDataURL(file);
  }

  function closeProfileDialog() {
    setProfileUserId(null);
    setProfileForm(null);
    setProfileFormError(null);
  }

  function saveProfileDialog() {
    if (!profileUserId || !profileForm) {
      return;
    }

    const phone = profileForm.phone.trim();
    if (!phone) {
      setProfileFormError("Informe o telefone do usuário.");
      return;
    }

    const normalizedAddress: UserAddress = {
      zipCode: profileForm.address.zipCode.trim(),
      street: profileForm.address.street.trim(),
      number: profileForm.address.number.trim(),
      complement: profileForm.address.complement.trim(),
      neighborhood: profileForm.address.neighborhood.trim(),
      city: profileForm.address.city.trim(),
      state: profileForm.address.state.trim().toUpperCase(),
      country: profileForm.address.country.trim() || "Brasil",
    };

    if (
      !normalizedAddress.street ||
      !normalizedAddress.number ||
      !normalizedAddress.neighborhood ||
      !normalizedAddress.city ||
      !normalizedAddress.state
    ) {
      setProfileFormError(
        "Preencha rua, número, bairro, cidade e UF para salvar o endereço.",
      );
      return;
    }

    const newPassword = profileForm.newPassword.trim();
    const confirmPassword = profileForm.confirmPassword.trim();

    if (newPassword || confirmPassword) {
      if (newPassword.length < 8) {
        setProfileFormError("A nova senha deve ter no mínimo 8 caracteres.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setProfileFormError("A confirmação de senha não confere.");
        return;
      }
    }

    const changedAt = nowLabel();

    setUsers((current) =>
      current.map((user) =>
        user.id === profileUserId
          ? {
              ...user,
              updatedAt: changedAt,
              profile: {
                ...user.profile,
                avatarUrl: profileForm.avatarUrl,
                phone,
                address: normalizedAddress,
                passwordUpdatedAt: newPassword
                  ? changedAt
                  : user.profile.passwordUpdatedAt,
              },
            }
          : user,
      ),
    );

    closeProfileDialog();
  }

  return (
    <PageLayout
      title="Gestão de Usuários"
      description="Delegue acessos e mantenha dados de perfil, contato, endereço e segurança dos usuários."
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KPICard title="Usuários cadastrados" value={kpis.total} icon={Users} tone="info" />
        <KPICard title="Usuários ativos" value={kpis.ativos} icon={CheckCircle2} tone="success" />
        <KPICard title="Com acesso admin" value={kpis.admin} icon={KeyRound} tone="warning" />
        <KPICard title="Perfis completos" value={kpis.perfisCompletos} icon={UserCog} tone="neutral" />
        <KPICard
          title="Permissões customizadas"
          value={kpis.customizados}
          icon={ShieldCheck}
          tone="info"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cadastro, Perfil e Delegação</CardTitle>
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
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
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
              Abra o perfil para manter foto, telefone, endereço e senha atualizados.
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/45 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Passo 3
            </p>
            <p className="mt-1 font-medium text-foreground">
              Abra a delegação e habilite os módulos necessários por tipo de usuário.
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/45 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Passo 4
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
        open={Boolean(profileUserId)}
        onOpenChange={(open) => {
          if (!open) {
            closeProfileDialog();
          }
        }}
      >
        <DialogContent size="3xl">
          <DialogHeader>
            <DialogTitle>Perfil do Usuário</DialogTitle>
            <DialogDescription>
              {profileUser
                ? `Atualize foto, contato, endereço e senha de ${profileUser.name}.`
                : "Ajuste os dados de perfil do usuário."}
            </DialogDescription>
          </DialogHeader>

          {profileUser && profileForm && (
            <div className="space-y-4 py-1">
              <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                <section className="space-y-4 rounded-xl border border-border/80 bg-panel/20 p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Foto e Contato</p>
                    <p className="text-xs text-muted-foreground">
                      Atualize a foto e o telefone principal.
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <Avatar className="size-16 border border-border/70">
                      {profileForm.avatarUrl ? (
                        <AvatarImage
                          src={profileForm.avatarUrl}
                          alt={`Foto de ${profileUser.name}`}
                        />
                      ) : null}
                      <AvatarFallback className="text-base font-semibold">
                        {getInitials(profileUser.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex flex-col gap-2">
                      <Label
                        htmlFor="profile-photo-input"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-2 text-xs font-semibold text-foreground"
                      >
                        <Camera className="size-4" />
                        Selecionar foto
                      </Label>
                      <input
                        id="profile-photo-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleProfilePhotoChange}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateProfileField("avatarUrl", "")}
                      >
                        Remover foto
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="profile-phone">Telefone</Label>
                    <Input
                      id="profile-phone"
                      value={profileForm.phone}
                      onChange={(event) =>
                        updateProfileField("phone", event.target.value)
                      }
                      placeholder="(99) 99999-9999"
                    />
                  </div>
                </section>

                <section className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Endereço</p>
                    <p className="text-xs text-muted-foreground">
                      Dados usados para identificação e contato administrativo.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-2">
                      <Label htmlFor="profile-zip">CEP</Label>
                      <Input
                        id="profile-zip"
                        value={profileForm.address.zipCode}
                        onChange={(event) =>
                          updateProfileAddressField("zipCode", event.target.value)
                        }
                        placeholder="00000-000"
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="profile-street">Rua</Label>
                      <Input
                        id="profile-street"
                        value={profileForm.address.street}
                        onChange={(event) =>
                          updateProfileAddressField("street", event.target.value)
                        }
                        placeholder="Nome da rua"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-2">
                      <Label htmlFor="profile-number">Número</Label>
                      <Input
                        id="profile-number"
                        value={profileForm.address.number}
                        onChange={(event) =>
                          updateProfileAddressField("number", event.target.value)
                        }
                        placeholder="123"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="profile-complement">Complemento</Label>
                      <Input
                        id="profile-complement"
                        value={profileForm.address.complement}
                        onChange={(event) =>
                          updateProfileAddressField("complement", event.target.value)
                        }
                        placeholder="Apto, bloco, sala..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="profile-neighborhood">Bairro</Label>
                      <Input
                        id="profile-neighborhood"
                        value={profileForm.address.neighborhood}
                        onChange={(event) =>
                          updateProfileAddressField("neighborhood", event.target.value)
                        }
                        placeholder="Bairro"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="profile-city">Cidade</Label>
                      <Input
                        id="profile-city"
                        value={profileForm.address.city}
                        onChange={(event) =>
                          updateProfileAddressField("city", event.target.value)
                        }
                        placeholder="Cidade"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="profile-state">UF</Label>
                      <Input
                        id="profile-state"
                        value={profileForm.address.state}
                        onChange={(event) =>
                          updateProfileAddressField("state", event.target.value)
                        }
                        placeholder="CE"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="profile-country">País</Label>
                    <Input
                      id="profile-country"
                      value={profileForm.address.country}
                      onChange={(event) =>
                        updateProfileAddressField("country", event.target.value)
                      }
                      placeholder="Brasil"
                    />
                  </div>
                </section>
              </div>

              <section className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Segurança</p>
                    <p className="text-xs text-muted-foreground">
                      Edite a senha quando necessário.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Última alteração de senha: {profileUser.profile.passwordUpdatedAt}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="profile-new-password">Nova senha</Label>
                    <Input
                      id="profile-new-password"
                      type="password"
                      value={profileForm.newPassword}
                      onChange={(event) =>
                        updateProfileField("newPassword", event.target.value)
                      }
                      placeholder="Mínimo de 8 caracteres"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profile-confirm-password">Confirmar senha</Label>
                    <Input
                      id="profile-confirm-password"
                      type="password"
                      value={profileForm.confirmPassword}
                      onChange={(event) =>
                        updateProfileField("confirmPassword", event.target.value)
                      }
                      placeholder="Repita a nova senha"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Deixe os campos de senha em branco para manter a senha atual.
                </p>
              </section>

              {profileFormError && (
                <div className="rounded-lg border border-danger/40 bg-danger/25 px-3 py-2 text-sm text-danger-foreground">
                  {profileFormError}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeProfileDialog}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveProfileDialog}>
              Salvar perfil
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
