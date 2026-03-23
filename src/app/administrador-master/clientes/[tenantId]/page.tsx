"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Factory, ShieldCheck, ShoppingCart, Store, Users } from "lucide-react";

import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MasterClient } from "@/lib/master-clients";
import { getTenantIdentifier } from "@/lib/tenant";
import { useMasterClients } from "@/lib/use-master-clients";

type PageProps = {
  params: Promise<{
    tenantId: string;
  }>;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function matchesClientIdentifier(client: MasterClient, tenantId: string) {
  return (
    client.id === tenantId ||
    client.slug === tenantId ||
    client.legacyId === tenantId ||
    getTenantIdentifier(client) === tenantId
  );
}

function buildStatusBadge(status: MasterClient["status"]) {
  if (status === "ativo") {
    return (
      <span className="inline-flex items-center rounded-full bg-success/20 px-2.5 py-1 text-xs font-semibold text-success-foreground">
        Ativo
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
      Inativo
    </span>
  );
}

export default function AdministradorMasterClienteDetalhePage({ params }: PageProps) {
  const resolvedParams = use(params);
  return <AdministradorMasterClienteDetalheClient tenantId={resolvedParams.tenantId} />;
}

function AdministradorMasterClienteDetalheClient({ tenantId }: { tenantId: string }) {
  const { clients, error, isLoading, isSubmitting, enterTenantReadOnly } = useMasterClients();
  const [pageError, setPageError] = useState<string | null>(null);

  const client = useMemo(
    () => clients.find((entry) => matchesClientIdentifier(entry, tenantId)) ?? null,
    [clients, tenantId],
  );

  async function handleEnterTenant(path: string) {
    if (!client) {
      return;
    }

    try {
      await enterTenantReadOnly(getTenantIdentifier(client));
      window.location.assign(path);
    } catch (enterError) {
      setPageError(
        enterError instanceof Error
          ? enterError.message
          : "Não foi possível abrir o cliente em modo leitura.",
      );
    }
  }

  return (
    <PageLayout
      title={client ? client.name : "Cliente"}
      description="Revise o footprint do tenant e escolha qual área do ecossistema deve ser aberta em modo leitura."
      badge="Administrador Master"
      breadcrumbs={[
        { label: "Administrador Master", href: "/administrador-master" },
        { label: "Clientes", href: "/administrador-master/clientes" },
        { label: client?.name ?? "Detalhe" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild type="button" variant="outline">
            <Link href="/administrador-master/clientes">Voltar para clientes</Link>
          </Button>
          {client ? (
            <Button type="button" onClick={() => void handleEnterTenant("/administrador")} disabled={isSubmitting}>
              Abrir ecossistema
            </Button>
          ) : null}
        </div>
      }
    >
      {error || pageError ? (
        <div className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger-foreground">
          {pageError ?? error}
        </div>
      ) : null}

      {isLoading ? (
        <Card>
          <CardContent className="px-4 py-6 text-sm text-muted-foreground">
            Carregando informações do cliente...
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !client ? (
        <Card>
          <CardContent className="space-y-3 px-4 py-6">
            <p className="text-sm font-semibold text-foreground">Cliente não encontrado.</p>
            <p className="text-sm text-muted-foreground">
              O identificador informado não corresponde a um tenant disponível para o administrador master.
            </p>
            <Button asChild type="button" variant="outline">
              <Link href="/administrador-master/clientes">Voltar para a carteira SaaS</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {client ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KPICard title="Usuários" value={client.metrics.users} icon={Users} tone="warning" />
            <KPICard title="Usuários ativos" value={client.metrics.activeUsers} icon={ShieldCheck} tone="success" />
            <KPICard title="Lojas" value={client.metrics.stores} icon={Store} tone="neutral" />
            <KPICard title="Produtos" value={client.metrics.products} icon={Factory} tone="info" />
            <KPICard title="Pedidos" value={client.metrics.orders} icon={ShoppingCart} tone="info" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Resumo do tenant</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-panel/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Identificação
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{client.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {client.slug}
                      {client.legacyId ? ` · ${client.legacyId}` : ""}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-panel/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Situação
                    </p>
                    <div className="mt-2">{buildStatusBadge(client.status)}</div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Atualizado em {formatDateTime(client.updatedAt)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-panel/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Sinais operacionais
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-border/70 bg-card px-3 py-3">
                      <p className="text-xs text-muted-foreground">Pedidos</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{client.metrics.orders}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-card px-3 py-3">
                      <p className="text-xs text-muted-foreground">Ocorrências abertas</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{client.metrics.openOccurrences}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-card px-3 py-3">
                      <p className="text-xs text-muted-foreground">Criado em</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{formatDateTime(client.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Entrar em modo leitura</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  O cookie de contexto será configurado para este tenant e a navegação seguirá com bloqueio de escrita.
                </p>

                <div className="grid gap-3">
                  <Button type="button" onClick={() => void handleEnterTenant("/administrador")} disabled={isSubmitting}>
                    <Building2 className="size-4" />
                    Abrir área administrativa
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleEnterTenant("/gestor-dados")}
                    disabled={isSubmitting}
                  >
                    <Factory className="size-4" />
                    Abrir dados mestres
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleEnterTenant("/gestor-fabrica")}
                    disabled={isSubmitting}
                  >
                    <ShieldCheck className="size-4" />
                    Abrir gestão de fábrica
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleEnterTenant("/loja/pedidos")}
                    disabled={isSubmitting}
                  >
                    <Store className="size-4" />
                    Abrir jornada da loja
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </PageLayout>
  );
}
