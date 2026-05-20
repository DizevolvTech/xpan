"use client";

import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, ShoppingCart, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filterStoreOrderSummariesByOperationalScope } from "@/lib/operational-date-scope";
import { useCurrentProfile } from "@/lib/use-current-profile";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";
import { useStoreOccurrences } from "@/lib/use-store-occurrences";
import { useStoreOrderSummaries } from "@/lib/use-store-orders";
import { useStoreScope } from "@/lib/use-store-scope";

// Status que ainda representam algo a chegar / acompanhar (vs concluídos/cancelados).
const incomingDeliveryStatuses = new Set([
  "agendado",
  "em_producao",
  "aguardando_expedicao",
  "pronto_coleta",
  "em_rota",
  "no_destino",
  "tentativa_falha",
]);

// Buckets agregados para o donut de status (consolida estados do fluxo).
type StatusBucket = "agendado" | "em_producao" | "em_entrega" | "entregue" | "ocorrencia";

const statusBucketConfig: Record<
  StatusBucket,
  { label: string; barClassName: string; conicColor: string }
> = {
  agendado: {
    label: "Agendado",
    barClassName: "bg-warning",
    conicColor: "oklch(0.89 0.09 90)",
  },
  em_producao: {
    label: "Em produção",
    barClassName: "bg-info",
    conicColor: "oklch(0.84 0.06 238)",
  },
  em_entrega: {
    label: "Em entrega",
    barClassName: "bg-secondary",
    conicColor: "oklch(0.83 0.03 250)",
  },
  entregue: {
    label: "Entregue",
    barClassName: "bg-success",
    conicColor: "oklch(0.86 0.07 148)",
  },
  ocorrencia: {
    label: "Tentativa falha",
    barClassName: "bg-danger",
    conicColor: "oklch(0.82 0.11 22)",
  },
};

const statusBucketOrder: StatusBucket[] = [
  "agendado",
  "em_producao",
  "em_entrega",
  "entregue",
  "ocorrencia",
];

function bucketOf(status: string): StatusBucket | null {
  if (status === "agendado") return "agendado";
  if (status === "em_producao") return "em_producao";
  if (status === "aguardando_expedicao" || status === "pronto_coleta" || status === "em_rota" || status === "no_destino") {
    return "em_entrega";
  }
  if (status === "entregue") return "entregue";
  if (status === "tentativa_falha") return "ocorrencia";
  return null; // cancelado / em_espera não entram no donut do lojista
}

function addDaysToKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatShortDate(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(
    new Date(`${dateKey}T00:00:00`),
  );
}

function formatRelativeDeliveryLabel(dateKey: string, todayKey: string) {
  if (dateKey === todayKey) return "Hoje";
  if (dateKey === addDaysToKey(todayKey, 1)) return "Amanhã";
  const date = new Date(`${dateKey}T00:00:00`);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "");
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${formatShortDate(dateKey)}`;
}

function formatRelativeAge(iso: string, nowMs: number) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Math.max(0, nowMs - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} sem`;
  const months = Math.floor(days / 30);
  return `${months} m`;
}

function getFirstName(fullName: string | undefined) {
  if (!fullName) return "";
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export default function LojaPage() {
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const { profile, isLoading: isProfileLoading, error: profileError } = useCurrentProfile();
  const { snapshot } = useMasterDataSnapshot();
  const { orders, isLoading: isOrdersLoading, error: ordersError } = useStoreOrderSummaries(anchorDate);
  const { occurrences, isLoading: isOccurrencesLoading, error: occurrencesError } = useStoreOccurrences();
  const {
    availableStores,
    activeStoreId,
    activeStore,
    setActiveStoreId,
    shouldShowStoreSelector,
  } = useStoreScope(snapshot.stores.filter((store) => store.status === "ativo"), profile?.allowedStoreIds);

  const scopedOrders = useMemo(
    () => {
      const timeScopedOrders = filterStoreOrderSummariesByOperationalScope(orders, scope);
      return activeStoreId
        ? timeScopedOrders.filter((item) => item.storeId === activeStoreId)
        : timeScopedOrders;
    },
    [activeStoreId, orders, scope],
  );
  const scopedOccurrences = useMemo(
    () => (activeStoreId ? occurrences.filter((item) => item.storeId === activeStoreId) : occurrences),
    [activeStoreId, occurrences],
  );

  const metrics = useMemo(() => {
    // KPIs 5 → 3 (auditoria visível, P2): o lojista quer saber
    // "pedidos abertos meus" + "o que tá chegando" + "alguma ocorrência?"
    const openOrders = scopedOrders.filter(
      (item) => item.status === "agendado" || item.status === "em_producao",
    ).length;
    const incoming = scopedOrders.filter((item) =>
      [
        "aguardando_expedicao",
        "pronto_coleta",
        "em_rota",
        "no_destino",
        "entregue",
        "tentativa_falha",
      ].includes(item.status),
    ).length;
    const openOccurrences = scopedOccurrences.filter(
      (item) => item.status === "aberta" || item.status === "em_analise",
    ).length;

    return { openOrders, incoming, openOccurrences };
  }, [scopedOccurrences, scopedOrders]);

  const todayKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  // Próximas entregas: pedidos com status "ainda vai chegar", ordem por data + código.
  const upcomingDeliveries = useMemo(
    () =>
      scopedOrders
        .filter((item) => incomingDeliveryStatuses.has(item.status))
        .sort((a, b) => {
          if (a.deliveryDateKey !== b.deliveryDateKey) {
            return a.deliveryDateKey.localeCompare(b.deliveryDateKey);
          }
          return a.code.localeCompare(b.code);
        })
        .slice(0, 6),
    [scopedOrders],
  );

  // Donut de status — distribuição dos pedidos do scope nos buckets visíveis.
  const statusDistribution = useMemo(() => {
    const counts: Record<StatusBucket, number> = {
      agendado: 0,
      em_producao: 0,
      em_entrega: 0,
      entregue: 0,
      ocorrencia: 0,
    };
    scopedOrders.forEach((item) => {
      const bucket = bucketOf(item.status);
      if (bucket) counts[bucket] += 1;
    });
    const total = statusBucketOrder.reduce((sum, key) => sum + counts[key], 0);
    return {
      total,
      entries: statusBucketOrder.map((bucket) => ({
        bucket,
        count: counts[bucket],
        percentage: total > 0 ? Number(((counts[bucket] / total) * 100).toFixed(1)) : 0,
      })),
    };
  }, [scopedOrders]);

  const statusDonutStyle = useMemo<CSSProperties>(() => {
    if (statusDistribution.total === 0) {
      return { background: "conic-gradient(var(--muted) 0 100%)" };
    }
    const { segments } = statusDistribution.entries
      .filter((entry) => entry.count > 0)
      .reduce(
        (acc, entry) => {
          const start = acc.cursor;
          const end = start + entry.percentage;
          acc.segments.push(`${statusBucketConfig[entry.bucket].conicColor} ${start}% ${end}%`);
          return { cursor: end, segments: acc.segments };
        },
        { cursor: 0, segments: [] as string[] },
      );
    if (segments.length === 0) {
      return { background: "conic-gradient(var(--muted) 0 100%)" };
    }
    return { background: `conic-gradient(${segments.join(", ")})` };
  }, [statusDistribution]);

  // Sparkline: pedidos por dia de entrega na janela do scope (até 14 pontos).
  const deliveryTrend = useMemo(() => {
    const map = new Map<string, number>();
    scopedOrders.forEach((item) => {
      map.set(item.deliveryDateKey, (map.get(item.deliveryDateKey) ?? 0) + 1);
    });

    let dateKeys: string[];
    if (scope.mode === "day") {
      dateKeys = [scope.date];
    } else if (scope.mode === "range") {
      const dates: string[] = [];
      let cur = scope.startDate;
      while (cur <= scope.endDate) {
        dates.push(cur);
        cur = addDaysToKey(cur, 1);
      }
      dateKeys = dates;
    } else {
      dateKeys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
    }

    // Mantém só os últimos 14 pontos para o sparkline ficar legível.
    if (dateKeys.length > 14) {
      dateKeys = dateKeys.slice(-14);
    }

    return dateKeys.map((dateKey) => ({
      dateKey,
      label: formatShortDate(dateKey),
      count: map.get(dateKey) ?? 0,
    }));
  }, [scope, scopedOrders]);

  const sparklinePath = useMemo(() => {
    if (deliveryTrend.length === 0) return null;
    const maxCount = Math.max(1, ...deliveryTrend.map((p) => p.count));
    const stepX = deliveryTrend.length > 1 ? 100 / (deliveryTrend.length - 1) : 0;
    const points = deliveryTrend.map((point, index) => {
      const x = deliveryTrend.length === 1 ? 50 : index * stepX;
      const y = 28 - (point.count / maxCount) * 24;
      return { x, y, count: point.count, label: point.label };
    });
    const polyline = points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    const area = `${points[0].x.toFixed(2)},28 ${polyline} ${points[points.length - 1].x.toFixed(2)},28`;
    return { points, polyline, area, maxCount };
  }, [deliveryTrend]);

  // "Agora" capturado uma única vez no mount (lazy init é puro do ponto de vista
  // do React e evita Date.now() durante render).
  const [nowMs] = useState(() => Date.now());

  // Ocorrências recentes do escopo, por createdAt desc.
  const recentOccurrences = useMemo(
    () =>
      [...scopedOccurrences]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 4),
    [scopedOccurrences],
  );

  const combinedError = profileError ?? ordersError ?? occurrencesError;
  const isLoading = isProfileLoading || isOrdersLoading || isOccurrencesLoading;
  const firstName = getFirstName(profile?.name);

  return (
    <PageLayout
      title={isProfileLoading ? "Loja" : firstName ? `Olá, ${firstName}` : "Loja"}
      description="Pedidos, recebimentos e ocorrências da sua loja."
      badge="Responsável de Loja"
      breadcrumbs={[{ label: "Início", href: "/" }, { label: "Loja" }]}
    >
      {combinedError ? (
        <div className="rounded-xl border border-danger/35 bg-danger/15 px-4 py-3 text-sm text-danger-foreground">
          {combinedError}
        </div>
      ) : null}

      <OperationalDateScopeCard
        scope={scope}
        summary={summary}
        setMode={setMode}
        setDate={setDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        title="Janela da loja"
        description="Os indicadores seguem o mesmo recorte temporal do módulo de pedidos."
        extraControls={
          shouldShowStoreSelector ? (
            <div className="min-w-[220px] space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Loja</p>
              <Select value={activeStoreId} onValueChange={setActiveStoreId}>
                <SelectTrigger className="w-[220px] bg-background/80">
                  <SelectValue placeholder="Filtrar por loja" />
                </SelectTrigger>
                <SelectContent>
                  {availableStores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : activeStore ? (
            <div className="min-w-[220px] space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Loja</p>
              <span className="flex min-h-10 items-center rounded-md border border-border/70 bg-panel px-3 text-sm text-foreground">
                {activeStore.name}
              </span>
            </div>
          ) : null
        }
      />

      {/* KPIs 5 → 3 (auditoria P2). Sidebar já navega para os módulos;
          ModuleCards removidos (auditoria P1). */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid gap-3 sm:grid-cols-3"
      >
        <KPICard
          title="Pedidos abertos"
          value={isLoading ? "..." : metrics.openOrders}
          tone="info"
          icon={ShoppingCart}
        />
        <KPICard
          title="A receber"
          value={isLoading ? "..." : metrics.incoming}
          tone="success"
          icon={Truck}
        />
        <KPICard
          title="Ocorrências abertas"
          value={isLoading ? "..." : metrics.openOccurrences}
          tone="danger"
          icon={AlertCircle}
        />
      </motion.div>

      {/* Fileira 1: ação imediata (próximas entregas) + insight (composição + tendência).
          Padrão "de-box": panel interno em vez de Card-em-Card. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.18 }}
        className="grid gap-4 xl:grid-cols-[1.4fr_1fr]"
      >
        <section
          aria-labelledby="loja-upcoming-heading"
          className="rounded-2xl border border-border/70 bg-panel/40 p-4 sm:p-5"
        >
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2
                id="loja-upcoming-heading"
                className="font-heading text-[1.05rem] font-semibold leading-tight tracking-[-0.012em]"
              >
                Próximas entregas
              </h2>
              <p className="text-xs text-muted-foreground">
                O que está agendado para chegar nessa janela.
              </p>
            </div>
            <Link
              href="/loja/pedidos"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              Ver todos
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>

          {isOrdersLoading && upcomingDeliveries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
              Carregando entregas...
            </p>
          ) : upcomingDeliveries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhuma entrega prevista para essa janela.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-background/60">
              {upcomingDeliveries.map((order) => {
                const relative = formatRelativeDeliveryLabel(order.deliveryDateKey, todayKey);
                const isToday = order.deliveryDateKey === todayKey;
                return (
                  <li key={order.id}>
                    <Link
                      href={`/loja/pedidos/${order.id}`}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3.5 py-2.5 transition hover:bg-panel/60 focus-visible:bg-panel/60 focus-visible:outline-none"
                    >
                      <div
                        className={`flex w-14 flex-col items-center rounded-lg border px-2 py-1.5 text-center ${
                          isToday
                            ? "border-info/40 bg-info/15 text-info-foreground"
                            : "border-border/60 bg-panel/60 text-foreground"
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                          {relative.split(" ")[0]}
                        </span>
                        <span className="text-sm font-semibold tabular-nums leading-tight">
                          {formatShortDate(order.deliveryDateKey)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{order.code}</p>
                        {shouldShowStoreSelector ? (
                          <p className="truncate text-[11px] text-muted-foreground/80">{order.store}</p>
                        ) : null}
                      </div>
                      <StatusBadge status={order.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="loja-composition-heading"
          className="rounded-2xl border border-border/70 bg-panel/40 p-4 sm:p-5"
        >
          <div className="mb-3">
            <h2
              id="loja-composition-heading"
              className="font-heading text-[1.05rem] font-semibold leading-tight tracking-[-0.012em]"
            >
              Composição dos pedidos
            </h2>
            <p className="text-xs text-muted-foreground">Como estão distribuídos no fluxo.</p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="relative size-32">
              <div
                className="size-full rounded-full border border-border/70"
                style={statusDonutStyle}
                role="img"
                aria-label={`Distribuição de ${statusDistribution.total} pedido(s) por status`}
              />
              <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full border border-border/70 bg-background">
                <p className="text-xl font-semibold tabular-nums text-foreground">
                  {statusDistribution.total}
                </p>
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  Pedidos
                </p>
              </div>
            </div>

            <ul className="grid w-full grid-cols-1 gap-y-1 text-xs">
              {statusDistribution.entries.map((entry) => (
                <li key={entry.bucket} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <span className={`size-2 rounded-full ${statusBucketConfig[entry.bucket].barClassName}`} />
                    <span className="font-medium">{statusBucketConfig[entry.bucket].label}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {entry.count}
                    <span className="ml-1 opacity-70">({entry.percentage}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </motion.div>

      {/* Fileira 2: tendência (sparkline) + ocorrências recentes.
          Sparkline SVG artesanal, mesmo idioma do admin. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.26 }}
        className="grid gap-4 xl:grid-cols-[1.4fr_1fr]"
      >
        <section
          aria-labelledby="loja-trend-heading"
          className="rounded-2xl border border-border/70 bg-panel/40 p-4 sm:p-5"
        >
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2
                id="loja-trend-heading"
                className="font-heading text-[1.05rem] font-semibold leading-tight tracking-[-0.012em]"
              >
                Pedidos por dia
              </h2>
              <p className="text-xs text-muted-foreground">
                Volume diário na janela {scope.mode === "day" ? "selecionada" : "atual"}.
              </p>
            </div>
            {sparklinePath ? (
              <p className="text-xs text-muted-foreground">
                Pico:{" "}
                <span className="font-medium tabular-nums text-foreground">{sparklinePath.maxCount}</span>
              </p>
            ) : null}
          </div>

          {!sparklinePath || deliveryTrend.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
              Sem dados de pedidos para a janela atual.
            </p>
          ) : (
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <svg
                viewBox="0 0 100 30"
                preserveAspectRatio="none"
                className="h-24 w-full"
                role="img"
                aria-label={`Tendência de pedidos: ${deliveryTrend
                  .map((p) => `${p.label} ${p.count}`)
                  .join(", ")}`}
              >
                <polygon
                  points={sparklinePath.area}
                  fill="oklch(0.84 0.06 238 / 0.18)"
                />
                <polyline
                  points={sparklinePath.polyline}
                  fill="none"
                  stroke="oklch(0.6 0.14 238)"
                  strokeWidth={0.9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                {sparklinePath.points.map((point) => (
                  <circle
                    key={point.label}
                    cx={point.x}
                    cy={point.y}
                    r={0.9}
                    fill="oklch(0.6 0.14 238)"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{deliveryTrend[0]?.label}</span>
                {deliveryTrend.length > 2 ? (
                  <span>{deliveryTrend[Math.floor(deliveryTrend.length / 2)]?.label}</span>
                ) : null}
                <span>{deliveryTrend[deliveryTrend.length - 1]?.label}</span>
              </div>
            </div>
          )}
        </section>

        <section
          aria-labelledby="loja-occurrences-heading"
          className="rounded-2xl border border-border/70 bg-panel/40 p-4 sm:p-5"
        >
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2
                id="loja-occurrences-heading"
                className="font-heading text-[1.05rem] font-semibold leading-tight tracking-[-0.012em]"
              >
                Ocorrências recentes
              </h2>
              <p className="text-xs text-muted-foreground">Últimos registros da sua loja.</p>
            </div>
            <Link
              href="/loja/ocorrencias"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              Ver todas
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>

          {isOccurrencesLoading && recentOccurrences.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
              Carregando ocorrências...
            </p>
          ) : recentOccurrences.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhuma ocorrência registrada.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-background/60">
              {recentOccurrences.map((occurrence) => (
                <li
                  key={occurrence.id}
                  className="flex items-start justify-between gap-3 px-3.5 py-2.5"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-medium text-foreground">
                      {occurrence.productName}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground/80">
                      {occurrence.problemType}
                      <span className="mx-1.5 opacity-60">·</span>
                      <span className="tabular-nums">{occurrence.orderCode}</span>
                      <span className="mx-1.5 opacity-60">·</span>
                      <span>há {formatRelativeAge(occurrence.createdAt, nowMs)}</span>
                    </p>
                  </div>
                  <StatusBadge status={occurrence.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </motion.div>
    </PageLayout>
  );
}
