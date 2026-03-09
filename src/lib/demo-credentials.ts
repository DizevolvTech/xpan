export const demoCredentialPresets = [
  {
    legacyId: "user-admin",
    role: "administrador",
    name: "Administrador Geral",
    email: "admin@danielaugusto.com",
    password: "Admin@123",
  },
  {
    legacyId: "user-dados",
    role: "gestor-dados",
    name: "Fernanda Engenharia",
    email: "engenharia@danielaugusto.com",
    password: "Engenharia@123",
  },
  {
    legacyId: "user-fabrica",
    role: "gestor-fabrica",
    name: "Marcos Fabrica",
    email: "fabrica@danielaugusto.com",
    password: "Fabrica@123",
  },
  {
    legacyId: "user-chao",
    role: "chao-fabrica",
    name: "Equipe Chao",
    email: "chao@danielaugusto.com",
    password: "Chao@123",
  },
  {
    legacyId: "user-loja",
    role: "loja",
    name: "Rommel Filho",
    email: "loja@danielaugusto.com",
    password: "Loja@123",
  },
] as const;

export type DemoCredentialPreset = (typeof demoCredentialPresets)[number];
