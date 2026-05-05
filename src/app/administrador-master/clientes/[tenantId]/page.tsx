"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Factory,
  ShieldCheck,
  ShoppingCart,
  Store,
  Users,
} from "lucide-react";

import { ClientUserManagementPanel } from "@/components/master/client-user-management-panel";
import { InfoHint } from "@/components/shared/info-hint";
import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { TenantSupportOccurrenceWorkspace } from "@/components/support/tenant-support-occurrence-workspace";
import type { MasterClient } from "@/lib/master-clients";
import { getTenantIdentifier } from "@/lib/tenant";
import { useMasterClients } from "@/lib/use-master-clients";

type PageProps = {
  params: Promise<{
    tenantId: string;
  }>;
};

type ClientDetailTab = "overview" | "users" | "occurrences";

function resolveClientDetailTab(value: string | null): ClientDetailTab {
  if (value === "users" || value === "occurrences") {
    return value;
  }

  return "overview";
}

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
  const searchParams = useSearchParams();
  const {
    clients,
    error,
    isLoading,
    isSubmitting,
    refresh,
    enterTenantReadOnly,
    updateClientStatus,
  } = useMasterClients();
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const defaultTab = resolveClientDetailTab(searchParams.get("tab"));
  const [activeTab, setActiveTab] = useState<ClientDetailTab>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

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

  async function handleToggleClientStatus() {
    if (!client) {
      return;
    }

    try {
      await updateClientStatus(
        client.id,
        client.status === "ativo" ? "inativo" : "ativo",
      );
      setPageError(null);
      setPageNotice(
        client.status === "ativo"
          ? "Cliente inativado. Os usuários deste tenant deixam de acessar o sistema até a reativação."
          : "Cliente reativado com sucesso.",
      );
    } catch (statusError) {
      setPageNotice(null);
      setPageError(
        statusError instanceof Error
          ? statusError.message
          : "Não foi possível atualizar o status do cliente.",
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
            <Button
              type="button"
              variant={client.status === "ativo" ? "outline" : "default"}
              onClick={() => void handleToggleClientStatus()}
              disabled={isSubmitting}
            >
              {client.status === "ativo" ? "Inativar cliente" : "Reativar cliente"}
            </Button>
          ) : null}
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

      {pageNotice ? (
        <div className="rounded-xl border border-success/35 bg-success/10 px-4 py-3 text-sm text-success-foreground">
          {pageNotice}
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
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(resolveClientDetailTab(value))}
            className="gap-4"
          >
            <TabsList variant="line" className="w-full justify-start rounded-xl bg-panel/45 p-1">
              <TabsTrigger value="overview">Visão geral</TabsTrigger>
              <TabsTrigger value="users">Usuários</TabsTrigger>
              <TabsTrigger value="occurrences">Canal de ocorrências</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
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
                        <p className="mt-1 text-xs text-muted-foreground">Cliente SaaS</p>
                        <div className="mt-3 rounded-lg border border-dashed border-border/70 bg-card px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Referência interna
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">Slug: {client.slug}</p>
                          {client.legacyId ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Identificador interno: {client.legacyId}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-panel/20 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Situação
                        </p>
                        <div className="mt-2">{buildStatusBadge(client.status)}</div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Atualizado em {formatDateTime(client.updatedAt)}
                        </p>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {client.status === "ativo"
                            ? "Tenant operando normalmente."
                            : "Tenant bloqueado para acesso dos usuários do cliente até reativação pelo Master."}
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
                          <p className="text-xs text-muted-foreground">Ocorrências operacionais</p>
                          <p className="mt-1 text-lg font-semibold text-foreground">{client.metrics.openOccurrences}</p>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-card px-3 py-3">
                          <p className="text-xs text-muted-foreground">Criado em</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{formatDateTime(client.createdAt)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-panel/20 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              Canal cliente x sistema
                            </p>
                            <InfoHint
                              size="xs"
                              content="Esta conversa fica na aba de ocorrências e concentra bloqueios de acesso, gestão de usuários, ajustes cadastrais e tratativas com o administrador do cliente."
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setActiveTab("occurrences")}
                        >
                            <AlertCircle className="size-4" />
                            Abrir ocorrências
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-1.5">
                      <CardTitle>Entrar em modo leitura</CardTitle>
                      <InfoHint
                        size="sm"
                        content="O cookie de contexto será configurado para este tenant e a navegação seguirá com bloqueio de escrita."
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
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
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              <ClientUserManagementPanel
                apiBasePath={`/api/master/clients/${tenantId}/users`}
                onUsersChanged={refresh}
              />
            </TabsContent>

            <TabsContent value="occurrences" className="space-y-4">
              <TenantSupportOccurrenceWorkspace
                apiBasePath={`/api/master/clients/${tenantId}/support-occurrences`}
                mode="master"
                title="Canal cliente x sistema"
                description="Acompanhe bloqueios de acesso, ajustes cadastrais, pedidos de suporte e todo o histórico de conversa com o administrador do cliente."
                onMutated={refresh}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </PageLayout>
  );
}
