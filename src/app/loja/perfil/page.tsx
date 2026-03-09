import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ProfilePage } from "@/components/shared/profile-page";
import { SESSION_COOKIE_NAME, decodeSession } from "@/lib/auth";

export default async function LojaPerfilPage() {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);

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
