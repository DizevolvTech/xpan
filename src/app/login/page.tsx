import { Suspense } from "react";

import LoginForm from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
          <div className="text-sm text-muted-foreground">Carregando login...</div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
