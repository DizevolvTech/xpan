"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  Circle,
  Factory,
  ListChecks,
  PackageCheck,
  Soup,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

import { KanbanCardMotion } from "@/components/shared/kanban-card-motion";
import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { useToast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import {
  getProductionOrderNavKey,
  isOpInProductionColumn,
  isOpOnChaoBoard,
} from "@/lib/factory-kanban";
import type {
  ProductionItemStatus,
  ProductionOrderRow,
} from "@/lib/factory-planning";
import { filterFactoryPlanningDataByOperationalScope } from "@/lib/operational-date-scope";
import { getNextProductionActionLabel, getNextProductionItemStatus } from "@/lib/production-workflow";
import { formatKgLabel, formatKgValue } from "@/lib/utils";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";

// ============================================================
// Kanban POR ETAPA DE PRODUÇÃO — o jeito que o operário pensa (SOMENTE LEITURA).
// Em vez de colunas por ciclo do pedido (Aberto · Em produção · Expedição ·
// Rota — 3 das quais o chão nem aciona), o board distribui cada OP pela sua
// ETAPA ATUAL, colapsada em 4 colunas:
//   1. Não iniciado  →  2. Em preparação  →  3. Produção  →  4. Expedição
// "Produção" agrupa em produção / no forno / embalando. "Expedição" reúne as
// OPs concluídas, APTAS a seguir para a conferência/checklist.
// A liberação do pedido (gestor) e a roteirização (entrega) ficam fora do board:
// viram KPI/linha informativa, não colunas. O caminho até a conferência é um
// link no KPI "Prontos p/ expedir" e no selo de OP concluída.
// ============================================================

type KanbanTone = "muted" | "warning" | "info" | "primary" | "success";

type KanbanColumnBase = {
  key: string;
  title: string;
  tone: KanbanTone;
  icon: typeof Circle;
  emptyText: string;
  listHref: string;
  totalCount: number;
};

// O board do chão é 100% produção: toda coluna é `kind: "ops"`. A antiga coluna
// handoff de expedição (`kind: "orders"`) saiu — a saída para o checklist agora
// é um link no KPI e no selo de OP concluída, não uma coluna.
type KanbanColumn = KanbanColumnBase & {
  kind: "ops";
  items: ProductionOrderRow[];
  // Lista COMPLETA da coluna (antes da paginação visual) — usada pelo "Avançar todas
  // da coluna" para tocar TODAS as OPs, não só as visíveis.
  allItems: ProductionOrderRow[];
};

const KANBAN_TONE_STYLES: Record<
  KanbanTone,
  { bar: string; count: string; eyebrow: string; ring: string; iconWrap: string }
> = {
  muted: {
    bar: "bg-muted-foreground/50",
    count: "text-foreground",
    eyebrow: "text-muted-foreground",
    ring: "ring-1 ring-border/60",
    iconWrap: "bg-muted/70 text-muted-foreground",
  },
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

// ============================================================
// Etapa atual de uma OP = o status MENOS avançado entre os itens NÃO
// concluídos (o gargalo — o que falta fazer A SEGUIR). É essa etapa que decide
// em qual coluna do board o card aparece.
// ============================================================
const STATUS_RANK: Record<ProductionItemStatus, number> = {
  nao_iniciado: 0,
  em_preparacao: 1,
  em_producao: 2,
  em_forno: 3,
  embalando: 4,
  concluido: 5,
};

function opCurrentStage(op: ProductionOrderRow): ProductionItemStatus {
  const pend = op.items.filter((i) => i.status !== "concluido");
  if (!pend.length) return "concluido";
  return pend.reduce<ProductionItemStatus>(
    (min, i) => (STATUS_RANK[i.status] < STATUS_RANK[min] ? i.status : min),
    pend[0].status,
  );
}

// Rótulo de ENTREGA da OP, derivado dos pedidos de origem — NÃO é a data de produção
// (`productionDate`). Uma OP produz num dia e pode servir entregas de datas diferentes
// (leads distintos por produto); mostra a data única ou a mais próxima + "+N".
function deriveOpDeliveryLabel(op: ProductionOrderRow): string | null {
  const labelByDate = new Map<string, string>();
  for (const src of op.sourceItems) {
    if (src.deliveryDate) labelByDate.set(src.deliveryDate, src.deliveryDateLabel);
  }
  if (labelByDate.size === 0) return null;
  const sorted = [...labelByDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const [, firstLabel] = sorted[0];
  return sorted.length === 1 ? firstLabel : `${firstLabel} +${sorted.length - 1}`;
}

// Itens de uma OP que avançam POR STATUS em um clique: pendentes, NÃO-batidos, com uma
// próxima etapa definida. Cada um leva seu status-alvo. Batidos avançam pelas batidas
// (pré-pesagem) — ficam de fora do avanço em massa por status.
function advanceableItemsOf(
  op: ProductionOrderRow,
): Array<{ productionItemKey: string; status: ProductionItemStatus }> {
  return op.items
    .filter(
      (item) =>
        item.status !== "concluido" && !(item.capacityPerBatch != null && item.capacityPerBatch > 0),
    )
    .flatMap((item) => {
      const next = getNextProductionItemStatus(item.status, item.preparationStages);
      return next ? [{ productionItemKey: item.productionItemKey, status: next }] : [];
    });
}

// O board do chão tem 4 colunas. "Produção" agrupa os 3 estágios intermediários
// (em produção, no forno, embalando) — o chão só precisa enxergar "está sendo
// produzido", sem o detalhe da sub-etapa. "Expedição" é a OP com todos os itens
// concluídos: APTA a seguir para a conferência/checklist.
type BoardColumnKey = "nao_iniciado" | "em_preparacao" | "producao" | "expedicao";

// Mapeia a etapa-atual (gargalo) de uma OP para a coluna do board.
function opBoardColumn(stage: ProductionItemStatus): BoardColumnKey {
  switch (stage) {
    case "nao_iniciado":
      return "nao_iniciado";
    case "em_preparacao":
      return "em_preparacao";
    case "concluido":
      return "expedicao";
    // em_producao | em_forno | embalando → tudo "Produção"
    default:
      return "producao";
  }
}

const BOARD_COLUMNS: {
  key: BoardColumnKey;
  title: string;
  tone: KanbanTone;
  icon: typeof Circle;
}[] = [
  { key: "nao_iniciado", title: "Não iniciado", tone: "muted", icon: Circle },
  { key: "em_preparacao", title: "Em preparação", tone: "warning", icon: Soup },
  { key: "producao", title: "Produção", tone: "info", icon: Factory },
  // Apta à conferência: todos os itens concluídos, pronta p/ o checklist.
  { key: "expedicao", title: "Expedição", tone: "success", icon: PackageCheck },
];

export default function ChaoFabricaPage() {
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const {
    planningData: planningSnapshot,
    isLoading,
    error,
    advanceProductionItems,
  } = useFactoryPlanningSnapshot(anchorDate);
  const planningData = useMemo(
    () => filterFactoryPlanningDataByOperationalScope(planningSnapshot, scope),
    [planningSnapshot, scope],
  );

  // Avanço de etapa EM MASSA e DIRETO do board (não mais só-leitura, nem item a item):
  // 1 clique avança a OP inteira; o cabeçalho da coluna avança TODAS as OPs da coluna.
  // Escala p/ milhares de produtos/dia — nada de abrir OP por OP. Itens batidos são
  // geridos pela pré-pesagem (batidas), então ficam de fora do avanço por status.
  const [isAdvancing, setIsAdvancing] = useState(false);
  const toast = useToast();

  async function runAdvance(
    items: Array<{ productionItemKey: string; status: ProductionItemStatus }>,
    label: string,
  ) {
    if (items.length === 0) {
      toast.info("Nada a avançar por status — itens batidos avançam pelas batidas (pré-pesagem).");
      return;
    }
    setIsAdvancing(true);
    try {
      const result = await advanceProductionItems(items);
      if (result.advanced > 0) {
        toast.success(`${result.advanced} item(ns) avançado(s) — ${label}.`);
      }
      if (result.blockedCount > 0) {
        toast.warning(`${result.blockedCount} item(ns) em data futura não avançaram (só gestor/admin força).`);
      }
      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} item(ns) falharam ao avançar.`);
      }
    } catch (advanceError) {
      toast.error(advanceError instanceof Error ? advanceError.message : "Falha ao avançar a produção.");
    } finally {
      setIsAdvancing(false);
    }
  }

  const handleAdvanceOp = (op: ProductionOrderRow) => void runAdvance(advanceableItemsOf(op), op.code);
  const handleAdvanceColumn = (ops: ProductionOrderRow[], columnTitle: string) =>
    void runAdvance(ops.flatMap(advanceableItemsOf), `${columnTitle} (${ops.length} OP)`);

  // Lista canônica das OPs em PRODUÇÃO no chão — dirigida por ESTADO (liberada e
  // não-expedida), não por data. Bate 1:1 com a coluna "Em produção" do gestor
  // (mesmo predicado `isOpInProductionColumn`). Reusada no KPI, no progresso do dia
  // e no badge "PRÓXIMA" para que os números NUNCA se contradigam com o quadro.
  const productionOps = useMemo(
    () => planningData.productionOrders.filter((op) => isOpInProductionColumn(op)),
    [planningData.productionOrders],
  );

  // O BOARD mostra TODA OP liberada (decisão 2026-07-24: liberar já manda pro chão —
  // sem o 2º passo "Iniciar produção do dia"). Assim o chão bate com o gestor. As OPs
  // recém-liberadas caem na 1ª coluna ("Não iniciado" / pré-pesagem); as concluídas
  // migram para "Expedição". Antes exigia `productionStarted` e o chão ficava vazio até
  // o gestor iniciar — origem da divergência gestor×chão.
  const boardOps = useMemo(
    () => planningData.productionOrders.filter((op) => isOpOnChaoBoard(op)),
    [planningData.productionOrders],
  );

  const opsCount = productionOps.length;
  const productionKg = Number(productionOps.reduce((sum, item) => sum + item.totalKg, 0).toFixed(2));
  const releasedOrders = planningData.orders.filter((item) => item.releasedToProduction).length;
  const expeditionReady = planningData.expedition.filter((item) => item.status === "aguardando_expedicao").length;
  const awaitingRelease = planningData.orders.filter((item) => !item.releasedToProduction).length;
  const expeditionKg = Number(planningData.expedition.reduce((sum, item) => sum + item.totalKg, 0).toFixed(2));

  // Progresso médio do dia: média do `progress` das OPs em produção. Casa com a
  // coluna — toda OP do board contribui; expedição/liberação ficam de fora.
  const avgProgress =
    productionOps.length === 0
      ? 0
      : Math.round(productionOps.reduce((sum, op) => sum + op.progress, 0) / productionOps.length);

  // Stats secundárias: dados que importam, mas não competem com os 3 KPIs primários.
  // "Aguardando liberação" sai do board (não é etapa do chão) e vira linha informativa.
  const secondaryStats = [
    { label: "Carga de produção", value: formatKgLabel(productionKg, { maximumFractionDigits: 2 }) },
    { label: "Aguardando liberação", value: awaitingRelease },
    { label: "Pedidos liberados", value: releasedOrders },
    { label: "Carga de expedição", value: formatKgLabel(expeditionKg, { maximumFractionDigits: 2 }) },
  ];

  // Progresso do dia: OPs com progress=100 (ou status terminal) contam como concluídas.
  const dayProgress = useMemo(() => {
    const total = boardOps.length;
    if (total === 0) {
      return { total: 0, done: 0, inProgress: 0, pending: 0, percent: 0 };
    }
    let done = 0;
    let inProgress = 0;
    boardOps.forEach((op) => {
      if (opCurrentStage(op) === "concluido") done += 1;
      else if (op.progress > 0) inProgress += 1;
    });
    const pending = Math.max(0, total - done - inProgress);
    return {
      total,
      done,
      inProgress,
      pending,
      percent: Math.round((done / total) * 100),
    };
  }, [boardOps]);

  // Kanban de 4 colunas (Não iniciado · Em preparação · Produção · Expedição).
  // Cada OP é alocada pela sua ETAPA ATUAL (gargalo), colapsada na coluna do
  // board correspondente. A coluna "Expedição" reúne as OPs concluídas, aptas
  // a seguir para a conferência.
  const kanbanColumns = useMemo<KanbanColumn[]>(() => {
    // Pré-agrupa as OPs por coluna do board num único passo.
    const byColumn = new Map<BoardColumnKey, ProductionOrderRow[]>();
    for (const op of boardOps) {
      const column = opBoardColumn(opCurrentStage(op));
      const bucket = byColumn.get(column);
      if (bucket) bucket.push(op);
      else byColumn.set(column, [op]);
    }

    return BOARD_COLUMNS.map(({ key, title, tone, icon }) => {
      const items = (byColumn.get(key) ?? []).sort((a, b) => {
        // Dentro da coluna: entrega mais cedo primeiro, depois mais perto de fechar.
        const byDate = a.productionDate.localeCompare(b.productionDate);
        if (byDate !== 0) return byDate;
        if (b.progress !== a.progress) return b.progress - a.progress;
        return a.code.localeCompare(b.code);
      });
      return {
        kind: "ops",
        key,
        title,
        tone,
        icon,
        emptyText: "Nenhuma OP nesta etapa.",
        listHref: "/chao-fabrica/ordens-producao",
        items: items.slice(0, CHAO_KANBAN_LIMIT),
        allItems: items,
        totalCount: items.length,
      };
    });
  }, [boardOps]);

  // ============================================================
  // Priorização "PRÓXIMA": destaca a OP que o operário deve atacar primeiro.
  // Critério (em ordem):
  //   1. menor `productionDate` (entrega mais cedo)
  //   2. em caso de empate, maior `progress` (mais perto de fechar)
  // Só uma OP recebe o badge — o operário precisa de um sinal, não de vários.
  // Calculado sobre o conjunto VISÍVEL da coluna "Em produção".
  // ============================================================
  const nextOpId = useMemo<string | null>(() => {
    if (productionOps.length === 0) return null;
    const sorted = [...productionOps].sort((a, b) => {
      const byDate = a.productionDate.localeCompare(b.productionDate);
      if (byDate !== 0) return byDate;
      if (b.progress !== a.progress) return b.progress - a.progress;
      return a.code.localeCompare(b.code);
    });
    return sorted[0]?.id ?? null;
  }, [productionOps]);

  const totalKanbanItems = kanbanColumns.reduce((sum, col) => sum + col.totalCount, 0);
  const kanbanIsEmpty = totalKanbanItems === 0 && !isLoading && !error;

  // O board do chão é SOMENTE LEITURA: o operário acompanha o andamento, mas o
  // fluxo (aceitar pedidos do dia + liberar para produção) é dirigido pelo
  // Gestor de Fábrica. Antes daqui viviam `handleCompleteOp` e
  // `handleAdvanceOpOneStage`, que mudavam o status dos itens direto do card —
  // removidos porque adiantar/concluir OP fora do fluxo do gestor quebrava a
  // ordem das etapas. A mudança de status continua disponível no detalhe da OP.

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
        <KPICard title="OPs em produção" value={opsCount} tone="info" icon={Factory} compactValue />
        {/* KPI navegável: a produção concluída sai do board → este é o caminho
            do operário para o checklist de expedição (filtro aguardando_expedicao). */}
        <Link
          href="/chao-fabrica/expedicao?status=aguardando_expedicao"
          aria-label={`Prontos p/ expedir: ${expeditionReady}. Abrir expedição`}
          className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <KPICard
            title="Prontos p/ expedir →"
            value={expeditionReady}
            tone="success"
            icon={PackageCheck}
            compactValue
          />
        </Link>
        <KPICard
          title="Progresso do dia"
          value={`${avgProgress}%`}
          tone="neutral"
          icon={Zap}
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
          KANBAN — peça central do chão (SOMENTE LEITURA).
          4 colunas (scroll horizontal, colunas fixas de ≥280px):
          Não iniciado → Em preparação → Produção → Expedição (apta à conferência).
          O board acompanha o andamento; o avanço de etapa é dirigido pelo
          Gestor (aceitar pedidos do dia + liberar p/ produção) e, item a item,
          no detalhe da OP. Cada card mostra:
           - próximo passo (indicador read-only)
           - OP concluída → selo-link "ir para expedição" (saída p/ o checklist)
          A OP de maior prioridade recebe o badge PRÓXIMA dentro da sua etapa.
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
        aria-label="Quadro de produção por etapa"
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-gutter:stable]"
      >
        {kanbanColumns.map((column, columnIndex) => {
          const tone = KANBAN_TONE_STYLES[column.tone];
          const Icon = column.icon;
          const isEmpty = column.items.length === 0;
          const hasMore = column.totalCount > column.items.length;
          return (
            <section
              key={column.key}
              aria-labelledby={`chao-kanban-${column.key}-title`}
              className={`group relative flex min-h-[460px] w-[84vw] shrink-0 snap-start flex-col gap-3 overflow-hidden rounded-2xl bg-card p-4 sm:w-[300px] ${tone.ring}`}
            >
              <span
                aria-hidden
                className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${tone.bar}`}
              />

              {/* Header — passo Nº + ícone + título da etapa + contagem.
                  Clicável: leva à lista de OPs. h-11 mínimo no link. */}
              <header className="flex items-start justify-between gap-3 pl-2">
                <Link
                  href={column.listHref}
                  className="block min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Abrir lista — ${column.title} (${column.totalCount})`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={`relative inline-flex size-11 shrink-0 items-center justify-center rounded-xl ${tone.iconWrap}`}
                    >
                      <Icon className="size-6" />
                      <span className="absolute -right-1 -top-1 inline-flex size-5 items-center justify-center rounded-full bg-card text-[10px] font-bold tabular-nums text-muted-foreground ring-1 ring-border/70">
                        {columnIndex + 1}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <span
                        id={`chao-kanban-${column.key}-title`}
                        className={`block text-[11px] font-semibold uppercase tracking-[0.14em] ${tone.eyebrow}`}
                      >
                        {`Etapa ${columnIndex + 1}`}
                      </span>
                      <span className="mt-0.5 flex items-baseline gap-1.5">
                        <span
                          className={`font-heading text-3xl font-bold leading-none tabular-nums ${tone.count}`}
                        >
                          {column.totalCount}
                        </span>
                        <span className="truncate text-sm font-semibold text-foreground">
                          {column.title}
                        </span>
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

              {/* Avanço EM MASSA da coluna: 1 clique avança TODAS as OPs da etapa —
                  o que torna viável tocar milhares de produtos/dia. Só nas colunas
                  produtivas (Expedição é terminal) e quando há item avançável. */}
              {column.key !== "expedicao" &&
              column.allItems.some((op) => advanceableItemsOf(op).length > 0) ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isAdvancing}
                  onClick={() => handleAdvanceColumn(column.allItems, column.title)}
                  className="w-full gap-1.5"
                >
                  <Zap className="size-4" aria-hidden />
                  Avançar todas da coluna ({column.totalCount})
                </Button>
              ) : null}

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
                ) : (
                  // Cada card usa a CHAVE ESTÁVEL da OP (não o id posicional): assim, quando a
                  // OP muda de coluna ao avançar, o AnimatePresence a vê "sair" de uma coluna e
                  // "entrar" na outra — a transição de etapa que o operário enxerga.
                  <AnimatePresence initial={false} mode="popLayout">
                    {column.items.map((op) => (
                      <KanbanCardMotion key={getProductionOrderNavKey(op)} className="rounded-xl">
                        <ChaoOpCard
                          op={op}
                          tone={tone}
                          anchorDate={anchorDate}
                          isNext={op.id === nextOpId}
                          onAdvance={handleAdvanceOp}
                          isAdvancing={isAdvancing}
                        />
                      </KanbanCardMotion>
                    ))}
                  </AnimatePresence>
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
 * SOMENTE LEITURA: o card acompanha o andamento, não muda status. A mudança de
 * etapa é feita pelo Gestor (aceitar/liberar) e, item a item, no detalhe da OP.
 * min-h 112, p-4, hit-targets ≥44px. Progress h-2.5.
 * - Badge "PRÓXIMA" visualmente destaca a OP de maior prioridade da fila.
 * - Header é um Link (leva à OP); o rodapé mostra o próximo passo (read-only).
 * ============================================================ */

function ChaoOpCard({
  op,
  tone,
  anchorDate,
  isNext,
  onAdvance,
  isAdvancing,
}: {
  op: ProductionOrderRow;
  tone: (typeof KANBAN_TONE_STYLES)[KanbanTone];
  anchorDate: string;
  isNext: boolean;
  onAdvance: (op: ProductionOrderRow) => void;
  isAdvancing: boolean;
}) {
  const progress = Math.max(0, Math.min(100, Math.round(op.progress)));
  const orderCount = op.ordersCount;
  // Deep-link estável para o detalhe da OP (a chave não reindexa) + âncora de
  // data da janela operacional para o detalhe resolver o snapshot correto.
  const opDetailHref = `/chao-fabrica/ordens-producao/${encodeURIComponent(
    getProductionOrderNavKey(op),
  )}?ref=${encodeURIComponent(anchorDate)}`;
  // Agregado de batidas da OP (soma dos produtos batidos). Glanceable; detalhe na pré-pesagem.
  const batchedItems = op.items.filter((it) => it.batchCount > 1);
  const totalBatches = batchedItems.reduce((sum, it) => sum + it.batchCount, 0);
  const doneBatches = batchedItems.reduce((sum, it) => sum + it.batchesDone, 0);
  const hasBatches = batchedItems.length > 0;

  // Itens ainda não concluídos da OP.
  const pendingItems = op.items.filter((item) => item.status !== "concluido");
  const hasPendingItems = pendingItems.length > 0;
  // Data de ENTREGA (dos pedidos), não a de produção.
  const deliveryLabel = deriveOpDeliveryLabel(op);
  // PRÓXIMO passo CONCRETO ("Iniciar produção", "Enviar para forno"…) quando todos
  // os itens pendentes avançam para o mesmo passo; null se estiverem mistos (aí o
  // indicador read-only mostra apenas "Em andamento").
  const nextActionLabels = new Set(
    pendingItems
      .map((item) => getNextProductionActionLabel(item.status, item.preparationStages))
      .filter((label): label is string => Boolean(label)),
  );
  const nextStepLabel = nextActionLabels.size === 1 ? [...nextActionLabels][0] : null;

  // "PRÓXIMA" gera um ring forte + faixa lateral expandida — sinal que o
  // operário identifica de 1m de distância. Sem animação distrativa.
  const containerClass = isNext
    ? "ring-2 ring-info shadow-[var(--shadow-soft)]"
    : "ring-1 ring-border/60";

  return (
    <article
      aria-label={`OP ${op.code}${isNext ? " — próxima da fila" : ""}`}
      className={`relative flex min-h-[140px] flex-col gap-2 rounded-xl bg-panel/40 p-4 ${containerClass}`}
    >
      {/* Header clicável — vai pra lista filtrada da OP (modo leitura). */}
      <Link
        href={opDetailHref}
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
            // A coluna já indica a etapa — o card só precisa do código da OP.
            <span className="truncate font-mono text-sm font-semibold text-foreground">
              {op.code}
            </span>
          )}
        </div>
        {isNext ? (
          <span className="truncate font-mono text-sm text-muted-foreground">{op.code}</span>
        ) : null}
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
        {deliveryLabel ? (
          <>
            <span className="mx-1.5 opacity-50">·</span>
            entrega {deliveryLabel}
          </>
        ) : null}
      </p>

      {hasBatches ? (
        <p className="text-sm font-semibold text-foreground">
          Batidas: <span className="tabular-nums">{doneBatches}/{totalBatches}</span>
        </p>
      ) : null}

      {/* Avanço de etapa DIRETO do board: abre o diálogo de status da OP (o mesmo do
          gestor). Itens não-batidos têm "Avançar para {etapa}"; itens batidos aparecem
          read-only ("geridas no Chão") com atalho p/ o detalhe. Quando os itens estão
          em etapas diferentes, o rótulo cai para "Avançar etapa" (o diálogo resolve
          item a item). */}
      {hasPendingItems ? (
        // Ação PRINCIPAL do card: botão primário cheio (antes era um <button> apagado que
        // parecia desabilitado). `size="lg"` garante alvo de toque de 44px pro chão.
        <Button
          type="button"
          size="lg"
          onClick={() => onAdvance(op)}
          disabled={isAdvancing}
          className="mt-1 w-full"
          aria-label={nextStepLabel ? `Avançar toda a OP — ${nextStepLabel}` : "Avançar toda a OP"}
        >
          <ArrowRight className="size-4 shrink-0" aria-hidden />
          <span className="truncate">
            {nextStepLabel ? `Avançar OP: ${nextStepLabel}` : "Avançar OP"}
          </span>
        </Button>
      ) : (
        // OP concluída: nada a produzir no chão, mas o operário precisa de um
        // caminho claro para o checklist (a coluna de expedição saiu do board).
        // Selo verde VIROU AÇÃO: leva à Expedição filtrada por aguardando_expedicao.
        <Link
          href="/chao-fabrica/expedicao?status=aguardando_expedicao"
          aria-label={`OP ${op.code} concluída — ir para a expedição`}
          className="mt-1 flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 font-semibold text-emerald-700 outline-none transition-colors hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <Check className="size-5 shrink-0" aria-hidden />
          <span className="text-sm">Concluída · ir para expedição</span>
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </Link>
      )}
    </article>
  );
}
