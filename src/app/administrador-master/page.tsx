"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Building2,
  Factory,
  LayoutDashboard,
  ShieldCheck,
  ShoppingCart,
  Store,
  Users,
} from "lucide-react";

import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { ModuleCard } from "@/components/shared/module-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMasterClients } from "@/lib/use-master-clients";
import { getTenantIdentifier } from "@/lib/tenant";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdministradorMasterPage() {
  const { clients, error, isLoading } = useMasterClients();

  const metrics = useMemo(
    () => ({
      totalClients: clients.length,
      activeClients: clients.filter((client) => client.status === "ativo").length,
      activeUsers: clients.reduce((sum, client) => sum + client.metrics.activeUsers, 0),
      stores: clients.reduce((sum, client) => sum + client.metrics.stores, 0),
      orders: clients.reduce((sum, client) => sum + client.metrics.orders, 0),
      openOccurrences: clients.reduce((sum, client) => sum + client.metrics.openOccurrences, 0),
    }),
    [clients],
  );

  const recentClients = useMemo(() => clients.slice(0, 5), [clients]);

  return (
    <PageLayout
      title="Painel SaaS"
      description="Cadastre novos clientes, acompanhe o uso do ecossistema e entre em modo leitura para revisar cada operação."
      badge="Administrador Master"
      breadcrumbs={[{ label: "Administrador Master" }, { label: "Painel SaaS" }]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/administrador-master/clientes?new=1">Cadastrar cliente</Link>
          </Button>
          <Button asChild>
            <Link href="/administrador-master/clientes">Gerenciar clientes</Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KPICard title="Clientes" value={metrics.totalClients} icon={Building2} tone="info" />
        <KPICard title="Clientes ativos" value={metrics.activeClients} icon={ShieldCheck} tone="success" />
        <KPICard title="Usuários ativos" value={metrics.activeUsers} icon={Users} tone="warning" />
        <KPICard title="Lojas" value={metrics.stores} icon={Store} tone="neutral" />
        <KPICard title="Pedidos" value={metrics.orders} icon={ShoppingCart} tone="info" />
        <KPICard title="Ocorrências abertas" value={metrics.openOccurrences} icon={Factory} tone="danger" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Fluxos principais do master</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <ModuleCard
              href="/administrador-master/clientes"
              title="Base de clientes"
              subtitle="Operação comercial e onboarding"
              description="Acompanhe status, footprint do ecossistema e dados de cada conta atendida pelo SaaS."
              icon={LayoutDashboard}
              tone="slate"
              items={[
                "Lista completa de tenants",
                "Métricas agregadas por cliente",
                "Acesso ao detalhe de cada ecossistema",
              ]}
            />
            <ModuleCard
              href="/administrador-master/clientes?new=1"
              title="Novo cliente"
              subtitle="Provisionamento inicial"
              description="Crie o tenant, o primeiro administrador e as configurações mínimas para iniciar a operação."
              icon={Building2}
              tone="emerald"
              items={[
                "Tenant com slug exclusivo",
                "Administrador inicial ativo",
                "Configuração operacional padrão",
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clientes mais recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {error ? (
              <div className="rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
                {error}
              </div>
            ) : null}

            {isLoading ? (
              <div className="rounded-lg border border-border/70 bg-panel/35 px-3 py-4 text-sm text-muted-foreground">
                Carregando carteira de clientes...
              </div>
            ) : null}

            {!isLoading && recentClients.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 bg-panel/20 px-3 py-4 text-sm text-muted-foreground">
                Nenhum cliente cadastrado até o momento.
              </div>
            ) : null}

            {recentClients.map((client) => (
              <Link
                key={client.id}
                href={`/administrador-master/clientes/${getTenantIdentifier(client)}`}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-panel/20 px-4 py-3 transition hover:border-border-strong/35 hover:bg-panel/35"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{client.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {client.slug} · {client.metrics.users} usuários · {client.metrics.stores} lojas
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{client.status === "ativo" ? "Ativo" : "Inativo"}</p>
                  <p>{formatDateTime(client.updatedAt)}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
