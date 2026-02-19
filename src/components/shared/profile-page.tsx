"use client";

import { useState, type ChangeEvent } from "react";
import { Camera, KeyRound, MapPin, Phone, Save, UserRound } from "lucide-react";

import { PageLayout } from "@/components/shared/page-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [form, setForm] = useState<ProfileForm>({
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
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  function handleSave() {
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

    setSuccessMessage("Perfil atualizado localmente no front-end.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
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
        <Button type="button" onClick={handleSave}>
          <Save className="size-4" />
          Salvar alterações
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Conta e Contato</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="rounded-lg border border-border/75 bg-panel/35 p-4">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="size-20 border border-border/70">
                {form.avatarUrl ? <AvatarImage src={form.avatarUrl} alt={`Foto de ${form.name}`} /> : null}
                <AvatarFallback className="text-base font-semibold">
                  {getInitials(form.name)}
                </AvatarFallback>
              </Avatar>
              <Label
                htmlFor="profile-photo"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-2 text-xs font-semibold text-foreground"
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
                onChange={(event) => updateFormField("phone", event.target.value)}
                placeholder="(99) 99999-9999"
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
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="profile-street">Rua</Label>
            <Input
              id="profile-street"
              value={form.address.street}
              onChange={(event) => updateAddressField("street", event.target.value)}
              placeholder="Nome da rua"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-number">Número</Label>
            <Input
              id="profile-number"
              value={form.address.number}
              onChange={(event) => updateAddressField("number", event.target.value)}
              placeholder="123"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-complement">Complemento</Label>
            <Input
              id="profile-complement"
              value={form.address.complement}
              onChange={(event) => updateAddressField("complement", event.target.value)}
              placeholder="Apto, bloco, sala..."
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-neighborhood">Bairro</Label>
            <Input
              id="profile-neighborhood"
              value={form.address.neighborhood}
              onChange={(event) => updateAddressField("neighborhood", event.target.value)}
              placeholder="Bairro"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="profile-city">Cidade</Label>
            <Input
              id="profile-city"
              value={form.address.city}
              onChange={(event) => updateAddressField("city", event.target.value)}
              placeholder="Cidade"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-state">UF</Label>
            <Input
              id="profile-state"
              value={form.address.state}
              onChange={(event) => updateAddressField("state", event.target.value)}
              placeholder="CE"
            />
          </div>
          <div className="grid gap-2 sm:col-span-3">
            <Label htmlFor="profile-country">País</Label>
            <Input
              id="profile-country"
              value={form.address.country}
              onChange={(event) => updateAddressField("country", event.target.value)}
              placeholder="Brasil"
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
            />
          </div>
        </CardContent>
      </Card>

      {errorMessage && (
        <div className="rounded-lg border border-danger/40 bg-danger/25 px-3 py-2 text-sm text-danger-foreground">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-success/40 bg-success/25 px-3 py-2 text-sm text-success-foreground">
          {successMessage}
        </div>
      )}

      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            Alterações são locais no front-end por enquanto e não persistem em backend.
          </p>
          <Button type="button" onClick={handleSave}>
            <UserRound className="size-4" />
            Salvar perfil
          </Button>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
