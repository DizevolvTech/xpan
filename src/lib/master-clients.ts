import type { ManagedUser, ManagedUserStatus } from "@/lib/admin-users";
import type { TenantStatus, TenantSummary } from "@/lib/tenant";

export const MASTER_CLIENT_ADMIN_EMAIL_CONFLICT_MESSAGE =
  "Este e-mail já está em uso por outro usuário. Troque o e-mail do administrador inicial para concluir o cadastro.";

export type MasterClientMetrics = {
  users: number;
  activeUsers: number;
  stores: number;
  products: number;
  orders: number;
  openOccurrences: number;
};

export type MasterClient = TenantSummary & {
  createdAt: string;
  updatedAt: string;
  metrics: MasterClientMetrics;
};

export type CreateMasterClientPayload = {
  tenant: {
    name: string;
    status: TenantStatus;
  };
  admin: {
    name: string;
    email: string;
    status: ManagedUserStatus;
  };
};

export type CreateMasterClientResult = {
  tenant: MasterClient;
  admin: ManagedUser;
  temporaryPassword?: string;
};

export function isMasterClientAdminEmailConflictMessage(message: string | null | undefined) {
  if (!message) {
    return false;
  }

  const normalizedMessage = message.trim().toLowerCase();
  const normalizedConflictMessage = MASTER_CLIENT_ADMIN_EMAIL_CONFLICT_MESSAGE.toLowerCase();

  return (
    normalizedMessage === normalizedConflictMessage ||
    normalizedMessage.includes("profiles_email_key") ||
    (normalizedMessage.includes("duplicate key value") && normalizedMessage.includes("email")) ||
    (normalizedMessage.includes("e-mail") && normalizedMessage.includes("já está em uso")) ||
    (normalizedMessage.includes("email") && normalizedMessage.includes("already"))
  );
}
