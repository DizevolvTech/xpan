"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LockKeyhole, LogIn, Mail, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brand } from "@/lib/brand";

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

      <div className="grid w-full max-w-5xl gap-6 rounded-3xl border border-border/70 bg-surface/70 p-4 shadow-elevated backdrop-blur-sm md:p-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="border-border/80 bg-card/95 shadow-soft">
          <CardHeader>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center p-1.5">
                <Image src={brand.logoPath} alt={brand.name} width={48} height={48} className="h-full w-full object-contain" priority />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Software</p>
                <CardTitle className="font-heading text-2xl">Acesso ao {brand.name}</CardTitle>
              </div>
            </div>
            <CardDescription>
              Faça login com seu usuário para acessar os módulos liberados para o seu perfil-base, permissões e escopos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-border/75 bg-panel/70 p-4 shadow-soft md:p-5">
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

                {error ? (
                  <div className="rounded-lg border border-danger/40 bg-danger/30 px-3 py-2 text-sm text-danger-foreground">
                    {error}
                  </div>
                ) : null}

                <Button type="submit" className="w-full shadow-soft" disabled={submitting}>
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
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/90 shadow-soft">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Sessão e Segurança</CardTitle>
            <CardDescription>
              O acesso depende de um usuário ativo, de um perfil-base válido e das permissões delegadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border/75 bg-panel/70 p-4">
              <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="size-4 text-primary" />
                Regras ativas
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>O usuário precisa estar cadastrado e ativo.</li>
                <li>O e-mail precisa estar vinculado a um cadastro operacional válido.</li>
                <li>Perfis inativos não conseguem iniciar sessão.</li>
                <li>O acesso às telas segue permissões por módulo e escopos delegados.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-border/75 bg-panel/70 p-4 text-sm text-muted-foreground">
              Se precisar redefinir senha ou revisar acessos, use o painel administrativo da plataforma.
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
