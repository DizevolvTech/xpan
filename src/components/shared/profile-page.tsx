"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, KeyRound, LogOut, Save } from "lucide-react";

import { PageLayout } from "@/components/shared/page-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatBrazilPhone } from "@/lib/phone-mask";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";

type ProfilePageProps = {
  homeHref: string;
  homeLabel: string;
  roleLabel: string;
  initialName: string;
  initialEmail: string;
};

type ProfileAddress = {
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
};

type ProfileForm = {
  avatarUrl: string;
  name: string;
  email: string;
  phone: string;
  address: ProfileAddress;
};

type CurrentProfileResponse = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  phone: string;
  address: ProfileAddress;
  passwordUpdatedAt: string;
};

function buildInitialForm(initialName: string, initialEmail: string): ProfileForm {
  return {
    avatarUrl: "",
    name: initialName,
    email: initialEmail,
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
  };
}

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "US";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function ProfilePage({
  homeHref,
  homeLabel,
  roleLabel,
  initialName,
  initialEmail,
}: ProfilePageProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProfileForm>(() => buildInitialForm(initialName, initialEmail));
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordUpdatedAt, setPasswordUpdatedAt] = useState("-");
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify(buildInitialForm(initialName, initialEmail)),
  );
  const hasPendingPassword =
    Boolean(currentPassword.trim()) ||
    Boolean(newPassword.trim()) ||
    Boolean(confirmPassword.trim());
  const isDirty =
    !isLoadingProfile && (JSON.stringify(form) !== savedSnapshot || hasPendingPassword);
  useUnsavedChangesGuard({
    isDirty,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setIsLoadingProfile(true);

      try {
        const profile = await readJson<CurrentProfileResponse>("/api/me/profile");

        if (cancelled) {
          return;
        }

        setForm({
          avatarUrl: profile.avatarUrl,
          name: profile.name,
          email: profile.email,
          phone: formatBrazilPhone(profile.phone),
          address: profile.address,
        });
        setSavedSnapshot(
          JSON.stringify({
            avatarUrl: profile.avatarUrl,
            name: profile.name,
            email: profile.email,
            phone: formatBrazilPhone(profile.phone),
            address: profile.address,
          }),
        );
        setPasswordUpdatedAt(profile.passwordUpdatedAt);
        setErrorMessage(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "Não foi possível carregar os dados do perfil.",
        );
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateFormField<K extends keyof Omit<ProfileForm, "address">>(
    field: K,
    value: ProfileForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateAddressField<K extends keyof ProfileAddress>(
    field: K,
    value: ProfileAddress[K],
  ) {
    setForm((current) => ({
      ...current,
      address: {
        ...current.address,
        [field]: value,
      },
    }));
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setErrorMessage(null);

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Selecione um arquivo de imagem válido.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage("A foto deve ter no máximo 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateFormField("avatarUrl", typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      setErrorMessage("Não foi possível carregar a foto selecionada.");
    };
    reader.readAsDataURL(file);
  }

  function resetPasswordFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function handleSave() {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!form.name.trim() || !form.email.trim()) {
      setErrorMessage("Preencha nome e e-mail para salvar.");
      return;
    }

    if (!form.phone.trim()) {
      setErrorMessage("Preencha o telefone para salvar.");
      return;
    }

    if (
      !form.address.street.trim() ||
      !form.address.number.trim() ||
      !form.address.neighborhood.trim() ||
      !form.address.city.trim() ||
      !form.address.state.trim()
    ) {
      setErrorMessage("Preencha os campos obrigatórios de endereço (rua, número, bairro, cidade e UF).");
      return;
    }

    const passwordChanged = currentPassword || newPassword || confirmPassword;
    if (passwordChanged) {
      if (!currentPassword) {
        setErrorMessage("Informe a senha atual para alterar a senha.");
        return;
      }
      if (newPassword.length < 8) {
        setErrorMessage("A nova senha deve ter no mínimo 8 caracteres.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage("A confirmação da nova senha não confere.");
        return;
      }
    }

    setIsSaving(true);

    try {
      const normalizedAddress: ProfileAddress = {
        zipCode: form.address.zipCode.trim(),
        street: form.address.street.trim(),
        number: form.address.number.trim(),
        complement: form.address.complement.trim(),
        neighborhood: form.address.neighborhood.trim(),
        city: form.address.city.trim(),
        state: form.address.state.trim().toUpperCase(),
        country: form.address.country.trim() || "Brasil",
      };

      const updatedProfile = await readJson<CurrentProfileResponse>("/api/me/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          avatarUrl: form.avatarUrl,
          phone: form.phone.trim(),
          address: normalizedAddress,
          markPasswordUpdated: Boolean(newPassword),
          newPassword: newPassword.trim() || undefined,
        }),
      });

      setForm({
        avatarUrl: updatedProfile.avatarUrl,
        name: updatedProfile.name,
        email: updatedProfile.email,
        phone: formatBrazilPhone(updatedProfile.phone),
        address: updatedProfile.address,
      });
      setSavedSnapshot(
        JSON.stringify({
          avatarUrl: updatedProfile.avatarUrl,
          name: updatedProfile.name,
          email: updatedProfile.email,
          phone: formatBrazilPhone(updatedProfile.phone),
          address: updatedProfile.address,
        }),
      );
      setPasswordUpdatedAt(updatedProfile.passwordUpdatedAt);
      resetPasswordFields();
      setPasswordDialogOpen(false);
      setSuccessMessage("Perfil atualizado no banco com sucesso.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível salvar o perfil.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const displayName = form.name.trim() || "Sem nome";
  const displayEmail = form.email.trim() || "—";

  return (
    <PageLayout
      title="Meu Perfil"
      description="Atualize seus dados de conta, contato e endereço."
      badge="Conta"
      breadcrumbs={[
        { label: homeLabel, href: homeHref },
        { label: "Meu Perfil" },
      ]}
      actions={
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || isLoadingProfile}
        >
          <Save className="size-4" />
          {isSaving ? "Salvando..." : "Salvar alterações"}
        </Button>
      }
    >
      {/* Bloco de identidade — de-boxed, no topo */}
      <section
        aria-label="Identidade da conta"
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-4">
          <Avatar className="size-20 border border-border/[var(--opacity-strong)]">
            {form.avatarUrl ? (
              <AvatarImage src={form.avatarUrl} alt={`Foto de ${displayName}`} />
            ) : null}
            <AvatarFallback className="text-lg font-semibold">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
                {displayName}
              </h2>
              <Badge variant="secondary" className="font-medium">
                {roleLabel}
              </Badge>
            </div>
            <p className="truncate text-sm text-muted-foreground">{displayEmail}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Label
            htmlFor="profile-photo"
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border/[var(--opacity-prominent)] bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            <Camera className="size-4" />
            Trocar foto
          </Label>
          <input
            id="profile-photo"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => updateFormField("avatarUrl", "")}
            disabled={isSaving || isLoadingProfile || !form.avatarUrl}
          >
            Remover foto
          </Button>
        </div>
      </section>

      <Separator className="bg-border/[var(--opacity-border)]" />

      {/* Seção: Contato */}
      <section aria-labelledby="profile-contact-heading" className="space-y-4">
        <header className="space-y-1">
          <h3
            id="profile-contact-heading"
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Contato
          </h3>
          <p className="text-xs text-muted-foreground">
            Dados visíveis para sua equipe e usados em notificações operacionais.
          </p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="profile-name">Nome</Label>
            <Input
              id="profile-name"
              value={form.name}
              onChange={(event) => updateFormField("name", event.target.value)}
              placeholder="Nome completo"
              disabled={isSaving || isLoadingProfile}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-email">E-mail</Label>
            <Input
              id="profile-email"
              type="email"
              value={form.email}
              onChange={(event) => updateFormField("email", event.target.value)}
              placeholder="voce@empresa.com"
              disabled={isSaving || isLoadingProfile}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="profile-phone">Telefone</Label>
            <Input
              id="profile-phone"
              value={form.phone}
              onChange={(event) =>
                updateFormField("phone", formatBrazilPhone(event.target.value))
              }
              placeholder="(99) 99999-9999"
              disabled={isSaving || isLoadingProfile}
            />
          </div>
        </div>
      </section>

      <Separator className="bg-border/[var(--opacity-border)]" />

      {/* Seção: Endereço */}
      <section aria-labelledby="profile-address-heading" className="space-y-4">
        <header className="space-y-1">
          <h3
            id="profile-address-heading"
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Endereço
          </h3>
          <p className="text-xs text-muted-foreground">
            Usado em documentos fiscais e cadastros internos da rede.
          </p>
        </header>
        <div className="grid gap-3 sm:grid-cols-6">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="profile-zip">CEP</Label>
            <Input
              id="profile-zip"
              value={form.address.zipCode}
              onChange={(event) => updateAddressField("zipCode", event.target.value)}
              placeholder="00000-000"
              disabled={isSaving || isLoadingProfile}
            />
          </div>
          <div className="grid gap-2 sm:col-span-4">
            <Label htmlFor="profile-street">Rua</Label>
            <Input
              id="profile-street"
              value={form.address.street}
              onChange={(event) => updateAddressField("street", event.target.value)}
              placeholder="Nome da rua"
              disabled={isSaving || isLoadingProfile}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="profile-number">Número</Label>
            <Input
              id="profile-number"
              value={form.address.number}
              onChange={(event) => updateAddressField("number", event.target.value)}
              placeholder="123"
              disabled={isSaving || isLoadingProfile}
            />
          </div>
          <div className="grid gap-2 sm:col-span-4">
            <Label htmlFor="profile-complement">Complemento</Label>
            <Input
              id="profile-complement"
              value={form.address.complement}
              onChange={(event) => updateAddressField("complement", event.target.value)}
              placeholder="Apto, bloco, sala..."
              disabled={isSaving || isLoadingProfile}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="profile-neighborhood">Bairro</Label>
            <Input
              id="profile-neighborhood"
              value={form.address.neighborhood}
              onChange={(event) => updateAddressField("neighborhood", event.target.value)}
              placeholder="Bairro"
              disabled={isSaving || isLoadingProfile}
            />
          </div>
          <div className="grid gap-2 sm:col-span-3">
            <Label htmlFor="profile-city">Cidade</Label>
            <Input
              id="profile-city"
              value={form.address.city}
              onChange={(event) => updateAddressField("city", event.target.value)}
              placeholder="Cidade"
              disabled={isSaving || isLoadingProfile}
            />
          </div>
          <div className="grid gap-2 sm:col-span-1">
            <Label htmlFor="profile-state">UF</Label>
            <Input
              id="profile-state"
              value={form.address.state}
              onChange={(event) => updateAddressField("state", event.target.value)}
              placeholder="CE"
              disabled={isSaving || isLoadingProfile}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="profile-country">País</Label>
            <Input
              id="profile-country"
              value={form.address.country}
              onChange={(event) => updateAddressField("country", event.target.value)}
              placeholder="Brasil"
              disabled={isSaving || isLoadingProfile}
            />
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-danger/[var(--opacity-border)] bg-danger/[var(--opacity-muted)] px-3 py-2 text-sm text-danger-foreground"
        >
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div
          role="status"
          className="rounded-lg border border-success/[var(--opacity-border)] bg-success/[var(--opacity-muted)] px-3 py-2 text-sm text-success-foreground"
        >
          {successMessage}
        </div>
      ) : null}

      <Separator className="bg-border/[var(--opacity-border)]" />

      {/* Footer enxuto: segurança + sair + salvar */}
      <section
        aria-label="Conta e segurança"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p>Última troca de senha: {passwordUpdatedAt}</p>
          {isDirty ? (
            <p className="font-semibold text-warning-foreground">
              Alterações pendentes de salvamento.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog
            open={passwordDialogOpen}
            onOpenChange={(open) => {
              setPasswordDialogOpen(open);
              if (!open) {
                resetPasswordFields();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSaving || isLoadingProfile}
              >
                <KeyRound className="size-4" />
                Alterar senha
              </Button>
            </DialogTrigger>
            <DialogContent size="md">
              <DialogHeader>
                <DialogTitle>Alterar senha</DialogTitle>
                <DialogDescription>
                  Informe sua senha atual e escolha uma nova com pelo menos 8 caracteres.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="current-password">Senha atual</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="Senha atual"
                    disabled={isSaving}
                    autoComplete="current-password"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    disabled={isSaving}
                    autoComplete="new-password"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">Confirmar senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repita a nova senha"
                    disabled={isSaving}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setPasswordDialogOpen(false);
                    resetPasswordFields();
                  }}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={isSaving || !hasPendingPassword}
                >
                  <Save className="size-4" />
                  {isSaving ? "Salvando..." : "Salvar nova senha"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            aria-label="Sair da conta"
          >
            <LogOut className="size-4" />
            {isLoggingOut ? "Saindo..." : "Sair"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={isSaving || isLoadingProfile}
          >
            <Save className="size-4" />
            {isLoadingProfile ? "Carregando..." : isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </section>
    </PageLayout>
  );
}
