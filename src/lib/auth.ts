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

type DemoUser = SessionUser & {
  password: string;
};

export const SESSION_COOKIE_NAME = "da_session";

const demoUsers: DemoUser[] = [
  {
    role: "administrador",
    name: "Administrador Geral",
    email: "admin@danielaugusto.com",
    password: "Admin@123",
  },
  {
    role: "gestor-dados",
    name: "Fernanda Engenharia",
    email: "engenharia@danielaugusto.com",
    password: "Engenharia@123",
  },
  {
    role: "gestor-fabrica",
    name: "Marcos Fabrica",
    email: "fabrica@danielaugusto.com",
    password: "Fabrica@123",
  },
  {
    role: "chao-fabrica",
    name: "Equipe Chão",
    email: "chao@danielaugusto.com",
    password: "Chao@123",
  },
  {
    role: "loja",
    name: "Rommel Filho",
    email: "loja@danielaugusto.com",
    password: "Loja@123",
  },
];

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

export const loginHints = demoUsers.map(({ name, email, role }) => ({
  name,
  email,
  role,
}));

export function authenticateUser(email: string, password: string): SessionUser | null {
  const normalizedEmail = email.trim().toLowerCase();
  const user = demoUsers.find(
    (item) => item.email.toLowerCase() === normalizedEmail && item.password === password,
  );

  if (!user) {
    return null;
  }

  return {
    role: user.role,
    email: user.email,
    name: user.name,
  };
}

export function encodeSession(session: SessionUser): string {
  return [session.role, session.email, session.name]
    .map((value) => encodeURIComponent(value))
    .join(".");
}

export function decodeSession(raw: string | undefined | null): SessionUser | null {
  if (!raw) {
    return null;
  }

  const [rawRole, rawEmail, rawName] = raw.split(".");
  if (!rawRole || !rawEmail || !rawName) {
    return null;
  }

  const role = decodeURIComponent(rawRole) as UserRole;
  if (!(role in roleHomePath)) {
    return null;
  }

  return {
    role,
    email: decodeURIComponent(rawEmail),
    name: decodeURIComponent(rawName),
  };
}

export function getRoleForPath(pathname: string): UserRole | null {
  const match = (Object.entries(roleRoutePrefix) as Array<[UserRole, string]>).find(([, prefix]) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return match?.[0] ?? null;
}
