import { redirect } from "next/navigation";

import { resolveLandingPath } from "@/lib/permission-modules";
import { resolveCurrentManagedUser } from "@/lib/server-session";

export default async function HomePage() {
  const user = await resolveCurrentManagedUser();

  if (!user) {
    redirect("/login");
  }

  redirect(resolveLandingPath(user.permissions, user.role));
}
