import { redirect } from "next/navigation";

import { ProfilePage } from "@/components/shared/profile-page";
import { resolveServerSession } from "@/lib/server-session";

export default async function AdministradorPerfilPage() {
  const session = await resolveServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <ProfilePage
      homeHref="/administrador"
      homeLabel="Administrador"
      roleLabel="Administrador"
      initialName={session.name}
      initialEmail={session.email}
    />
  );
}
