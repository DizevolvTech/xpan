"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Camera, KeyRound, MapPin, Phone, Save, UserRound } from "lucide-react";

import { PageLayout } from "@/components/shared/page-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [form, setForm] = useState<ProfileForm>(() => buildInitialForm(initialName, initialEmail));
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [passwordUpdatedAt, setPasswordUpdatedAt] = useState("-");
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify(buildInitialForm(initialName, initialEmail)),
  );
  const isDirty =
    !isLoadingProfile &&
    (JSON.stringify(form) !== savedSnapshot ||
      Boolean(currentPassword.trim()) ||
      Boolean(newPassword.trim()) ||
      Boolean(confirmPassword.trim()));
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
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage("Perfil atualizado no banco com sucesso.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível salvar o perfil.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageLayout
      title="Meu Perfil"
      description={`Gerencie seus dados de conta e segurança (${roleLabel}).`}
      badge="Conta"
      breadcrumbs={[
        { label: homeLabel, href: homeHref },
        { label: "Meu Perfil" },
      ]}
      actions={
        <Button type="button" onClick={() => void handleSave()} disabled={isSaving || isLoadingProfile}>
          <Save className="size-4" />
          {isSaving ? "Salvando..." : "Salvar alterações"}
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Conta e Contato</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="rounded-lg border border-border/[var(--opacity-prominent)] bg-panel/[var(--opacity-border)] p-4">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="size-20 border border-border/[var(--opacity-strong)]">
                {form.avatarUrl ? <AvatarImage src={form.avatarUrl} alt={`Foto de ${form.name}`} /> : null}
                <AvatarFallback className="text-base font-semibold">
                  {getInitials(form.name)}
                </AvatarFallback>
              </Avatar>
              <Label
                htmlFor="profile-photo"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/[var(--opacity-prominent)] bg-card px-3 py-2 text-xs font-semibold text-foreground"
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
                variant="outline"
                size="sm"
                onClick={() => updateFormField("avatarUrl", "")}
                disabled={isSaving || isLoadingProfile}
              >
                Remover foto
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="profile-name">Nome</Label>
              <Input
                id="profile-name"
                value={form.name}
                onChange={(event) => updateFormField("name", event.target.value)}
                placeholder="Nome completo"
                disabled={isSaving || isLoadingProfile}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
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
              <Label htmlFor="profile-phone" className="inline-flex items-center gap-2">
                <Phone className="size-4" />
                Telefone
              </Label>
              <Input
                id="profile-phone"
                value={form.phone}
                onChange={(event) => updateFormField("phone", formatBrazilPhone(event.target.value))}
                placeholder="(99) 99999-9999"
                disabled={isSaving || isLoadingProfile}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <MapPin className="size-4" />
            Endereço
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="profile-zip">CEP</Label>
            <Input
              id="profile-zip"
              value={form.address.zipCode}
              onChange={(event) => updateAddressField("zipCode", event.target.value)}
              placeholder="00000-000"
              disabled={isSaving || isLoadingProfile}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="profile-street">Rua</Label>
            <Input
              id="profile-street"
              value={form.address.street}
              onChange={(event) => updateAddressField("street", event.target.value)}
              placeholder="Nome da rua"
              disabled={isSaving || isLoadingProfile}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-number">Número</Label>
            <Input
              id="profile-number"
              value={form.address.number}
              onChange={(event) => updateAddressField("number", event.target.value)}
              placeholder="123"
              disabled={isSaving || isLoadingProfile}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-complement">Complemento</Label>
            <Input
              id="profile-complement"
              value={form.address.complement}
              onChange={(event) => updateAddressField("complement", event.target.value)}
              placeholder="Apto, bloco, sala..."
              disabled={isSaving || isLoadingProfile}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-neighborhood">Bairro</Label>
            <Input
              id="profile-neighborhood"
              value={form.address.neighborhood}
              onChange={(event) => updateAddressField("neighborhood", event.target.value)}
              placeholder="Bairro"
              disabled={isSaving || isLoadingProfile}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="profile-city">Cidade</Label>
            <Input
              id="profile-city"
              value={form.address.city}
              onChange={(event) => updateAddressField("city", event.target.value)}
              placeholder="Cidade"
              disabled={isSaving || isLoadingProfile}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-state">UF</Label>
            <Input
              id="profile-state"
              value={form.address.state}
              onChange={(event) => updateAddressField("state", event.target.value)}
              placeholder="CE"
              disabled={isSaving || isLoadingProfile}
            />
          </div>
          <div className="grid gap-2 sm:col-span-3">
            <Label htmlFor="profile-country">País</Label>
            <Input
              id="profile-country"
              value={form.address.country}
              onChange={(event) => updateAddressField("country", event.target.value)}
              placeholder="Brasil"
              disabled={isSaving || isLoadingProfile}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <KeyRound className="size-4" />
            Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="current-password">Senha atual</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Senha atual"
              disabled={isSaving || isLoadingProfile}
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
              disabled={isSaving || isLoadingProfile}
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
              disabled={isSaving || isLoadingProfile}
            />
          </div>
        </CardContent>
      </Card>

      {errorMessage ? (
        <div className="rounded-lg border border-danger/[var(--opacity-border)] bg-danger/[var(--opacity-muted)] px-3 py-2 text-sm text-danger-foreground">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-lg border border-success/[var(--opacity-border)] bg-success/[var(--opacity-muted)] px-3 py-2 text-sm text-success-foreground">
          {successMessage}
        </div>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Alterações são persistidas no banco e, quando o usuário já estiver vinculado ao Supabase Auth, a senha também é sincronizada.
            </p>
            <p className="text-xs text-muted-foreground">
              Última atualização de senha: {passwordUpdatedAt}
            </p>
            {isDirty ? (
              <p className="text-xs font-semibold text-warning-foreground">Alterações pendentes de salvamento.</p>
            ) : null}
          </div>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || isLoadingProfile}
          >
            <UserRound className="size-4" />
            {isLoadingProfile ? "Carregando..." : isSaving ? "Salvando..." : "Salvar perfil"}
          </Button>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
