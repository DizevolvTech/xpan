import { redirect } from "next/navigation";

import { resolveLandingPath } from "@/lib/permission-modules";
import { resolveServerAccess } from "@/lib/server-session";

export default async function HomePage() {
  const access = await resolveServerAccess();

  if (!access) {
    redirect("/login");
  }

  redirect(resolveLandingPath(access.permissions, access.user.role));
}
