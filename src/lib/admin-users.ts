import type { UserRole } from "@/lib/auth";
import {
  buildDefaultPermissions,
  permissionModules,
  type PermissionMap,
} from "@/lib/permission-modules";
import { formatBrazilPhone } from "@/lib/phone-mask";

export type ManagedUserStatus = "ativo" | "inativo";

export type UserAddress = {
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
};

export type ManagedUserProfile = {
  avatarUrl: string;
  phone: string;
  address: UserAddress;
  passwordUpdatedAt: string;
};

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: ManagedUserStatus;
  updatedAt: string;
  permissions: PermissionMap;
  profile: ManagedUserProfile;
  storeIds?: string[];
};

export type UserFormState = {
  name: string;
  email: string;
  role: UserRole;
  status: ManagedUserStatus;
  storeIds?: string[];
};

export type ProfileFormState = {
  avatarUrl: string;
  phone: string;
  address: UserAddress;
  newPassword: string;
  confirmPassword: string;
};

export type ManagedUserProfileInput = {
  name?: string;
  email?: string;
  avatarUrl: string;
  phone: string;
  address: UserAddress;
  markPasswordUpdated?: boolean;
  newPassword?: string;
};

export const roleLabels: Record<UserRole, string> = {
  administrador: "Administrador",
  "gestor-dados": "Gestor de Dados",
  "gestor-fabrica": "Gestor de Fábrica",
  "chao-fabrica": "Chão de Fábrica",
  loja: "Loja",
};

export function buildEmptyAddress(): UserAddress {
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

export function buildProfile(
  profile?: Partial<Omit<ManagedUserProfile, "address">> & {
    address?: Partial<UserAddress>;
  },
): ManagedUserProfile {
  return {
    avatarUrl: profile?.avatarUrl ?? "",
    phone: formatBrazilPhone(profile?.phone ?? ""),
    address: {
      ...buildEmptyAddress(),
      ...profile?.address,
    },
    passwordUpdatedAt: profile?.passwordUpdatedAt ?? "-",
  };
}

export function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function getInitials(name: string) {
  const pieces = name.trim().split(/\s+/).filter(Boolean);
  if (pieces.length === 0) {
    return "US";
  }
  if (pieces.length === 1) {
    return pieces[0].slice(0, 2).toUpperCase();
  }
  return `${pieces[0][0] ?? ""}${pieces[pieces.length - 1][0] ?? ""}`.toUpperCase();
}

export function buildAddressSummary(address: UserAddress) {
  const cityState = [address.city.trim(), address.state.trim()].filter(Boolean).join(" / ");
  return cityState || "Endereço não informado";
}

export function isCustomizedPermissions(user: ManagedUser) {
  const defaults = buildDefaultPermissions(user.role);
  return permissionModules.some(
    (module) => user.permissions[module.id] !== defaults[module.id],
  );
}

export function isProfileComplete(user: ManagedUser) {
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
