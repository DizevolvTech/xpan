import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ProfilePage } from "@/components/shared/profile-page";
import { SESSION_COOKIE_NAME, decodeSession } from "@/lib/auth";

export default async function GestorFabricaPerfilPage() {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);

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
