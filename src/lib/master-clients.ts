import type { ManagedUser, ManagedUserStatus } from "@/lib/admin-users";
import type { TenantStatus, TenantSummary } from "@/lib/tenant";

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
