import { redirect } from "next/navigation";

import { ProfilePage } from "@/components/shared/profile-page";
import { resolveServerSession } from "@/lib/server-session";

export default async function ChaoFabricaPerfilPage() {
  const session = await resolveServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <ProfilePage
      homeHref="/chao-fabrica"
      homeLabel="Chão de Fábrica"
      roleLabel="Chão de Fábrica"
      initialName={session.name}
      initialEmail={session.email}
    />
  );
}
