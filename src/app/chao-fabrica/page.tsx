"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, Factory, ListChecks, Truck } from "lucide-react";
import { useMemo } from "react";

import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { Button } from "@/components/ui/button";
import type { OrderStatus, ProductionOrderRow, ExpeditionRow } from "@/lib/factory-planning";
import { filterFactoryPlanningDataByOperationalScope } from "@/lib/operational-date-scope";
import { formatKgLabel, formatKgValue } from "@/lib/utils";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";

/**
 * Status visual map para os blocos do dashboard.
 * Mantemos chips grandes (px-3 py-1.5) — operário lê de longe.
 */
const STATUS_VISUAL: Record<OrderStatus, { label: string; chip: string; bar: string }> = {
  em_producao: {
    label: "Em produção",
    chip: "bg-success/35 text-success-foreground",
    bar: "bg-success",
  },
  agendado: {
    label: "Agendado",
    chip: "bg-info/35 text-info-foreground",
    bar: "bg-info",
  },
  em_espera: {
    label: "Em espera",
    chip: "bg-warning/40 text-warning-foreground",
    bar: "bg-warning",
  },
  aguardando_expedicao: {
    label: "P/ expedir",
    chip: "bg-secondary/60 text-secondary-foreground",
    bar: "bg-secondary",
  },
  rota_entrega: {
    label: "Em rota",
    chip: "bg-info/35 text-info-foreground",
    bar: "bg-info",
  },
  cancelado: {
    label: "Cancelado",
    chip: "bg-muted text-muted-foreground",
    bar: "bg-muted",
  },
};

// Ordem da fila do chão: "em produção" e "agendado" sobem; "em espera" depois; concluído nunca aparece.
const QUEUE_PRIORITY: Record<OrderStatus, number> = {
  em_producao: 0,
  agendado: 1,
  em_espera: 2,
  aguardando_expedicao: 3,
  rota_entrega: 4,
  cancelado: 99,
};

export default function ChaoFabricaPage() {
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const { planningData: planningSnapshot } = useFactoryPlanningSnapshot(anchorDate);
  const planningData = useMemo(
    () => filterFactoryPlanningDataByOperationalScope(planningSnapshot, scope),
    [planningSnapshot, scope],
  );

  const opsCount = planningData.productionOrders.length;
  const productionKg = Number(planningData.productionOrders.reduce((sum, item) => sum + item.totalKg, 0).toFixed(2));
  const releasedOrders = planningData.orders.filter((item) => item.releasedToProduction).length;
  const expeditionReady = planningData.expedition.filter((item) => item.status === "aguardando_expedicao").length;
  const awaitingRelease = planningData.orders.filter((item) => !item.releasedToProduction).length;
  const expeditionKg = Number(planningData.expedition.reduce((sum, item) => sum + item.totalKg, 0).toFixed(2));

  // Stats secundárias: dados que importam, mas não competem com os 3 KPIs primários.
  const secondaryStats = [
    { label: "Carga de produção", value: formatKgLabel(productionKg, { maximumFractionDigits: 2 }) },
    { label: "Pedidos liberados", value: releasedOrders },
    { label: "Carga total de expedição", value: formatKgLabel(expeditionKg, { maximumFractionDigits: 2 }) },
  ];

  // Progresso do dia: OPs com progress=100 (ou status terminal) contam como concluídas.
  // ProductionOrderRow.progress vem 0–100. Usamos 100 como limiar.
  const dayProgress = useMemo(() => {
    const total = planningData.productionOrders.length;
    if (total === 0) {
      return { total: 0, done: 0, inProgress: 0, pending: 0, percent: 0 };
    }
    let done = 0;
    let inProgress = 0;
    planningData.productionOrders.forEach((op) => {
      if (op.progress >= 100) done += 1;
      else if (op.status === "em_producao" || op.progress > 0) inProgress += 1;
    });
    const pending = Math.max(0, total - done - inProgress);
    return {
      total,
      done,
      inProgress,
      pending,
      percent: Math.round((done / total) * 100),
    };
  }, [planningData.productionOrders]);

  // Próximas OPs na fila — top 5 não-concluídas, ordenadas por status.
  const nextOps = useMemo(() => {
    return [...planningData.productionOrders]
      .filter((op) => op.progress < 100 && op.status !== "cancelado")
      .sort((a, b) => {
        const ap = QUEUE_PRIORITY[a.status] ?? 50;
        const bp = QUEUE_PRIORITY[b.status] ?? 50;
        if (ap !== bp) return ap - bp;
        // mesmo status: maior carga primeiro (mais relevante na fila)
        return b.totalKg - a.totalKg;
      })
      .slice(0, 5);
  }, [planningData.productionOrders]);

  // Pronto pra expedir — top 4 pedidos aguardando, maior carga primeiro.
  const readyExpedition = useMemo(() => {
    return planningData.expedition
      .filter((row) => row.status === "aguardando_expedicao")
      .sort((a, b) => b.totalKg - a.totalKg)
      .slice(0, 4);
  }, [planningData.expedition]);

  return (
    <PageLayout
      title="Chão de Fábrica"
      description="Visão operacional do que produzir e expedir hoje."
      badge="Operacional"
      breadcrumbs={[{ label: "Início", href: "/" }, { label: "Chão de Fábrica" }]}
    >
      <OperationalDateScopeCard
        scope={scope}
        summary={summary}
        setMode={setMode}
        setDate={setDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        title="Janela operacional"
        description=""
      />

      {/* 3 KPIs primários — os números que o operário lê de longe. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        <KPICard title="OPs para produzir" value={opsCount} tone="info" icon={Factory} compactValue />
        <KPICard
          title="Pedidos prontos p/ expedir"
          value={expeditionReady}
          tone="success"
          icon={Truck}
          compactValue
        />
        <KPICard
          title="Pedidos aguardando liberação"
          value={awaitingRelease}
          tone="warning"
          icon={ListChecks}
          compactValue
        />
      </motion.div>

      {/* Stats secundárias: linha enxuta de apoio, sem mini-cards aninhados. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-muted-foreground"
      >
        {secondaryStats.map((stat, index) => (
          <span key={stat.label} className="inline-flex items-center gap-1.5">
            {index > 0 && <span aria-hidden className="text-border">·</span>}
            <span>{stat.label}:</span>
            <span className="font-semibold text-foreground tabular-nums">{stat.value}</span>
          </span>
        ))}
      </motion.div>

      {/* Progresso do dia — hero secundário, full-width.
          Pensado para o tablet: número gigante à esquerda, barra horizontal alta à direita. */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.18 }}
        aria-labelledby="progresso-dia-titulo"
        className="rounded-2xl border border-border/70 bg-panel/40 p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex-1 min-w-0">
            <p
              id="progresso-dia-titulo"
              className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              Progresso do dia
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="font-heading text-5xl font-bold leading-none tracking-[-0.022em] text-foreground tabular-nums">
                {dayProgress.percent}
                <span className="text-2xl text-muted-foreground">%</span>
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {dayProgress.done} de {dayProgress.total} OPs concluídas
              </span>
            </div>
          </div>

          <div className="flex-[1.4] min-w-0 space-y-2">
            {/* Barra horizontal alta (h-3, grande pra tablet). Tokens existentes. */}
            <div
              className="relative h-3 w-full overflow-hidden rounded-full bg-panel/40 ring-1 ring-border/70"
              role="progressbar"
              aria-valuenow={dayProgress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${dayProgress.percent}% das OPs concluídas hoje`}
            >
              {dayProgress.total > 0 && (
                <>
                  <div
                    className="h-full bg-success transition-[width] duration-500"
                    style={{ width: `${dayProgress.percent}%` }}
                  />
                  {/* Sobreposição "em andamento" empilhada à direita das concluídas */}
                  {dayProgress.inProgress > 0 && (
                    <div
                      className="absolute top-0 h-full bg-warning/70"
                      style={{
                        left: `${dayProgress.percent}%`,
                        width: `${Math.round((dayProgress.inProgress / dayProgress.total) * 100)}%`,
                      }}
                    />
                  )}
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-full bg-success" />
                <span>
                  Concluídas <span className="font-semibold text-foreground tabular-nums">{dayProgress.done}</span>
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-full bg-warning/70" />
                <span>
                  Em andamento{" "}
                  <span className="font-semibold text-foreground tabular-nums">{dayProgress.inProgress}</span>
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-full bg-muted-foreground/50" />
                <span>
                  Pendentes <span className="font-semibold text-foreground tabular-nums">{dayProgress.pending}</span>
                </span>
              </span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Dois blocos lado-a-lado em desktop, empilhados em tablet vertical.
          - Próximas OPs (esquerda) → onde o operário pega a próxima tarefa.
          - Pronto pra expedir (direita) → pedidos que o motorista/expedidor pega agora. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.22 }}
        className="grid gap-4 xl:grid-cols-2"
      >
        <NextOpsBlock ops={nextOps} />
        <ReadyExpeditionBlock rows={readyExpedition} />
      </motion.div>

      {/* Atalhos primários do chão. Navegação completa está na sidebar; aqui só os 2 destinos do dia. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.28 }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <Button
          asChild
          size="lg"
          className="h-14 justify-between text-base"
        >
          <Link href="/chao-fabrica/ordens-producao">
            <span className="inline-flex items-center gap-2">
              <Factory className="size-5" aria-hidden />
              Abrir Produção
            </span>
            <ArrowRight className="size-5" aria-hidden />
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-14 justify-between text-base"
        >
          <Link href="/chao-fabrica/expedicao">
            <span className="inline-flex items-center gap-2">
              <ListChecks className="size-5" aria-hidden />
              Abrir Expedição
            </span>
            <ArrowRight className="size-5" aria-hidden />
          </Link>
        </Button>
      </motion.div>
    </PageLayout>
  );
}

/* ============================================================
 * Bloco: Próximas OPs (fila do chão)
 * ============================================================ */

function NextOpsBlock({ ops }: { ops: ProductionOrderRow[] }) {
  return (
    <section
      aria-labelledby="proximas-ops-titulo"
      className="rounded-2xl border border-border/70 bg-panel/40"
    >
      <header className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <h2
            id="proximas-ops-titulo"
            className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            Próximas OPs
          </h2>
          <p className="mt-1 text-base font-semibold text-foreground">Fila de produção</p>
        </div>
        <Link
          href="/chao-fabrica/ordens-producao"
          className="inline-flex h-11 items-center gap-1 rounded-md px-3 text-sm font-semibold text-foreground hover:bg-panel/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver todas
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </header>

      {ops.length === 0 ? (
        <div className="flex min-h-[160px] items-center justify-center px-5 pb-5 text-center text-sm text-muted-foreground">
          Sem OPs pendentes na janela.
        </div>
      ) : (
        <ul className="divide-y divide-border/60 border-t border-border/60">
          {ops.map((op) => {
            const visual = STATUS_VISUAL[op.status] ?? STATUS_VISUAL.em_espera;
            const progress = Math.max(0, Math.min(100, Math.round(op.progress)));
            return (
              <li key={op.id}>
                <Link
                  href={`/chao-fabrica/ordens-producao?op=${encodeURIComponent(op.code)}`}
                  className="flex min-h-[72px] items-center gap-4 px-5 py-3 transition-colors hover:bg-panel/70 focus-visible:outline-none focus-visible:bg-panel/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-sm font-semibold ${visual.chip}`}
                      >
                        {visual.label}
                      </span>
                      <span className="truncate font-mono text-sm text-muted-foreground">{op.code}</span>
                    </div>
                    <p className="mt-1 truncate text-base font-semibold text-foreground">
                      {op.lineName}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                      {formatKgValue(op.totalKg)} kg
                      <span className="mx-1.5 opacity-50">·</span>
                      {op.itemsCount} {op.itemsCount === 1 ? "item" : "itens"}
                      <span className="mx-1.5 opacity-50">·</span>
                      {op.productionDateLabel}
                    </p>
                  </div>

                  <div className="flex w-24 shrink-0 flex-col items-end gap-1.5">
                    <span className="text-sm font-semibold text-foreground tabular-nums">{progress}%</span>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-panel/60 ring-1 ring-border/60">
                      <div
                        className={`h-full ${visual.bar} transition-[width] duration-300`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ============================================================
 * Bloco: Pronto pra expedir
 * ============================================================ */

function ReadyExpeditionBlock({ rows }: { rows: ExpeditionRow[] }) {
  return (
    <section
      aria-labelledby="pronto-expedir-titulo"
      className="rounded-2xl border border-border/70 bg-panel/40"
    >
      <header className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <h2
            id="pronto-expedir-titulo"
            className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            Pronto pra expedir
          </h2>
          <p className="mt-1 text-base font-semibold text-foreground">Esperando checklist</p>
        </div>
        <Link
          href="/chao-fabrica/expedicao"
          className="inline-flex h-11 items-center gap-1 rounded-md px-3 text-sm font-semibold text-foreground hover:bg-panel/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver todos
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="flex min-h-[160px] items-center justify-center px-5 pb-5 text-center text-sm text-muted-foreground">
          Nenhum pedido pronto para expedição agora.
        </div>
      ) : (
        <ul className="divide-y divide-border/60 border-t border-border/60">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/chao-fabrica/expedicao/${row.id}`}
                className="flex min-h-[72px] items-center gap-4 px-5 py-3 transition-colors hover:bg-panel/70 focus-visible:outline-none focus-visible:bg-panel/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex shrink-0 items-center rounded-full bg-success/35 px-3 py-1.5 text-sm font-semibold text-success-foreground">
                      Pronto
                    </span>
                    <span className="truncate font-mono text-sm text-muted-foreground">{row.orderCode}</span>
                  </div>
                  <p className="mt-1 truncate text-base font-semibold text-foreground">{row.storeName}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                    {formatKgValue(row.totalKg)} kg
                    <span className="mx-1.5 opacity-50">·</span>
                    {row.itemsCount} {row.itemsCount === 1 ? "item" : "itens"}
                    <span className="mx-1.5 opacity-50">·</span>
                    entrega {row.deliveryDateLabel}
                  </p>
                </div>

                <span className="inline-flex h-11 shrink-0 items-center gap-1 rounded-md bg-panel/60 px-3 text-sm font-semibold text-foreground ring-1 ring-border/70">
                  Abrir checklist
                  <ChevronRight className="size-4" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
