import { redirect } from "next/navigation";

import { ProfilePage } from "@/components/shared/profile-page";
import { resolveServerSession } from "@/lib/server-session";

export default async function GestorFabricaPerfilPage() {
  const session = await resolveServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <ProfilePage
      homeHref="/gestor-fabrica"
      homeLabel="Gestor de Fábrica"
      roleLabel="Gestor de Fábrica"
      initialName={session.name}
      initialEmail={session.email}
    />
  );
}
