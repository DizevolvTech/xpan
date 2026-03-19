export type UserRole =
  | "administrador"
  | "gestor-dados"
  | "gestor-fabrica"
  | "chao-fabrica"
  | "loja";

export type SessionUser = {
  role: UserRole;
  email: string;
  name: string;
};

export const SESSION_COOKIE_NAME = "da_session";
