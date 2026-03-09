import { redirect } from "next/navigation";

import { roleHomePath } from "@/lib/auth";
import { resolveServerSession } from "@/lib/server-session";

export default async function HomePage() {
  const session = await resolveServerSession();

  if (!session) {
    redirect("/login");
  }

  redirect(roleHomePath[session.role]);
}
