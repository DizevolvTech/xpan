"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, KeyRound, Plus, UserCog, XCircle } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { SearchFilter } from "@/components/shared/search-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { ManagedUser, UserFormState } from "@/lib/admin-users";
import { roleLabels } from "@/lib/admin-users";
import { useManagedUsers } from "@/lib/use-managed-users";

type ClientUserManagementPanelProps = {
  apiBasePath: string;
  onUsersChanged?: () => void | Promise<void>;
};

const tenantRoleOptions = Object.entries(roleLabels)
  .filter(([role]) => role !== "administrador-master")
  .map(([value, label]) => ({
    value: value as UserFormState["role"],
    label,
  }));

function buildEditableUserForm(user: ManagedUser): UserFormState {
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    storeIds: user.storeIds ?? [],
  };
}

async function notifyUsersChanged(onUsersChanged?: () => void | Promise<void>) {
  await Promise.resolve(onUsersChanged?.());
}

export function ClientUserManagementPanel({
  apiBasePath,
  onUsersChanged,
}: ClientUserManagementPanelProps) {
  const {
    users,
    isLoading,
    isSubmitting,
    error,
    createUser,
    updateUser,
    saveProfile,
  } = useManagedUsers(apiBasePath);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>({
    name: "",
    email: "",
    role: "administrador",
    status: "ativo",
    storeIds: [],
  });
  const [passwordUser, setPasswordUser] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const matchesSearch =
          normalizedSearch.length === 0 ||
          user.name.toLowerCase().includes(normalizedSearch) ||
          user.email.toLowerCase().includes(normalizedSearch);
        const matchesRole = roleFilter === "all" || user.role === roleFilter;
        const matchesStatus = statusFilter === "all" || user.status === statusFilter;

        return matchesSearch && matchesRole && matchesStatus;
      }),
    [roleFilter, searchTerm, statusFilter, users],
  );

  const columns = [
    {
      key: "name",
      header: "Usuário",
      render: (user: ManagedUser) => (
        <div className="min-w-[16rem] space-y-0.5">
          <p className="text-sm font-medium text-foreground">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Perfil Base",
      render: (user: ManagedUser) => roleLabels[user.role],
    },
    {
      key: "status",
      header: "Situação",
      render: (user: ManagedUser) =>
        user.status === "ativo" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/25 px-2.5 py-1 text-xs font-semibold text-success-foreground">
            <CheckCircle2 className="size-3.5" />
            Ativo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger/25 px-2.5 py-1 text-xs font-semibold text-danger-foreground">
            <XCircle className="size-3.5" />
            Inativo
          </span>
        ),
    },
    {
      key: "passwordUpdatedAt",
      header: "Senha",
      render: (user: ManagedUser) => (
        <div className="min-w-[10rem]">
          <p className="text-sm font-medium text-foreground">
            {user.profile.passwordUpdatedAt}
          </p>
          <p className="text-xs text-muted-foreground">Última atualização</p>
        </div>
      ),
    },
    {
      key: "updatedAt",
      header: "Última atualização",
      render: (user: ManagedUser) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {user.updatedAt}
        </span>
      ),
    },
  ];

  const actions = [
    {
      icon: "edit" as const,
      label: "Editar cadastro",
      onClick: (user: ManagedUser) => {
        setPageError(null);
        setPageNotice(null);
        setEditingUser(user);
        setUserForm(buildEditableUserForm(user));
        setEditorError(null);
        setIsEditorOpen(true);
      },
    },
    {
      icon: "user" as const,
      label: "Trocar senha",
      onClick: (user: ManagedUser) => {
        setPageError(null);
        setPageNotice(null);
        setPasswordUser(user);
        setNewPassword("");
        setConfirmPassword("");
        setPasswordError(null);
      },
    },
    {
      icon: "delete" as const,
      label: "Ativar/Inativar",
      variant: "destructive" as const,
      onClick: (user: ManagedUser) => {
        void handleToggleStatus(user);
      },
    },
  ];

  function openCreateDialog() {
    setPageError(null);
    setPageNotice(null);
    setEditingUser(null);
    setUserForm({
      name: "",
      email: "",
      role: "administrador",
      status: "ativo",
      storeIds: [],
    });
    setEditorError(null);
    setIsEditorOpen(true);
  }

  async function handleSaveUser() {
    const normalizedName = userForm.name.trim();
    const normalizedEmail = userForm.email.trim().toLowerCase();

    if (!normalizedName || !normalizedEmail) {
      setEditorError("Preencha nome e e-mail para continuar.");
      return;
    }

    const hasDuplicatedEmail = users.some(
      (user) =>
        user.email.toLowerCase() === normalizedEmail &&
        user.id !== editingUser?.id,
    );

    if (hasDuplicatedEmail) {
      setEditorError("Já existe um usuário deste cliente com este e-mail.");
      return;
    }

    try {
      if (editingUser) {
        await updateUser(
          editingUser.id,
          {
            ...userForm,
            name: normalizedName,
            email: normalizedEmail,
          },
          editingUser.role !== userForm.role,
        );
        setPageNotice("Cadastro do usuário atualizado.");
      } else {
        const created = await createUser({
          ...userForm,
          name: normalizedName,
          email: normalizedEmail,
        });
        setPageNotice(
          created.temporaryPassword
            ? `Usuário criado com senha provisória: ${created.temporaryPassword}`
            : "Usuário criado com sucesso.",
        );
      }

      await notifyUsersChanged(onUsersChanged);
      setIsEditorOpen(false);
    } catch (saveError) {
      setEditorError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar o usuário.",
      );
    }
  }

  async function handleToggleStatus(user: ManagedUser) {
    try {
      await updateUser(user.id, {
        ...buildEditableUserForm(user),
        status: user.status === "ativo" ? "inativo" : "ativo",
      });
      await notifyUsersChanged(onUsersChanged);
      setPageError(null);
      setPageNotice(
        user.status === "ativo"
          ? "Usuário inativado com sucesso."
          : "Usuário reativado com sucesso.",
      );
    } catch (toggleError) {
      setPageError(
        toggleError instanceof Error
          ? toggleError.message
          : "Não foi possível atualizar o status do usuário.",
      );
    }
  }

  async function handleResetPassword() {
    if (!passwordUser) {
      return;
    }

    if (newPassword.trim().length < 8) {
      setPasswordError("Defina uma senha com pelo menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmação da senha não confere.");
      return;
    }

    try {
      await saveProfile(passwordUser.id, {
        name: passwordUser.name,
        email: passwordUser.email,
        avatarUrl: passwordUser.profile.avatarUrl,
        phone: passwordUser.profile.phone,
        address: passwordUser.profile.address,
        newPassword,
        markPasswordUpdated: true,
      });
      await notifyUsersChanged(onUsersChanged);
      setPasswordUser(null);
      setPageError(null);
      setPageNotice("Senha atualizada com sucesso.");
    } catch (saveError) {
      setPasswordError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível atualizar a senha.",
      );
    }
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Total
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {users.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Ativos
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {users.filter((user) => user.status === "ativo").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Administrativos
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {
                users.filter((user) =>
                  ["administrador", "gestor-dados", "gestor-fabrica"].includes(
                    user.role,
                  ),
                ).length
              }
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Sem senha recente
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {
                users.filter(
                  (user) =>
                    !user.profile.passwordUpdatedAt ||
                    user.profile.passwordUpdatedAt === "-",
                ).length
              }
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Usuários do cliente</CardTitle>
            <p className="text-sm text-muted-foreground">
              Crie, ajuste, inative ou redefina o acesso dos usuários quando for
              necessário intervir pelo Master.
            </p>
          </div>
          <Button type="button" onClick={openCreateDialog} disabled={isSubmitting}>
            <Plus className="size-4" />
            Novo usuário
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error || pageError ? (
            <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
              {pageError ?? error}
            </div>
          ) : null}

          {pageNotice ? (
            <div className="rounded-lg border border-success/35 bg-success/10 px-3 py-2 text-sm text-success-foreground">
              {pageNotice}
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
                options: [
                  { value: "all", label: "Todos" },
                  ...tenantRoleOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  })),
                ],
              },
              {
                key: "status",
                label: "Situação",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: "all", label: "Todos" },
                  { value: "ativo", label: "Ativos" },
                  { value: "inativo", label: "Inativos" },
                ],
              },
            ]}
          />

          <DataTable
            data={filteredUsers}
            columns={columns}
            actions={actions}
            keyField="id"
            isLoading={isLoading}
            emptyMessage="Nenhum usuário encontrado para este cliente."
          />
        </CardContent>
      </Card>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Editar usuário" : "Novo usuário do cliente"}
            </DialogTitle>
            <DialogDescription>
              Use este fluxo quando o Master precisar corrigir cadastro, recuperar
              acesso ou preparar um novo responsável para o cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="master-user-name">Nome</Label>
              <Input
                id="master-user-name"
                value={userForm.name}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="master-user-email">E-mail</Label>
              <Input
                id="master-user-email"
                type="email"
                value={userForm.email}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Perfil base</Label>
                <Select
                  value={userForm.role}
                  onValueChange={(value) =>
                    setUserForm((current) => ({
                      ...current,
                      role: value as UserFormState["role"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantRoleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
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
                      status: value as UserFormState["status"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a situação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editorError ? (
              <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
                {editorError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditorOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveUser()}
              disabled={isSubmitting}
            >
              <UserCog className="size-4" />
              Salvar usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(passwordUser)}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordUser(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar senha do usuário</DialogTitle>
            <DialogDescription>
              Gere uma nova senha quando o cliente perder acesso ou alterar uma
              credencial crítica.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="rounded-xl border border-border/70 bg-panel/20 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                {passwordUser?.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {passwordUser?.email}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="master-user-password">Nova senha</Label>
              <Input
                id="master-user-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="master-user-password-confirm">Confirmar senha</Label>
              <Input
                id="master-user-password-confirm"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>

            {passwordError ? (
              <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
                {passwordError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPasswordUser(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleResetPassword()}
              disabled={isSubmitting}
            >
              <KeyRound className="size-4" />
              Atualizar senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
