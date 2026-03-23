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
import {
  buildAddressSummary,
  getInitials,
  isCustomizedPermissions,
  isProfileComplete,
  normalizeStoreIdsForRole,
  roleLabels,
  supportsStoreScope,
  type ManagedUser,
  type ManagedUserStatus,
  type ProfileFormState,
  type UserAddress,
  type UserFormState,
} from "@/lib/admin-users";
import { formatBrazilPhone } from "@/lib/phone-mask";
import {
  buildDefaultPermissions,
  countAllowedModules,
  countManagementPermissions,
  describeNavigationAccess,
  hasAdministrativeAccess,
  permissionGroupLabels,
  permissionGroupOrder,
  permissionLevelLabels,
  permissionModules,
  type PermissionLevel,
  type PermissionMap,
  type PermissionModuleId,
} from "@/lib/permission-modules";
import { readClientAccessContext } from "@/lib/client-access-context";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { useManagedUsers } from "@/lib/use-managed-users";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";

function formatNavigationGroupSummary(groupLabels: string[]) {
  if (groupLabels.length === 0) {
    return "Somente Meu Perfil";
  }

  if (groupLabels.length <= 2) {
    return groupLabels.join(" · ");
  }

  return `${groupLabels.slice(0, 2).join(" · ")} +${groupLabels.length - 2}`;
}

function formatNavigationModuleSummary(moduleLabels: string[]) {
  if (moduleLabels.length === 0) {
    return "Nenhum módulo liberado";
  }

  if (moduleLabels.length <= 3) {
    return moduleLabels.join(" · ");
  }

  return `${moduleLabels.slice(0, 3).join(" · ")} +${moduleLabels.length - 3}`;
}

function buildNavigationPreview(permissions: PermissionMap, baseRole: UserRole) {
  const summary = describeNavigationAccess(permissions, baseRole);
  const groupLabels = summary.sections.map((section) => section.label);
  const moduleLabels = summary.sections.flatMap((section) =>
    section.items.map((item) => item.label),
  );

  return {
    landingPath: summary.landingPath,
    visibleModuleCount: summary.visibleModuleCount,
    visibleGroupCount: summary.visibleGroupCount,
    groupSummary: formatNavigationGroupSummary(groupLabels),
    moduleSummary: formatNavigationModuleSummary(moduleLabels),
  };
}

export default function AdministradorUsuariosPage() {
  const isReadOnlyTenantView = readClientAccessContext().accessMode === "read-only-tenant";
  const { snapshot } = useMasterDataSnapshot();
  const {
    users,
    isLoading,
    isSubmitting,
    error,
    refresh,
    createUser,
    updateUser,
    savePermissions,
    saveProfile,
  } = useManagedUsers();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);

  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userFormBaseline, setUserFormBaseline] = useState("");
  const [userForm, setUserForm] = useState<UserFormState>({
    name: "",
    email: "",
    role: "loja",
    status: "ativo",
    storeIds: [],
  });

  const [permissionUserId, setPermissionUserId] = useState<string | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<PermissionMap | null>(null);
  const [permissionFormError, setPermissionFormError] = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState | null>(null);
  const [profileFormError, setProfileFormError] = useState<string | null>(null);
  const [profileFormBaseline, setProfileFormBaseline] = useState("");
  const editingUser = useMemo(
    () => users.find((user) => user.id === editingUserId) ?? null,
    [editingUserId, users],
  );
  const activeStores = useMemo(
    () => snapshot.stores.filter((store) => store.status === "ativo"),
    [snapshot.stores],
  );
  const storeNameById = useMemo(
    () => new Map(snapshot.stores.map((store) => [store.id, store.name])),
    [snapshot.stores],
  );
  const userFormDirty = isUserDialogOpen && JSON.stringify(userForm) !== userFormBaseline;
  const profileFormDirty = Boolean(profileUserId && profileForm) && JSON.stringify(profileForm) !== profileFormBaseline;
  const userFormGuard = useUnsavedChangesGuard({
    enabled: isUserDialogOpen,
    isDirty: userFormDirty,
  });
  const profileFormGuard = useUnsavedChangesGuard({
    enabled: Boolean(profileUserId),
    isDirty: profileFormDirty,
  });

  const permissionUser = useMemo(
    () => users.find((user) => user.id === permissionUserId) ?? null,
    [permissionUserId, users],
  );
  const profileUser = useMemo(
    () => users.find((user) => user.id === profileUserId) ?? null,
    [profileUserId, users],
  );
  const baseRoleTemplatePreview = useMemo(
    () => buildNavigationPreview(buildDefaultPermissions(userForm.role), userForm.role),
    [userForm.role],
  );
  const tenantRoleOptions = useMemo(
    () => (Object.keys(roleLabels) as UserRole[]).filter((role) => role !== "administrador-master"),
    [],
  );
  const canSelectStores = supportsStoreScope(userForm.role);
  const permissionNavigationPreview = useMemo(() => {
    if (!permissionUser || !permissionDraft) {
      return null;
    }

    return buildNavigationPreview(permissionDraft, permissionUser.role);
  }, [permissionDraft, permissionUser]);

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
        <div className="flex min-w-[17rem] items-center gap-3">
          <Avatar size="sm" className="border border-border/70">
            {user.profile.avatarUrl ? (
              <AvatarImage src={user.profile.avatarUrl} alt={`Foto de ${user.name}`} />
            ) : null}
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="space-y-0.5">
            <p className="text-sm font-medium leading-5 text-foreground">{user.name}</p>
            <p className="text-xs leading-4 text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Perfil Base",
      render: (user: ManagedUser) => (
        <div className="min-w-[8.5rem]">
          <Badge variant="secondary">{roleLabels[user.role]}</Badge>
        </div>
      ),
    },
    {
      key: "status",
      header: "Situação",
      render: (user: ManagedUser) =>
        user.status === "ativo" ? (
          <div className="min-w-[8rem]">
            <span className="inline-flex items-center gap-1 rounded-full bg-success/35 px-2.5 py-1 text-xs font-semibold text-success-foreground">
              <CheckCircle2 className="size-3.5" />
              Ativo
            </span>
          </div>
        ) : (
          <div className="min-w-[8rem]">
            <span className="inline-flex items-center gap-1 rounded-full bg-danger/35 px-2.5 py-1 text-xs font-semibold text-danger-foreground">
              <XCircle className="size-3.5" />
              Inativo
            </span>
          </div>
        ),
    },
    {
      key: "profile",
      header: "Perfil",
      render: (user: ManagedUser) => (
        <div className="min-w-[11rem] space-y-0.5">
          <p className="text-sm font-medium leading-5 text-foreground">
            {user.profile.phone || "Telefone pendente"}
          </p>
          <p className="text-xs leading-4 text-muted-foreground">
            {buildAddressSummary(user.profile.address)}
          </p>
        </div>
      ),
    },
    {
      key: "permissions",
      header: "Delegação",
      render: (user: ManagedUser) => (
        <div className="min-w-[9rem] space-y-0.5">
          <p className="text-sm font-medium leading-5 text-foreground">
            {countAllowedModules(user.permissions)} módulos
          </p>
          <p className="text-xs leading-4 text-muted-foreground">
            {countManagementPermissions(user.permissions)} gerenciar
          </p>
        </div>
      ),
    },
    {
      key: "navigation",
      header: "Entrada Inicial",
      render: (user: ManagedUser) => {
        const preview = buildNavigationPreview(user.permissions, user.role);

        return (
          <div className="min-w-[11rem] space-y-0.5">
            <p className="text-sm font-medium leading-5 text-foreground">{preview.landingPath}</p>
            <p className="text-xs leading-4 text-muted-foreground">{preview.groupSummary}</p>
          </div>
        );
      },
    },
    {
      key: "storeScope",
      header: "Escopo Loja",
      render: (user: ManagedUser) =>
        supportsStoreScope(user.role) ? (
          <div className="min-w-[11rem] space-y-0.5">
            <p className="text-sm font-medium leading-5 text-foreground">
              {user.storeIds?.length
                ? `${user.storeIds.length} loja${user.storeIds.length > 1 ? "s" : ""} autorizada${user.storeIds.length > 1 ? "s" : ""}`
                : "Todas as lojas"}
            </p>
            <p className="text-xs leading-4 text-muted-foreground">
              {user.storeIds?.length
                ? user.storeIds
                    .slice(0, 2)
                    .map((storeId) => storeNameById.get(storeId) ?? storeId)
                    .join(" · ")
                : "Sem restrição por unidade"}
            </p>
          </div>
        ) : (
          <div className="min-w-[11rem] space-y-0.5">
            <p className="text-sm font-medium leading-5 text-foreground">Nao se aplica</p>
            <p className="text-xs leading-4 text-muted-foreground">
              Vinculo de lojas disponivel apenas para perfil loja
            </p>
          </div>
        ),
    },
    {
      key: "updatedAt",
      header: "Última Atualização",
      render: (user: ManagedUser) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{user.updatedAt}</span>
      ),
    },
  ];

  const actions = isReadOnlyTenantView
    ? undefined
    : [
    {
      icon: "user" as const,
      label: "Perfil e senha",
      onClick: (user: ManagedUser) => {
        setPageError(null);
        openProfileDialog(user);
      },
    },
    {
      icon: "view" as const,
      label: "Delegar permissões",
      onClick: (user: ManagedUser) => {
        setPageError(null);
        setPermissionUserId(user.id);
        setPermissionDraft({ ...user.permissions });
        setPermissionFormError(null);
      },
    },
    {
      icon: "edit" as const,
      label: "Editar usuário",
      onClick: (user: ManagedUser) => {
        setPageError(null);
        setEditingUserId(user.id);
        setUserForm({
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          storeIds: normalizeStoreIdsForRole(user.role, user.storeIds),
        });
        setUserFormBaseline(
          JSON.stringify({
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            storeIds: normalizeStoreIdsForRole(user.role, user.storeIds),
          }),
        );
        setUserFormError(null);
        setIsUserDialogOpen(true);
      },
    },
    {
      icon: "delete" as const,
      label: "Ativar/Inativar",
      variant: "destructive" as const,
      onClick: (user: ManagedUser) => {
        void handleToggleUserStatus(user);
      },
    },
  ];

  function openNewUserDialog() {
    if (isReadOnlyTenantView) {
      setPageError("O cliente selecionado está aberto em modo leitura.");
      return;
    }

    setPageError(null);
    setEditingUserId(null);
    setUserForm({
      name: "",
      email: "",
      role: "loja",
      status: "ativo",
      storeIds: [],
    });
    setUserFormBaseline(
      JSON.stringify({
        name: "",
        email: "",
        role: "loja",
        status: "ativo",
        storeIds: [],
      }),
    );
    setUserFormError(null);
    setIsUserDialogOpen(true);
  }

  function toggleAuthorizedStore(storeId: string, checked: boolean) {
    setUserForm((current) => {
      const currentStoreIds = current.storeIds ?? [];

      if (checked) {
        return {
          ...current,
          storeIds: currentStoreIds.includes(storeId)
            ? currentStoreIds
            : [...currentStoreIds, storeId],
        };
      }

      return {
        ...current,
        storeIds: currentStoreIds.filter((currentStoreId) => currentStoreId !== storeId),
      };
    });
    setUserFormError(null);
  }

  async function handleSaveUser() {
    if (isReadOnlyTenantView) {
      setUserFormError("O cliente selecionado está aberto em modo leitura.");
      return;
    }

    const name = userForm.name.trim();
    const email = userForm.email.trim().toLowerCase();
    const normalizedStoreIds = normalizeStoreIdsForRole(userForm.role, userForm.storeIds);

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

    try {
      if (editingUserId) {
        await updateUser(
          editingUserId,
          {
            name,
            email,
            role: userForm.role,
            status: userForm.status,
            storeIds: normalizedStoreIds,
          },
          editingUser?.role !== userForm.role,
        );
      } else {
        const created = await createUser({
          name,
          email,
          role: userForm.role,
          status: userForm.status,
          storeIds: normalizedStoreIds,
        });

        if (created?.temporaryPassword) {
          setPageNotice(
            `Usuário criado com acesso no Supabase Auth. Senha temporária: ${created.temporaryPassword}`,
          );
        } else {
          setPageNotice("Usuário criado com sucesso.");
        }
      }

      setPageError(null);
      setIsUserDialogOpen(false);
    } catch (saveError) {
      setUserFormError(
        saveError instanceof Error ? saveError.message : "Não foi possível salvar o usuário.",
      );
    }
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
    setPermissionFormError(null);
  }

  async function savePermissionDialog() {
    if (isReadOnlyTenantView) {
      setPermissionFormError("O cliente selecionado está aberto em modo leitura.");
      return;
    }

    if (!permissionUserId || !permissionDraft) {
      return;
    }

    try {
      await savePermissions(permissionUserId, permissionDraft);
      setPageError(null);
      setPermissionFormError(null);
      closePermissionDialog();
    } catch (saveError) {
      setPermissionFormError(
        saveError instanceof Error ? saveError.message : "Não foi possível salvar as permissões.",
      );
    }
  }

  function openProfileDialog(user: ManagedUser) {
    const nextProfileForm = {
      avatarUrl: user.profile.avatarUrl,
      phone: formatBrazilPhone(user.profile.phone),
      address: { ...user.profile.address },
      newPassword: "",
      confirmPassword: "",
    };
    setProfileUserId(user.id);
    setProfileForm(nextProfileForm);
    setProfileFormBaseline(JSON.stringify(nextProfileForm));
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

  async function saveProfileDialog() {
    if (isReadOnlyTenantView) {
      setProfileFormError("O cliente selecionado está aberto em modo leitura.");
      return;
    }

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

    try {
      await saveProfile(profileUserId, {
        avatarUrl: profileForm.avatarUrl,
        phone,
        address: normalizedAddress,
        markPasswordUpdated: Boolean(newPassword),
        newPassword: newPassword || undefined,
      });
      setPageError(null);
      setPageNotice(null);
      closeProfileDialog();
    } catch (saveError) {
      setProfileFormError(
        saveError instanceof Error ? saveError.message : "Não foi possível salvar o perfil.",
      );
    }
  }

  async function handleToggleUserStatus(user: ManagedUser) {
    if (isReadOnlyTenantView) {
      setPageError("O cliente selecionado está aberto em modo leitura.");
      return;
    }

    try {
      await updateUser(
        user.id,
        {
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status === "ativo" ? "inativo" : "ativo",
          storeIds: user.storeIds,
        },
        false,
      );
      setPageError(null);
      setPageNotice(null);
    } catch (toggleError) {
      setPageError(
        toggleError instanceof Error ? toggleError.message : "Não foi possível atualizar o status.",
      );
    }
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
        <Button type="button" onClick={openNewUserDialog} disabled={isSubmitting || isReadOnlyTenantView}>
          <Plus className="size-4" />
          Novo Usuário
        </Button>
      }
    >
      {isReadOnlyTenantView ? (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          A gestão de usuários fica bloqueada enquanto o cliente estiver aberto em modo leitura pelo administrador master.
        </div>
      ) : null}

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
          {pageNotice ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/40 bg-success/20 px-3 py-2 text-sm text-success-foreground">
              <span>{pageNotice}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPageNotice(null)}
              >
                Fechar
              </Button>
            </div>
          ) : null}

          {error || pageError ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/40 bg-danger/20 px-3 py-2 text-sm text-danger-foreground">
              <span>{pageError ?? error}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPageError(null);
                  setPageNotice(null);
                  void refresh();
                }}
                disabled={isLoading}
              >
                Tentar novamente
              </Button>
            </div>
          ) : null}

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
                })).filter((option) => option.value !== "administrador-master"),
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
            emptyMessage={isLoading ? "Carregando usuários..." : "Nenhum usuário encontrado para os filtros informados."}
            compact
            stickyHeader
            tableClassName="min-w-[1500px]"
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
              Defina o perfil-base do usuário para aplicar o template inicial de acesso.
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
              Abra a delegação e habilite os módulos realmente necessários para esse usuário.
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
          if (!open) {
            if (!userFormGuard.confirmIfNeeded()) {
              return;
            }
            setUserFormError(null);
          }
          setIsUserDialogOpen(open);
        }}
      >
        <DialogContent size="full" className="gap-0 p-0">
          <DialogHeader className="border-b border-border/70 px-6 py-5 pr-14">
            <DialogTitle>{editingUserId ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            <DialogDescription>
              O perfil-base define as permissões padrão. O escopo de lojas abaixo é opcional e funciona como uma segunda camada: quando preenchido, limita em quais unidades o usuário pode operar sempre que tiver módulos da loja liberados.
            </DialogDescription>
          </DialogHeader>

          <div className="scroll-modern grid gap-5 overflow-y-auto px-6 py-5">
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
                    setUserForm((current) => {
                      const role = value as UserRole;
                      return {
                        ...current,
                        role,
                        storeIds: normalizeStoreIdsForRole(role, current.storeIds),
                      };
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantRoleOptions.map((role) => (
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

            <div className="rounded-xl border border-border/80 bg-panel/25 p-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Preview do template do perfil-base</p>
                <p className="text-xs text-muted-foreground">
                  Esse preview mostra a rota inicial e os módulos liberados ao aplicar o perfil-base atual como padrão.
                </p>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border/70 bg-card px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Entrada inicial
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {baseRoleTemplatePreview.landingPath}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-card px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Áreas visíveis
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {baseRoleTemplatePreview.groupSummary}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-card px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Módulos padrão
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {baseRoleTemplatePreview.visibleModuleCount}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {baseRoleTemplatePreview.moduleSummary}
                  </p>
                </div>
              </div>
            </div>

            {canSelectStores ? (
              <section className="space-y-3 rounded-xl border border-border/80 bg-panel/25 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Escopo operacional da loja</p>
                  <p className="text-xs text-muted-foreground">
                    Selecione lojas apenas quando quiser restringir o acesso. Sem seleção, o usuário permanece sem limitação por unidade e o escopo só entra em ação quando houver módulos da loja delegados.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {userForm.storeIds?.length
                      ? `${userForm.storeIds.length} loja${userForm.storeIds.length > 1 ? "s" : ""} selecionada${userForm.storeIds.length > 1 ? "s" : ""}.`
                      : "Nenhuma loja selecionada. O acesso ficará sem restrição por unidade."}
                  </p>
                </div>

                {activeStores.length === 0 ? (
                  <div className="rounded-lg border border-warning/40 bg-warning/20 px-3 py-2 text-sm text-warning-foreground">
                    Não há lojas ativas disponíveis para vínculo neste momento.
                  </div>
                ) : (
                  <div className="grid max-h-[42vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                    {activeStores.map((store) => {
                      const isChecked = (userForm.storeIds ?? []).includes(store.id);

                      return (
                        <label
                          key={store.id}
                          className="flex items-start gap-3 rounded-lg border border-border/70 bg-card px-3 py-3 text-sm"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => toggleAuthorizedStore(store.id, checked === true)}
                          />
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{store.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {store.code} · Janela {store.receiveWindow}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null}

            {userFormDirty ? (
              <div className="rounded-lg border border-warning/40 bg-warning/20 px-3 py-2 text-sm text-warning-foreground">
                Existem alterações pendentes neste cadastro.
              </div>
            ) : null}

            {userFormError && (
              <div className="rounded-lg border border-danger/40 bg-danger/25 px-3 py-2 text-sm text-danger-foreground">
                {userFormError}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border/70 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!userFormGuard.confirmIfNeeded()) {
                  return;
                }
                setIsUserDialogOpen(false);
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSaveUser()} disabled={isSubmitting}>
              {editingUserId ? "Salvar alterações" : "Cadastrar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(profileUserId)}
        onOpenChange={(open) => {
          if (!open) {
            if (!profileFormGuard.confirmIfNeeded()) {
              return;
            }
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
                        updateProfileField("phone", formatBrazilPhone(event.target.value))
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
              {profileFormDirty ? (
                <div className="rounded-lg border border-warning/40 bg-warning/20 px-3 py-2 text-sm text-warning-foreground">
                  Existem alterações pendentes no perfil deste usuário.
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter className="border-t border-border/70 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!profileFormGuard.confirmIfNeeded()) {
                  return;
                }
                closeProfileDialog();
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void saveProfileDialog()} disabled={isSubmitting}>
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
                ? `Usuário: ${permissionUser.name} (${roleLabels[permissionUser.role]} como perfil-base).`
                : "Ajuste os níveis de acesso por módulo."}
            </DialogDescription>
          </DialogHeader>

          {permissionUser && permissionDraft && (
            <div className="space-y-4 py-1">
              {permissionNavigationPreview ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-border/80 bg-panel/25 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Entrada inicial
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {permissionNavigationPreview.landingPath}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      A primeira rota liberada por esta delegação.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-panel/25 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Áreas visíveis
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {permissionNavigationPreview.groupSummary}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {permissionNavigationPreview.visibleGroupCount} área{permissionNavigationPreview.visibleGroupCount === 1 ? "" : "s"} com navegação disponível.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-panel/25 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Módulos visíveis
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {permissionNavigationPreview.visibleModuleCount} módulo{permissionNavigationPreview.visibleModuleCount === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {permissionNavigationPreview.moduleSummary}
                    </p>
                  </div>
                </div>
              ) : null}

              {permissionFormError ? (
                <div className="rounded-lg border border-danger/40 bg-danger/20 px-3 py-2 text-sm text-danger-foreground">
                  {permissionFormError}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={resetPermissionDraftByRole}>
                  Aplicar perfil base
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAllPermissions("visualizar")}>
                  Liberar todos como Visualizar
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAllPermissions("operar")}>
                  Liberar todos como Operar
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAllPermissions("gerenciar")}>
                  Liberar todos como Gerenciar
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
            <Button type="button" variant="outline" onClick={closePermissionDialog} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void savePermissionDialog()} disabled={isSubmitting}>
              Salvar permissões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
