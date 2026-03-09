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

export const roleHomePath: Record<UserRole, string> = {
  administrador: "/administrador",
  "gestor-dados": "/gestor-dados",
  "gestor-fabrica": "/gestor-fabrica",
  "chao-fabrica": "/chao-fabrica",
  loja: "/loja",
};

const roleRoutePrefix: Record<UserRole, string> = {
  administrador: "/administrador",
  "gestor-dados": "/gestor-dados",
  "gestor-fabrica": "/gestor-fabrica",
  "chao-fabrica": "/chao-fabrica",
  loja: "/loja",
};

export function getRoleForPath(pathname: string): UserRole | null {
  const match = (Object.entries(roleRoutePrefix) as Array<[UserRole, string]>).find(([, prefix]) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return match?.[0] ?? null;
}
