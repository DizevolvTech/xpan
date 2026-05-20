"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  ClipboardCheck,
  Factory,
  Inbox,
  ListChecks,
  PackageCheck,
  Truck,
  Zap,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { useToast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import type { OrderStatus, PlannedOrderRow, ProductionOrderItem, ProductionOrderRow } from "@/lib/factory-planning";
import { filterFactoryPlanningDataByOperationalScope } from "@/lib/operational-date-scope";
import { getNextProductionItemStatus } from "@/lib/production-workflow";
import { formatKgLabel, formatKgValue } from "@/lib/utils";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";

/**
 * Status visual map para os chips do dashboard.
 * Chips altos (px-3 py-1.5) — operário lê de longe, mãos sujas.
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

// ============================================================
// Kanban — espelha modelo do gestor, mas com cards "versão chão"
// (glanceable, tablet, hit-targets ≥44px).
// AJ-0001 REVOGADA: o Kanban é ACIONÁVEL pelo operário.
//  - "Em produção"            → Marcar concluída (cascata de status)
//  - "Aguardando expedição"   → Abrir checklist
//  - "Aberto" / "Em rota"     → leitura (chão não libera nem entrega)
// ============================================================

type KanbanTone = "warning" | "info" | "primary" | "success";

type KanbanColumnBase = {
  key: string;
  title: string;
  tone: KanbanTone;
  statuses: OrderStatus[];
  icon: typeof Inbox;
  emptyText: string;
  listHref: string;
  totalCount: number;
};

type KanbanColumn =
  | (KanbanColumnBase & { kind: "orders"; items: PlannedOrderRow[] })
  | (KanbanColumnBase & { kind: "ops"; items: ProductionOrderRow[] });

const KANBAN_TONE_STYLES: Record<
  KanbanTone,
  { bar: string; count: string; eyebrow: string; ring: string; iconWrap: string }
> = {
  warning: {
    bar: "bg-warning",
    count: "text-warning",
    eyebrow: "text-warning",
    ring: "shadow-[var(--shadow-soft)] ring-1 ring-warning/20",
    iconWrap: "bg-warning/15 text-warning",
  },
  info: {
    bar: "bg-info",
    count: "text-info",
    eyebrow: "text-info",
    ring: "shadow-[var(--shadow-soft)] ring-1 ring-info/20",
    iconWrap: "bg-info/15 text-info",
  },
  primary: {
    bar: "bg-primary",
    count: "text-primary",
    eyebrow: "text-primary",
    ring: "shadow-[var(--shadow-soft)] ring-1 ring-primary/20",
    iconWrap: "bg-primary/15 text-primary",
  },
  success: {
    bar: "bg-success",
    count: "text-success",
    eyebrow: "text-success",
    ring: "shadow-[var(--shadow-soft)] ring-1 ring-success/20",
    iconWrap: "bg-success/15 text-success",
  },
};

// Limite de cards exibidos por coluna no chão.
// Operário não rola listas longas no tablet — 6 + "Ver todas".
const CHAO_KANBAN_LIMIT = 6;

// Ordem da fila do chão: "em produção" e "agendado" sobem; "em espera" depois; concluído nunca aparece.
const QUEUE_PRIORITY: Record<OrderStatus, number> = {
  em_producao: 0,
  agendado: 1,
  em_espera: 2,
  aguardando_expedicao: 3,
  rota_entrega: 4,
  cancelado: 99,
};

/** Deep-link do card de pedido por status — leitura contextual no chão. */
function getOrderHref(row: PlannedOrderRow): string {
  switch (row.status) {
    case "aguardando_expedicao":
      return `/chao-fabrica/expedicao/${row.id}`;
    case "rota_entrega":
      return "/chao-fabrica/entregas?status=em_rota";
    default:
      // em_espera / agendado / cancelado: lista de OPs do chão (operário não libera pedido)
      return "/chao-fabrica/ordens-producao";
  }
}

/**
 * Retorna o conjunto de productionItemKeys de uma OP que ainda NÃO chegaram
 * em "concluido". O botão "Marcar concluída" no card do chão dispara, em
 * cascata, `updateProductionItemStatus` para cada item — usando apenas
 * `getNextProductionItemStatus` (idêntico ao fluxo do gestor, AJ-0006). Sem
 * endpoint novo. Cada item avança 1 estágio por chamada; a função abaixo
 * resolve a sequência completa até "concluido" client-side.
 */
function getPendingProductionItems(op: ProductionOrderRow): ProductionOrderItem[] {
  return op.items.filter((item) => item.status !== "concluido");
}

export default function ChaoFabricaPage() {
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const {
    planningData: planningSnapshot,
    isLoading,
    error,
    updateProductionItemStatus,
  } = useFactoryPlanningSnapshot(anchorDate);
  const planningData = useMemo(
    () => filterFactoryPlanningDataByOperationalScope(planningSnapshot, scope),
    [planningSnapshot, scope],
  );
  const toast = useToast();

  // Estado de mutation por OP — bloqueia o botão e baixa opacidade do card.
  // Chave: op.id. Não persistido — só durante a chamada em voo.
  const [pendingOpId, setPendingOpId] = useState<string | null>(null);

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

  // Kanban (4 colunas) — espelha o modelo do gestor.
  //   1. Aberto                  — pedidos em_espera / agendado          (warning)
  //   2. Em produção             — OPs em_producao (agrupa por OP)       (info)
  //   3. Aguardando expedição    — pedidos aguardando_expedicao          (primary)
  //   4. Em rota / entregue      — pedidos rota_entrega                  (success)
  const kanbanColumns = useMemo<KanbanColumn[]>(() => {
    const abertoItems = planningData.orders
      .filter((order) => order.status === "em_espera" || order.status === "agendado")
      .sort((a, b) => {
        const ap = QUEUE_PRIORITY[a.status] ?? 50;
        const bp = QUEUE_PRIORITY[b.status] ?? 50;
        if (ap !== bp) return ap - bp;
        return a.deliveryDate.localeCompare(b.deliveryDate) || a.code.localeCompare(b.code);
      });

    const producaoItems = [...planningData.productionOrders]
      .filter((op) => op.status === "em_producao")
      .sort((a, b) => {
        // Mais "quentes" primeiro: maior progresso → maior carga
        if (b.progress !== a.progress) return b.progress - a.progress;
        return b.totalKg - a.totalKg;
      });

    const expedicaoItems = planningData.orders
      .filter((order) => order.status === "aguardando_expedicao")
      .sort(
        (a, b) =>
          a.deliveryDate.localeCompare(b.deliveryDate) || a.code.localeCompare(b.code),
      );

    const rotaItems = planningData.orders
      .filter((order) => order.status === "rota_entrega")
      .sort(
        (a, b) =>
          a.deliveryDate.localeCompare(b.deliveryDate) || a.code.localeCompare(b.code),
      );

    return [
      {
        kind: "orders",
        key: "aberto",
        title: "Aberto",
        tone: "warning",
        statuses: ["em_espera", "agendado"],
        icon: Inbox,
        emptyText: "Nenhum pedido aberto no período selecionado.",
        listHref: "/chao-fabrica/ordens-producao",
        items: abertoItems.slice(0, CHAO_KANBAN_LIMIT),
        totalCount: abertoItems.length,
      },
      {
        kind: "ops",
        key: "producao",
        title: "Em produção",
        tone: "info",
        statuses: ["em_producao"],
        icon: Factory,
        emptyText: "Nenhuma OP em produção agora.",
        listHref: "/chao-fabrica/ordens-producao",
        items: producaoItems.slice(0, CHAO_KANBAN_LIMIT),
        totalCount: producaoItems.length,
      },
      {
        kind: "orders",
        key: "expedicao",
        title: "Aguardando expedição",
        tone: "primary",
        statuses: ["aguardando_expedicao"],
        icon: PackageCheck,
        emptyText: "Nenhum pedido aguardando checklist.",
        listHref: "/chao-fabrica/expedicao",
        items: expedicaoItems.slice(0, CHAO_KANBAN_LIMIT),
        totalCount: expedicaoItems.length,
      },
      {
        kind: "orders",
        key: "rota",
        title: "Em rota / entregue",
        tone: "success",
        statuses: ["rota_entrega"],
        icon: Truck,
        emptyText: "Nenhum pedido em rota agora.",
        listHref: "/chao-fabrica/entregas?status=em_rota",
        items: rotaItems.slice(0, CHAO_KANBAN_LIMIT),
        totalCount: rotaItems.length,
      },
    ];
  }, [planningData.orders, planningData.productionOrders]);

  // ============================================================
  // Priorização "PRÓXIMA": destaca a OP que o operário deve atacar primeiro.
  // Critério (em ordem):
  //   1. menor `productionDate` (entrega mais cedo)
  //   2. em caso de empate, maior `progress` (mais perto de fechar)
  // Só uma OP recebe o badge — o operário precisa de um sinal, não de vários.
  // Calculado sobre o conjunto VISÍVEL da coluna "Em produção".
  // ============================================================
  const nextOpId = useMemo<string | null>(() => {
    const producaoColumn = kanbanColumns.find((column) => column.key === "producao");
    if (!producaoColumn || producaoColumn.kind !== "ops" || producaoColumn.items.length === 0) {
      return null;
    }
    const sorted = [...producaoColumn.items].sort((a, b) => {
      const byDate = a.productionDate.localeCompare(b.productionDate);
      if (byDate !== 0) return byDate;
      if (b.progress !== a.progress) return b.progress - a.progress;
      return a.code.localeCompare(b.code);
    });
    return sorted[0]?.id ?? null;
  }, [kanbanColumns]);

  const totalKanbanItems = kanbanColumns.reduce((sum, col) => sum + col.totalCount, 0);
  const kanbanIsEmpty = totalKanbanItems === 0 && !isLoading && !error;

  // ============================================================
  // Ação: "Marcar concluída" (versão chão).
  // Avança cada item pendente até `concluido`, em cascata. Usa SOMENTE a
  // action `update-production-item-status` (única exposta pelo workflow para
  // permissão `chao-fabrica.ops`). Sem endpoint novo. O hook já invalida o
  // cache de planning ao final.
  //
  // Estratégia:
  //  - Loop sobre os items pendentes; para cada um, avança 1 estágio.
  //  - Repete até todos atingirem "concluido" (ou um erro interromper).
  //  - Otimismo: setamos `pendingOpId` no início → card baixa opacidade,
  //    botão entra em `isLoading`. Outras colunas/cards continuam clicáveis.
  // ============================================================
  const handleCompleteOp = useCallback(
    async (op: ProductionOrderRow) => {
      if (pendingOpId) return; // evita corrida com outra mutation em voo no mesmo card
      setPendingOpId(op.id);
      try {
        // Trabalhamos sobre um snapshot local — cada chamada altera o servidor,
        // mas o snapshot client só refresca ao final do hook. Iteramos
        // calculando o próximo estágio com base no estado VISTO localmente.
        const queue = getPendingProductionItems(op).map((item) => ({
          key: item.productionItemKey,
          status: item.status,
          stages: item.preparationStages,
        }));

        if (queue.length === 0) {
          toast.info("OP já está concluída.");
          setPendingOpId(null);
          return;
        }

        // Avança 1 estágio por iteração, item a item. Garante a transição
        // exata de +1 (canTransitionProductionItemStatus é estrito).
        let safety = 0;
        const MAX_STEPS = queue.length * 8; // 6 estágios + folga
        while (queue.some((entry) => entry.status !== "concluido")) {
          safety += 1;
          if (safety > MAX_STEPS) {
            throw new Error("Limite de avanços excedido. Tente abrir a OP para concluir manualmente.");
          }
          for (const entry of queue) {
            if (entry.status === "concluido") continue;
            const next = getNextProductionItemStatus(entry.status, entry.stages);
            if (!next) {
              entry.status = "concluido";
              continue;
            }
            await updateProductionItemStatus(entry.key, next);
            entry.status = next;
          }
        }

        toast.success(`OP ${op.code} concluída.`);
      } catch (mutationError) {
        const message =
          mutationError instanceof Error ? mutationError.message : "Falha ao concluir a OP.";
        toast.error(message, { title: "Não foi possível concluir" });
      } finally {
        setPendingOpId(null);
      }
    },
    [pendingOpId, toast, updateProductionItemStatus],
  );

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

      {/* Progresso do dia — hero secundário, full-width. */}
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

      {/* ============================================================
          KANBAN — peça central do chão.
          4 colunas, espelha o modelo conceitual do gestor:
          Aberto · Em produção · Aguardando expedição · Em rota.
          AÇÕES INLINE (1 toque, ≥44px):
           - Em produção         → Marcar concluída
           - Aguardando expedição → Abrir checklist
          A 1ª OP da fila "Em produção" recebe badge PRÓXIMA.
         ============================================================ */}
      {error ? (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl bg-danger/15 px-5 py-4 text-sm text-danger-foreground"
        >
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <span className="font-semibold">{error}</span>
        </div>
      ) : null}

      {kanbanIsEmpty ? (
        <p className="rounded-2xl border border-dashed border-border/70 bg-panel/30 px-5 py-3 text-sm text-muted-foreground">
          Sem operações no período. Ajuste a janela.
        </p>
      ) : null}

      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.22 }}
        aria-label="Quadro operacional do chão"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {kanbanColumns.map((column) => {
          const tone = KANBAN_TONE_STYLES[column.tone];
          const Icon = column.icon;
          const isEmpty = column.items.length === 0;
          const hasMore = column.totalCount > column.items.length;
          return (
            <section
              key={column.key}
              aria-labelledby={`chao-kanban-${column.key}-title`}
              className={`group relative flex min-h-[420px] flex-col gap-3 overflow-hidden rounded-2xl bg-card p-4 ${tone.ring}`}
            >
              <span
                aria-hidden
                className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${tone.bar}`}
              />

              {/* Header — número GIGANTE + título uppercase + ícone à esquerda.
                  Clicável: leva à lista filtrada. h-11 mínimo no link. */}
              <header className="flex items-start justify-between gap-3 pl-2">
                <Link
                  href={column.listHref}
                  className="block min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Abrir lista — ${column.title} (${column.totalCount})`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl ${tone.iconWrap}`}
                    >
                      <Icon className="size-6" />
                    </span>
                    <div className="min-w-0">
                      <span
                        className={`font-heading text-4xl font-bold leading-none tabular-nums ${tone.count} sm:text-5xl`}
                      >
                        {column.totalCount}
                      </span>
                      <span
                        id={`chao-kanban-${column.key}-title`}
                        className={`mt-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] ${tone.eyebrow}`}
                      >
                        {column.title}
                      </span>
                    </div>
                  </div>
                </Link>
                {isLoading && isEmpty ? (
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Carregando…
                  </span>
                ) : null}
              </header>

              {/* Lista de cards — densidade chão (cards altos, glanceable). */}
              <div className="flex flex-1 flex-col gap-2">
                {isEmpty ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 px-2 py-6 text-center">
                    <Icon
                      aria-hidden
                      className="size-7 text-muted-foreground/30"
                    />
                    <p className="text-sm text-muted-foreground">{column.emptyText}</p>
                  </div>
                ) : column.kind === "ops" ? (
                  column.items.map((op) => (
                    <ChaoOpCard
                      key={op.id}
                      op={op}
                      tone={tone}
                      isNext={op.id === nextOpId}
                      isPending={pendingOpId === op.id}
                      onComplete={handleCompleteOp}
                    />
                  ))
                ) : (
                  column.items.map((order) => (
                    <ChaoOrderCard key={order.id} order={order} />
                  ))
                )}

                {hasMore ? (
                  <Link
                    href={column.listHref}
                    className="mt-auto inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-panel/40 px-4 text-sm font-semibold text-foreground ring-1 ring-border/60 transition-colors hover:bg-panel/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Ver todas — ${column.title} (${column.totalCount})`}
                  >
                    Ver todas ({column.totalCount})
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                ) : null}
              </div>
            </section>
          );
        })}
      </motion.section>

      {/* Atalhos primários do chão — supporting cast, rodapé da página. */}
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
 * Card de OP — coluna "Em produção" (versão chão).
 * min-h 112, p-4, hit-targets ≥44px. Progress h-2.5.
 * - Badge "PRÓXIMA" visualmente destaca a OP de maior prioridade da fila.
 * - Header é um Link (leva à OP); o BOTÃO de ação é separado para evitar
 *   conflito de click-target (button-inside-anchor é inválido).
 * - Estado "pending": opacity reduzida + botão isLoading.
 * ============================================================ */

function ChaoOpCard({
  op,
  tone,
  isNext,
  isPending,
  onComplete,
}: {
  op: ProductionOrderRow;
  tone: (typeof KANBAN_TONE_STYLES)[KanbanTone];
  isNext: boolean;
  isPending: boolean;
  onComplete: (op: ProductionOrderRow) => void | Promise<void>;
}) {
  const visual = STATUS_VISUAL[op.status] ?? STATUS_VISUAL.em_producao;
  const progress = Math.max(0, Math.min(100, Math.round(op.progress)));
  const orderCount = op.ordersCount;

  // "PRÓXIMA" gera um ring forte + faixa lateral expandida — sinal que o
  // operário identifica de 1m de distância. Sem animação distrativa.
  const containerClass = isNext
    ? "ring-2 ring-info shadow-[var(--shadow-soft)]"
    : "ring-1 ring-border/60";

  return (
    <article
      aria-label={`OP ${op.code}${isNext ? " — próxima da fila" : ""}`}
      className={`relative flex min-h-[140px] flex-col gap-2 rounded-xl bg-panel/40 p-4 transition-opacity ${containerClass} ${isPending ? "opacity-60" : ""}`}
    >
      {/* Header clicável — vai pra lista filtrada da OP (modo leitura). */}
      <Link
        href={`/chao-fabrica/ordens-producao?op=${encodeURIComponent(op.code)}`}
        className="flex items-center justify-between gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Abrir OP ${op.code}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          {isNext ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-info px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-info-foreground"
              aria-label="Próxima OP a executar"
            >
              <Zap className="size-3.5" aria-hidden />
              Próxima
            </span>
          ) : (
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-sm font-semibold ${visual.chip}`}
            >
              {visual.label}
            </span>
          )}
        </div>
        <span className="truncate font-mono text-sm text-muted-foreground">{op.code}</span>
      </Link>

      <p className="truncate text-lg font-semibold leading-tight text-foreground">
        {op.lineName}
        {op.sectorName ? (
          <span className="ml-1.5 text-base font-normal text-muted-foreground">— {op.sectorName}</span>
        ) : null}
      </p>

      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-panel/60 ring-1 ring-border/60"
        >
          <div
            className={`h-full ${tone.bar} transition-[width] duration-300`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {progress}%
        </span>
      </div>

      <p className="text-sm text-muted-foreground tabular-nums">
        {formatKgValue(op.totalKg)} kg
        <span className="mx-1.5 opacity-50">·</span>
        {orderCount} {orderCount === 1 ? "pedido" : "pedidos"}
        <span className="mx-1.5 opacity-50">·</span>
        entrega {op.productionDateLabel}
      </p>

      {/* Ação primária do chão: "Marcar concluída". 1 toque, h-11, full-width.
          Otimistic UI via `isLoading` (Button UX-0004 troca conteúdo por spinner). */}
      <Button
        type="button"
        size="lg"
        variant={isNext ? "default" : "outline"}
        className="mt-1 h-11 w-full justify-center gap-2 text-base"
        isLoading={isPending}
        loadingText="Concluindo…"
        onClick={() => void onComplete(op)}
        aria-label={`Marcar OP ${op.code} como concluída`}
      >
        <Check className="size-5" aria-hidden />
        Marcar concluída
      </Button>
    </article>
  );
}

/* ============================================================
 * Card de pedido — colunas Aberto / Aguardando expedição / Em rota
 * (versão chão) — min-h 96, p-4.
 * "Aguardando expedição" ganha um BOTÃO explícito "Abrir checklist"
 * (operário no tablet com mãos sujas precisa de affordance, não de pista).
 * ============================================================ */

function ChaoOrderCard({ order }: { order: PlannedOrderRow }) {
  const visual = STATUS_VISUAL[order.status] ?? STATUS_VISUAL.em_espera;
  const isExpedicao = order.status === "aguardando_expedicao";

  // Em "Aguardando expedição" o card é um container neutro (não-link) com um
  // BOTÃO "Abrir checklist" — evita duplicar affordance e dá hit-target claro.
  // Nas demais colunas mantemos o card-link (leitura passiva).
  if (isExpedicao) {
    return (
      <article
        aria-label={`Pedido ${order.code} — ${order.storeName}`}
        className="flex min-h-[112px] flex-col gap-2 rounded-xl bg-panel/40 p-4 ring-1 ring-border/60"
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-sm font-semibold ${visual.chip}`}
          >
            {visual.label}
          </span>
          <span className="truncate font-mono text-sm text-muted-foreground">{order.code}</span>
        </div>

        <p className="truncate text-lg font-semibold leading-tight text-foreground">
          {order.storeName}
        </p>

        <p className="text-sm text-muted-foreground tabular-nums">
          {formatKgValue(order.totalKg)} kg
          <span className="mx-1.5 opacity-50">·</span>
          {order.itemsCount} {order.itemsCount === 1 ? "item" : "itens"}
          <span className="mx-1.5 opacity-50">·</span>
          entrega {order.deliveryDateLabel}
        </p>

        <Button
          asChild
          size="lg"
          className="mt-1 h-11 w-full justify-center gap-2 text-base"
        >
          <Link
            href={`/chao-fabrica/expedicao/${order.id}`}
            aria-label={`Abrir checklist do pedido ${order.code}`}
          >
            <ClipboardCheck className="size-5" aria-hidden />
            Abrir checklist
          </Link>
        </Button>
      </article>
    );
  }

  return (
    <Link
      href={getOrderHref(order)}
      className="group/order flex min-h-[96px] flex-col gap-2 rounded-xl bg-panel/40 p-4 ring-1 ring-border/60 transition-colors hover:bg-panel/70 focus-visible:bg-panel/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-sm font-semibold ${visual.chip}`}
        >
          {visual.label}
        </span>
        <span className="truncate font-mono text-sm text-muted-foreground">{order.code}</span>
      </div>

      <p className="truncate text-lg font-semibold leading-tight text-foreground">
        {order.storeName}
      </p>

      <p className="text-sm text-muted-foreground tabular-nums">
        {formatKgValue(order.totalKg)} kg
        <span className="mx-1.5 opacity-50">·</span>
        {order.itemsCount} {order.itemsCount === 1 ? "item" : "itens"}
        <span className="mx-1.5 opacity-50">·</span>
        entrega {order.deliveryDateLabel}
      </p>
    </Link>
  );
}
