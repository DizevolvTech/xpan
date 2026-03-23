export type UserRole =
  | "administrador-master"
  | "administrador"
  | "gestor-dados"
  | "gestor-fabrica"
  | "chao-fabrica"
  | "loja";

export type SessionUser = {
  role: UserRole;
  email: string;
  name: string;
  tenantId?: string | null;
};

export const SESSION_COOKIE_NAME = "da_session";
