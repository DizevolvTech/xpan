import { redirect } from "next/navigation";

import { ProfilePage } from "@/components/shared/profile-page";
import { resolveServerSession } from "@/lib/server-session";

export default async function GestorDadosPerfilPage() {
  const session = await resolveServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <ProfilePage
      homeHref="/gestor-dados"
      homeLabel="Gestor de Dados"
      roleLabel="Gestor de Dados"
      initialName={session.name}
      initialEmail={session.email}
    />
  );
}
