"use client";

import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import {
  AlertTriangle,
  Building2,
  Factory,
  PlusCircle,
  ShieldCheck,
  UserX,
  Users,
} from "lucide-react";

import { InfoHint } from "@/components/shared/info-hint";
import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { Button } from "@/components/ui/button";
import type { MasterClient } from "@/lib/master-clients";
import { getTenantIdentifier } from "@/lib/tenant";
import { useMasterClients } from "@/lib/use-master-clients";

type AlertReason = "ocorrencias" | "inativo" | "sem-uso";

type TenantAlert = {
  client: MasterClient;
  reasons: AlertReason[];
  score: number;
};

const alertReasonConfig: Record<
  AlertReason,
  { label: string; toneClass: string }
> = {
  ocorrencias: {
    label: "Ocorrências abertas",
    toneClass: "bg-danger/20 text-danger-foreground",
  },
  inativo: {
    label: "Tenant inativo",
    toneClass: "bg-secondary text-secondary-foreground",
  },
  "sem-uso": {
    label: "Sem usuários ativos",
    toneClass: "bg-warning/25 text-warning-foreground",
  },
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export default function AdministradorMasterPage() {
  const { clients, error, isLoading } = useMasterClients();

  const metrics = useMemo(
    () => ({
      totalClients: clients.length,
      activeClients: clients.filter((client) => client.status === "ativo").length,
      inactiveClients: clients.filter((client) => client.status === "inativo").length,
      activeUsers: clients.reduce((sum, client) => sum + client.metrics.activeUsers, 0),
      users: clients.reduce((sum, client) => sum + client.metrics.users, 0),
      stores: clients.reduce((sum, client) => sum + client.metrics.stores, 0),
      orders: clients.reduce((sum, client) => sum + client.metrics.orders, 0),
      openOccurrences: clients.reduce((sum, client) => sum + client.metrics.openOccurrences, 0),
    }),
    [clients],
  );

  // Distribuição do portfólio por situação (donut conic-gradient)
  const portfolioDistribution = useMemo(() => {
    const total = metrics.totalClients;
    const active = metrics.activeClients;
    const inactive = metrics.inactiveClients;

    return [
      {
        key: "ativo" as const,
        label: "Ativos",
        count: active,
        percentage: total > 0 ? Number(((active / total) * 100).toFixed(1)) : 0,
        conicColor: "oklch(0.86 0.07 148)",
        dotClass: "bg-success",
      },
      {
        key: "inativo" as const,
        label: "Inativos",
        count: inactive,
        percentage: total > 0 ? Number(((inactive / total) * 100).toFixed(1)) : 0,
        conicColor: "oklch(0.83 0.03 250)",
        dotClass: "bg-secondary",
      },
    ];
  }, [metrics.activeClients, metrics.inactiveClients, metrics.totalClients]);

  const portfolioDonutStyle = useMemo<CSSProperties>(() => {
    if (metrics.totalClients === 0) {
      return { background: "conic-gradient(var(--muted) 0 100%)" };
    }

    const { segments } = portfolioDistribution
      .filter((entry) => entry.count > 0)
      .reduce(
        (acc, entry) => {
          const start = acc.cursor;
          const end = start + entry.percentage;
          acc.segments.push(`${entry.conicColor} ${start}% ${end}%`);
          return { cursor: end, segments: acc.segments };
        },
        { cursor: 0, segments: [] as string[] },
      );

    if (segments.length === 0) {
      return { background: "conic-gradient(var(--muted) 0 100%)" };
    }

    return { background: `conic-gradient(${segments.join(", ")})` };
  }, [metrics.totalClients, portfolioDistribution]);

  // Top 5 tenants por pedidos acumulados — proxy de adoção real
  const topTenants = useMemo(() => {
    return [...clients]
      .filter((client) => client.metrics.orders > 0)
      .sort((a, b) => b.metrics.orders - a.metrics.orders)
      .slice(0, 5);
  }, [clients]);

  const topTenantsMax = useMemo(
    () => Math.max(1, ...topTenants.map((client) => client.metrics.orders)),
    [topTenants],
  );

  // Tenants em alerta — múltiplos critérios, dados reais
  const tenantAlerts = useMemo<TenantAlert[]>(() => {
    return clients
      .map((client) => {
        const reasons: AlertReason[] = [];
        let score = 0;

        if (client.metrics.openOccurrences > 0) {
          reasons.push("ocorrencias");
          score += client.metrics.openOccurrences * 10;
        }
        if (client.status === "inativo") {
          reasons.push("inativo");
          score += 5;
        }
        if (client.metrics.users > 0 && client.metrics.activeUsers === 0) {
          reasons.push("sem-uso");
          score += 8;
        }

        return { client, reasons, score };
      })
      .filter((entry) => entry.reasons.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [clients]);

  return (
    <PageLayout
      title="Painel SaaS"
      description="Carteira de tenants, adoção e sinais operacionais."
      badge="Administrador Master"
      breadcrumbs={[{ label: "Administrador Master" }, { label: "Painel SaaS" }]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/administrador-master/clientes?new=1">
              <PlusCircle className="size-4" />
              Cadastrar cliente
            </Link>
          </Button>
          <Button asChild>
            <Link href="/administrador-master/clientes">Gerenciar clientes</Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <KPICard
          title="Clientes ativos"
          value={metrics.activeClients}
          icon={ShieldCheck}
          tone="success"
        />
        <KPICard
          title="Usuários ativos"
          value={metrics.activeUsers}
          icon={Users}
          tone="info"
        />
        <KPICard
          title="Ocorrências abertas"
          value={metrics.openOccurrences}
          icon={Factory}
          tone="danger"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-muted-foreground/80">
        <span>
          Total de clientes <span className="font-medium text-foreground">{metrics.totalClients}</span>
        </span>
        <span aria-hidden>·</span>
        <span>
          Lojas no ecossistema <span className="font-medium text-foreground">{metrics.stores}</span>
        </span>
        <span aria-hidden>·</span>
        <span>
          Pedidos acumulados <span className="font-medium text-foreground">{formatNumber(metrics.orders)}</span>
        </span>
      </div>

      {error ? (
        <div className="rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg bg-panel/40 px-3 py-4 text-sm text-muted-foreground">
          Carregando carteira de clientes...
        </div>
      ) : null}

      {!isLoading && !error && metrics.totalClients === 0 ? (
        <div className="rounded-lg border border-dashed border-border/[var(--opacity-divider)] bg-panel/20 px-3 py-4 text-sm text-muted-foreground">
          Nenhum cliente cadastrado até o momento.
        </div>
      ) : null}

      {!isLoading && !error && metrics.totalClients > 0 ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3 border-b border-border/[var(--opacity-divider)] pb-2">
              <div>
                <h2 className="font-heading text-base font-semibold text-foreground">
                  Distribuição da carteira
                </h2>
                <p className="text-xs text-muted-foreground">
                  Composição por situação do tenant.
                </p>
              </div>
              <InfoHint
                size="sm"
                content="Distribuição calculada sobre o total de tenants cadastrados, independente de plano."
              />
            </div>

            <div className="flex flex-col items-center gap-4 rounded-xl bg-panel/40 px-4 py-5 sm:flex-row sm:items-center sm:gap-6">
              <div className="relative size-36 shrink-0">
                <div
                  className="size-full rounded-full"
                  style={portfolioDonutStyle}
                  aria-hidden
                />
                <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-card">
                  <p className="text-2xl font-semibold text-foreground tabular-nums">
                    {metrics.totalClients}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    Tenants
                  </p>
                </div>
              </div>

              <ul className="w-full space-y-2 text-sm">
                {portfolioDistribution.map((entry) => (
                  <li key={entry.key} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-foreground">
                      <span className={`size-2.5 rounded-full ${entry.dotClass}`} aria-hidden />
                      <span className="font-medium">{entry.label}</span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">{entry.count}</span>
                      <span className="ml-1 opacity-70">({entry.percentage}%)</span>
                    </span>
                  </li>
                ))}
                <li className="mt-3 border-t border-border/[var(--opacity-divider)] pt-2 text-[11px] tabular-nums text-muted-foreground/80">
                  Engajamento: <span className="font-medium text-foreground">
                    {metrics.users > 0
                      ? Math.round((metrics.activeUsers / metrics.users) * 100)
                      : 0}%
                  </span>{" "}
                  ({formatNumber(metrics.activeUsers)} de {formatNumber(metrics.users)} usuários)
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3 border-b border-border/[var(--opacity-divider)] pb-2">
              <div>
                <h2 className="font-heading text-base font-semibold text-foreground">
                  Top 5 tenants por adoção
                </h2>
                <p className="text-xs text-muted-foreground">
                  Pedidos acumulados — proxy de uso real.
                </p>
              </div>
              <Link
                href="/administrador-master/clientes"
                className="text-xs font-medium text-foreground/80 underline-offset-4 hover:underline"
              >
                Ver todos
              </Link>
            </div>

            {topTenants.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/[var(--opacity-divider)] bg-panel/20 px-3 py-4 text-sm text-muted-foreground">
                Ainda não há pedidos registrados para ranquear adoção.
              </div>
            ) : (
              <ul className="space-y-2">
                {topTenants.map((client, index) => {
                  const percent = Math.max(
                    4,
                    Math.round((client.metrics.orders / topTenantsMax) * 100),
                  );
                  return (
                    <li key={client.id}>
                      <Link
                        href={`/administrador-master/clientes/${getTenantIdentifier(client)}`}
                        className="group block rounded-lg px-2 py-1.5 transition hover:bg-panel/60"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="flex min-w-0 items-baseline gap-2">
                            <span className="text-[11px] font-semibold tabular-nums text-muted-foreground/80">
                              {index + 1}.
                            </span>
                            <span className="truncate text-sm font-medium text-foreground group-hover:underline underline-offset-4">
                              {client.name}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            <span className="font-semibold text-foreground">
                              {formatNumber(client.metrics.orders)}
                            </span>{" "}
                            ped.
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3">
                          <div
                            className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel"
                            role="presentation"
                          >
                            <div
                              className="h-full rounded-full bg-info transition-all"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/80">
                            {client.metrics.activeUsers} ativos · {client.metrics.stores} lojas
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {!isLoading && !error && tenantAlerts.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3 border-b border-border/[var(--opacity-divider)] pb-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden />
              <div>
                <h2 className="font-heading text-base font-semibold text-foreground">
                  Tenants em alerta
                </h2>
                <p className="text-xs text-muted-foreground">
                  Sinais que pedem atenção: ocorrências abertas, inatividade ou ausência de uso.
                </p>
              </div>
            </div>
            <Link
              href="/administrador-master/clientes?tab=occurrences"
              className="text-xs font-medium text-foreground/80 underline-offset-4 hover:underline"
            >
              Abrir canal
            </Link>
          </div>

          <ul className="divide-y divide-border/[var(--opacity-divider)] overflow-hidden rounded-xl bg-warning/8">
            {tenantAlerts.map(({ client, reasons }) => (
              <li key={client.id}>
                <Link
                  href={`/administrador-master/clientes/${getTenantIdentifier(client)}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-warning/15"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {client.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {reasons.map((reason) => (
                        <span
                          key={reason}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${alertReasonConfig[reason].toneClass}`}
                        >
                          {reason === "sem-uso" ? <UserX className="size-3" aria-hidden /> : null}
                          {alertReasonConfig[reason].label}
                          {reason === "ocorrencias" && client.metrics.openOccurrences > 1
                            ? ` (${client.metrics.openOccurrences})`
                            : null}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-[11px] tabular-nums text-muted-foreground/80">
                    <span>
                      <span className="font-medium text-foreground/90">{client.metrics.activeUsers}</span>
                      /{client.metrics.users} usuários
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      <span className="font-medium text-foreground/90">{client.metrics.stores}</span> lojas
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!isLoading && !error && metrics.totalClients > 0 && tenantAlerts.length === 0 ? (
        <section className="rounded-xl border border-success/35 bg-success/10 px-4 py-3 text-sm text-success-foreground">
          Nenhum tenant em alerta — todos os clientes estão saudáveis no momento.
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/[var(--opacity-divider)] pt-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/administrador-master/clientes?tab=occurrences">
            Canal com clientes
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/administrador-master/clientes?new=1">
            <Building2 className="size-4" />
            Provisionar tenant
          </Link>
        </Button>
      </div>
    </PageLayout>
  );
}
