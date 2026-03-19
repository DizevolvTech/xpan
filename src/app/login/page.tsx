import { redirect } from "next/navigation";
import { Suspense } from "react";

import LoginForm from "@/app/login/login-form";
import { resolveCurrentManagedUser } from "@/lib/server-session";

export default async function LoginPage() {
  const user = await resolveCurrentManagedUser();

  if (user) {
    redirect("/");
  }

  return (
    <Suspense
      fallback={
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-br from-canvas via-muted/35 to-canvas"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-28 top-10 -z-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 right-0 -z-10 h-80 w-80 rounded-full bg-accent/25 blur-3xl"
          />
          <div className="rounded-2xl border border-border/70 bg-surface/80 px-5 py-4 text-sm text-muted-foreground shadow-soft backdrop-blur-sm">
            Carregando login...
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
