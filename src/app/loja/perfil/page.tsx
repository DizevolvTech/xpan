import { redirect } from "next/navigation";

import { ProfilePage } from "@/components/shared/profile-page";
import { resolveServerSession } from "@/lib/server-session";

export default async function LojaPerfilPage() {
  const session = await resolveServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <ProfilePage
      homeHref="/loja"
      homeLabel="Loja"
      roleLabel="Loja"
      initialName={session.name}
      initialEmail={session.email}
    />
  );
}
