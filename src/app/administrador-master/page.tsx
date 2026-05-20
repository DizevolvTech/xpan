"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Building2,
  Factory,
  PlusCircle,
  ShieldCheck,
  Users,
} from "lucide-react";

import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { Button } from "@/components/ui/button";
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
          Pedidos acumulados <span className="font-medium text-foreground">{metrics.orders}</span>
        </span>
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 border-b border-border/[var(--opacity-divider)] pb-2">
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground">
              Clientes mais recentes
            </h2>
            <p className="text-xs text-muted-foreground">
              Últimas atualizações por tenant.
            </p>
          </div>
          <Link
            href="/administrador-master/clientes"
            className="text-xs font-medium text-foreground/80 underline-offset-4 hover:underline"
          >
            Ver todos
          </Link>
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

        {!isLoading && recentClients.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/[var(--opacity-divider)] bg-panel/20 px-3 py-4 text-sm text-muted-foreground">
            Nenhum cliente cadastrado até o momento.
          </div>
        ) : null}

        {recentClients.length > 0 ? (
          <ul className="divide-y divide-border/[var(--opacity-divider)] overflow-hidden rounded-xl bg-panel/40">
            {recentClients.map((client) => (
              <li key={client.id}>
                <Link
                  href={`/administrador-master/clientes/${getTenantIdentifier(client)}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-panel/60"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {client.name}
                    </p>
                    <p className="text-[11px] tabular-nums text-muted-foreground/80">
                      <span className="font-medium text-foreground/90">{client.metrics.users}</span> usuários
                      <span aria-hidden> · </span>
                      <span className="font-medium text-foreground/90">{client.metrics.stores}</span> lojas
                      <span aria-hidden> · </span>
                      <span className="font-medium text-foreground/90">
                        {client.metrics.openOccurrences}
                      </span>{" "}
                      ocorrências
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={
                        client.status === "ativo"
                          ? "inline-flex items-center rounded-full bg-success/20 px-2 py-0.5 text-[11px] font-semibold text-success-foreground"
                          : "inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground"
                      }
                    >
                      {client.status === "ativo" ? "Ativo" : "Inativo"}
                    </span>
                    <span className="hidden whitespace-nowrap text-[11px] tabular-nums text-muted-foreground/80 sm:inline">
                      {formatDateTime(client.updatedAt)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

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
