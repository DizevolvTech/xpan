import type { UserRole } from "@/lib/auth";

export function buildTemporaryPassword(email: string, role: UserRole) {
  const localPart = email.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "usuario";
  const rolePart = role.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6) || "perfil";
  return `CasaExpress@${localPart}${rolePart}9`;
}
