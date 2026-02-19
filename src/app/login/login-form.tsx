"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LockKeyhole, LogIn, Mail, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginHints } from "@/lib/auth";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json().catch(() => null)) as
        | { message?: string; redirectTo?: string }
        | null;

      if (!response.ok) {
        setError(data?.message ?? "Falha ao autenticar. Tente novamente.");
        return;
      }

      const next = searchParams.get("next");
      const redirectTarget = next && next.startsWith("/") ? next : data?.redirectTo ?? "/";

      router.replace(redirectTarget);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="border-border/80 bg-surface">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Acesso ao Casa Express</CardTitle>
            <CardDescription>
              Faça login para acessar o fluxo operacional correspondente ao seu perfil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    className="pl-9"
                    placeholder="voce@empresa.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-9"
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-danger/40 bg-danger/30 px-3 py-2 text-sm text-danger-foreground">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <LogIn className="size-4" />
                    Entrar
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Usuários de teste</CardTitle>
            <CardDescription>
              Clique em um usuário para preencher login automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loginHints.map((user) => (
              <button
                key={user.email}
                type="button"
                onClick={() => {
                  setEmail(user.email);
                  if (user.role === "administrador") setPassword("Admin@123");
                  if (user.role === "gestor-dados") setPassword("Engenharia@123");
                  if (user.role === "gestor-fabrica") setPassword("Fabrica@123");
                  if (user.role === "chao-fabrica") setPassword("Chao@123");
                  if (user.role === "loja") setPassword("Loja@123");
                  setError(null);
                }}
                className="flex w-full items-center justify-between rounded-lg border border-border/80 bg-panel px-3 py-3 text-left transition hover:border-border-strong/45"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary-foreground">
                  <UserRound className="size-3" />
                  {user.role}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
