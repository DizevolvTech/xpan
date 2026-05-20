"use client";

import { motion } from "framer-motion";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import {
  Factory,
  Minus,
  Package,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { InfoHint } from "@/components/shared/info-hint";
import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { PaginatedSection } from "@/components/shared/paginated-section";
import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeliveryExecution } from "@/lib/delivery-execution";
import { filterFactoryPlanningDataByOperationalScope } from "@/lib/operational-date-scope";
import { formatKgLabel, formatKgValue } from "@/lib/utils";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";

const dashboardStatuses = ["em_espera", "agendado", "em_producao", "aguardando_expedicao"] as const;
type DashboardStatus = (typeof dashboardStatuses)[number];

const statusConfig: Record<DashboardStatus, { label: string; barClassName: string; conicColor: string }> = {
  em_espera: {
    label: "Em Espera",
    barClassName: "bg-warning",
    conicColor: "oklch(0.89 0.09 90)",
  },
  agendado: {
    label: "Agendado",
    barClassName: "bg-info",
    conicColor: "oklch(0.84 0.06 238)",
  },
  em_producao: {
    label: "Em Produção",
    barClassName: "bg-success",
    conicColor: "oklch(0.86 0.07 148)",
  },
  aguardando_expedicao: {
    label: "Aguardando Expedição",
    barClassName: "bg-secondary",
    conicColor: "oklch(0.83 0.03 250)",
  },
};

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${dateKey}T00:00:00`));
}

function buildDateRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  let current = startDate;

  while (current <= endDate) {
    dates.push(current);
    current = addDays(current, 1);
  }

  return dates;
}

export default function AdministradorPage() {
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const { planningData: planningSnapshot } = useFactoryPlanningSnapshot(anchorDate);
  const planningData = useMemo(
    () => filterFactoryPlanningDataByOperationalScope(planningSnapshot, scope),
    [planningSnapshot, scope],
  );
  const deliveryExecution = useDeliveryExecution();
  const { snapshot } = useMasterDataSnapshot();

  const activeLineCapacityByName = useMemo(
    () =>
      new Map(
        snapshot.lines
          .filter((line) => line.status === "ativo")
          .map((line) => [line.name, line.capacityPerDayKg]),
      ),
    [snapshot.lines],
  );

  const productionKg = useMemo(
    () => Number(planningData.productionOrders.reduce((sum, op) => sum + op.totalKg, 0).toFixed(2)),
    [planningData.productionOrders],
  );

  const expeditionKg = useMemo(
    () => Number(planningData.expedition.reduce((sum, row) => sum + row.totalKg, 0).toFixed(2)),
    [planningData.expedition],
  );

  const ordersByStatus = useMemo(() => {
    const summary: Record<DashboardStatus, number> = {
      em_espera: 0,
      agendado: 0,
      em_producao: 0,
      aguardando_expedicao: 0,
    };

    planningData.orders.forEach((order) => {
      if (order.status in summary) {
        summary[order.status as DashboardStatus] += 1;
      }
    });

    return summary;
  }, [planningData.orders]);

  const deliverySummary = useMemo(() => {
    return planningData.expedition.reduce(
      (summary, row) => {
        const execution = deliveryExecution.resolveExecution(row.orderId, row.status === "aguardando_expedicao");

        if (execution.status === "pronto_coleta") {
          summary.ready += 1;
          return summary;
        }

        if (execution.status === "em_rota" || execution.status === "no_destino") {
          summary.inField += 1;
          return summary;
        }

        if (execution.status === "entregue") {
          summary.delivered += 1;
          return summary;
        }

        if (execution.status === "tentativa_falha") {
          summary.failed += 1;
        }

        return summary;
      },
      { ready: 0, inField: 0, delivered: 0, failed: 0 },
    );
  }, [deliveryExecution, planningData.expedition]);

  const noScheduleItems = useMemo(
    () => planningData.orderItems.filter((item) => !item.canPlan).length,
    [planningData.orderItems],
  );

  const delayedItems = useMemo(
    () => planningData.orderItems.filter((item) => item.delayed).length,
    [planningData.orderItems],
  );

  const criticalOps = useMemo(
    () =>
      planningData.productionOrders.filter((op) => {
        const lineCapacity = activeLineCapacityByName.get(op.lineName) ?? 0;
        return lineCapacity > 0 && (op.totalKg / lineCapacity) * 100 >= 100;
      }).length,
    [activeLineCapacityByName, planningData.productionOrders],
  );

  const sectorSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        ops: number;
        totalKg: number;
        utilizationSum: number;
        utilizationCount: number;
        criticalOps: number;
      }
    >();

    planningData.productionOrders.forEach((op) => {
      if (!map.has(op.sectorName)) {
        map.set(op.sectorName, {
          ops: 0,
          totalKg: 0,
          utilizationSum: 0,
          utilizationCount: 0,
          criticalOps: 0,
        });
      }

      const sector = map.get(op.sectorName);
      if (!sector) {
        return;
      }

      const lineCapacity = activeLineCapacityByName.get(op.lineName) ?? 0;
      const utilization = lineCapacity > 0 ? (op.totalKg / lineCapacity) * 100 : 0;

      sector.ops += 1;
      sector.totalKg += op.totalKg;
      if (lineCapacity > 0) {
        sector.utilizationSum += utilization;
        sector.utilizationCount += 1;
      }
      if (utilization >= 100) {
        sector.criticalOps += 1;
      }
    });

    return Array.from(map.entries())
      .map(([sectorName, data]) => ({
        sectorName,
        ops: data.ops,
        totalKg: Number(data.totalKg.toFixed(2)),
        averageUtilization:
          data.utilizationCount > 0
            ? Number((data.utilizationSum / data.utilizationCount).toFixed(1))
            : 0,
        criticalOps: data.criticalOps,
      }))
      .sort((a, b) => b.totalKg - a.totalKg);
  }, [activeLineCapacityByName, planningData.productionOrders]);

  const operationalAlerts = [
    {
      key: "sem-agenda",
      label: "Itens sem agenda de produção",
      value: noScheduleItems,
      tone: noScheduleItems > 0 ? "warning" : "ok",
    },
    {
      key: "atrasos",
      label: "Itens com atraso de planejamento",
      value: delayedItems,
      tone: delayedItems > 0 ? "warning" : "ok",
    },
    {
      key: "ops-criticas",
      label: "OPs acima da capacidade da linha",
      value: criticalOps,
      tone: criticalOps > 0 ? "danger" : "ok",
    },
  ] as const;

  const totalOrders = planningData.orders.length;
  const releasedOrders = planningData.orders.filter((order) => order.releasedToProduction).length;
  const opsInProgress = planningData.productionOrders.filter((op) => op.status === "em_producao").length;
  const readyForExpedition = planningData.expedition.filter((order) => order.status === "aguardando_expedicao").length;
  const statusDistribution = useMemo(
    () =>
      dashboardStatuses.map((status) => {
        const count = ordersByStatus[status];
        const percentage = totalOrders > 0 ? Number(((count / totalOrders) * 100).toFixed(1)) : 0;
        return {
          status,
          label: statusConfig[status].label,
          count,
          percentage,
        };
      }),
    [ordersByStatus, totalOrders],
  );

  const statusDonutStyle = useMemo<CSSProperties>(() => {
    if (totalOrders === 0) {
      return { background: "conic-gradient(var(--muted) 0 100%)" };
    }

    const { segments } = statusDistribution
      .filter((entry) => entry.count > 0)
      .reduce(
        (acc, entry) => {
          const start = acc.cursor;
          const end = start + entry.percentage;
          acc.segments.push(`${statusConfig[entry.status].conicColor} ${start}% ${end}%`);
          return {
            cursor: end,
            segments: acc.segments,
          };
        },
        { cursor: 0, segments: [] as string[] },
      );

    if (segments.length === 0) {
      return { background: "conic-gradient(var(--muted) 0 100%)" };
    }

    return {
      background: `conic-gradient(${segments.join(", ")})`,
    };
  }, [statusDistribution, totalOrders]);

  const loadTrend = useMemo(() => {
    const pointMap = new Map<
      string,
      { productionKg: number; expeditionKg: number; totalOrders: number }
    >();

    planningData.productionOrders.forEach((op) => {
      const current = pointMap.get(op.productionDate) ?? {
        productionKg: 0,
        expeditionKg: 0,
        totalOrders: 0,
      };
      current.productionKg = Number((current.productionKg + op.totalKg).toFixed(2));
      pointMap.set(op.productionDate, current);
    });

    planningData.expedition.forEach((row) => {
      const current = pointMap.get(row.deliveryDate) ?? {
        productionKg: 0,
        expeditionKg: 0,
        totalOrders: 0,
      };
      current.expeditionKg = Number((current.expeditionKg + row.totalKg).toFixed(2));
      pointMap.set(row.deliveryDate, current);
    });

    planningData.orders.forEach((order) => {
      const current = pointMap.get(order.deliveryDate) ?? {
        productionKg: 0,
        expeditionKg: 0,
        totalOrders: 0,
      };
      current.totalOrders += 1;
      pointMap.set(order.deliveryDate, current);
    });

    const dateKeys =
      scope.mode === "all"
        ? Array.from(pointMap.keys()).sort((a, b) => a.localeCompare(b)).slice(-7)
        : scope.mode === "day"
          ? [scope.date]
          : buildDateRange(scope.startDate, scope.endDate);

    return dateKeys.map((dateKey) => {
      const point = pointMap.get(dateKey) ?? {
        productionKg: 0,
        expeditionKg: 0,
        totalOrders: 0,
      };

      return {
        dateKey,
        label: formatShortDate(dateKey),
        productionKg: point.productionKg,
        expeditionKg: point.expeditionKg,
        totalOrders: point.totalOrders,
      };
    });
  }, [planningData.expedition, planningData.orders, planningData.productionOrders, scope]);

  const trendMaxKg = useMemo(
    () =>
      Math.max(
        1,
        ...loadTrend.map((point) => Math.max(point.productionKg, point.expeditionKg)),
      ),
    [loadTrend],
  );

  // Séries diárias completas para sparklines/deltas dos KPIs primários.
  // Cobertura: snapshot inteiro (não restrito ao scope), para gerar
  // janela atual de 7d + janela anterior de 7d e calcular delta %.
  const dailyKpiSeries = useMemo(() => {
    type DailyPoint = { ordersCount: number; opsInProgress: number; deliveriesInField: number };
    const map = new Map<string, DailyPoint>();

    const ensure = (key: string): DailyPoint => {
      const existing = map.get(key);
      if (existing) return existing;
      const created: DailyPoint = { ordersCount: 0, opsInProgress: 0, deliveriesInField: 0 };
      map.set(key, created);
      return created;
    };

    planningSnapshot.orders.forEach((order) => {
      ensure(order.deliveryDate).ordersCount += 1;
    });
    planningSnapshot.productionOrders.forEach((op) => {
      if (op.status === "em_producao") {
        ensure(op.productionDate).opsInProgress += 1;
      }
    });
    planningSnapshot.expedition.forEach((row) => {
      const execution = deliveryExecution.resolveExecution(
        row.orderId,
        row.status === "aguardando_expedicao",
      );
      if (execution.status === "em_rota" || execution.status === "no_destino") {
        ensure(row.deliveryDate).deliveriesInField += 1;
      }
    });

    const dateKeys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
    return dateKeys.map((dateKey) => ({ dateKey, ...ensure(dateKey) }));
  }, [planningSnapshot, deliveryExecution]);

  // Janelas: últimos 7d ativos vs 7d ativos anteriores. Usamos os
  // pontos com dado (sem 0-pad de calendário) para evitar deltas
  // distorcidos por lacunas.
  const kpiDeltas = useMemo(() => {
    const series = dailyKpiSeries;
    const current = series.slice(-7);
    const previous = series.slice(-14, -7);

    const sum = (rows: typeof series, key: "ordersCount" | "opsInProgress" | "deliveriesInField") =>
      rows.reduce((acc, row) => acc + row[key], 0);

    const buildDelta = (key: "ordersCount" | "opsInProgress" | "deliveriesInField") => {
      const cur = sum(current, key);
      const prev = sum(previous, key);
      if (prev === 0 && cur === 0) return { pct: 0, direction: "flat" as const, hasData: false };
      if (prev === 0) return { pct: 100, direction: "up" as const, hasData: true };
      const pct = Number((((cur - prev) / prev) * 100).toFixed(0));
      const direction = pct > 0 ? ("up" as const) : pct < 0 ? ("down" as const) : ("flat" as const);
      return { pct, direction, hasData: true };
    };

    const buildSparkPoints = (key: "ordersCount" | "opsInProgress" | "deliveriesInField") => {
      if (current.length === 0) return "";
      const values = current.map((row) => row[key]);
      const max = Math.max(1, ...values);
      const step = current.length > 1 ? 100 / (current.length - 1) : 100;
      return values
        .map((value, index) => {
          const x = (index * step).toFixed(2);
          // Inverte eixo Y (SVG cresce p/ baixo). Margem 2px topo/baixo.
          const y = (26 - (value / max) * 22).toFixed(2);
          return `${x},${y}`;
        })
        .join(" ");
    };

    return {
      orders: { ...buildDelta("ordersCount"), points: buildSparkPoints("ordersCount") },
      ops: { ...buildDelta("opsInProgress"), points: buildSparkPoints("opsInProgress") },
      deliveries: {
        ...buildDelta("deliveriesInField"),
        points: buildSparkPoints("deliveriesInField"),
      },
    };
  }, [dailyKpiSeries]);

  // Top 5 categorias por carga (sectorSummary já vem ordenado desc).
  const topCategories = useMemo(() => {
    const top = sectorSummary.slice(0, 5);
    const maxKg = top.reduce((acc, sector) => Math.max(acc, sector.totalKg), 0);
    const totalKg = sectorSummary.reduce((acc, sector) => acc + sector.totalKg, 0);
    return {
      rows: top.map((sector) => ({
        ...sector,
        widthPct: maxKg > 0 ? Number(((sector.totalKg / maxKg) * 100).toFixed(1)) : 0,
        sharePct: totalKg > 0 ? Number(((sector.totalKg / totalKg) * 100).toFixed(1)) : 0,
      })),
      totalKg,
    };
  }, [sectorSummary]);

  return (
    <PageLayout
      title="Administrador"
      description="Operação da fábrica e administração de acessos."
      badge="Governança"
      breadcrumbs={[{ label: "Início", href: "/" }, { label: "Administrador" }]}
    >
      <OperationalDateScopeCard
        scope={scope}
        summary={summary}
        setMode={setMode}
        setDate={setDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        title="Janela"
        description=""
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="space-y-2"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <KpiWithTrend
            tone="info"
            stroke="var(--info)"
            delta={kpiDeltas.orders}
            ariaLabel="Tendência de pedidos nos últimos 7 dias"
          >
            <KPICard title="Pedidos Totais" value={totalOrders} icon={ShoppingCart} tone="info" />
          </KpiWithTrend>
          <KpiWithTrend
            tone="warning"
            stroke="var(--warning)"
            delta={kpiDeltas.ops}
            ariaLabel="Tendência de OPs em progresso nos últimos 7 dias"
          >
            <KPICard title="OPs em Progresso" value={opsInProgress} icon={Factory} tone="warning" />
          </KpiWithTrend>
          <KpiWithTrend
            tone={deliverySummary.inField > 0 ? "info" : "neutral"}
            stroke={deliverySummary.inField > 0 ? "var(--info)" : "var(--muted-foreground)"}
            delta={kpiDeltas.deliveries}
            ariaLabel="Tendência de entregas em campo nos últimos 7 dias"
          >
            <KPICard
              title="Entregas em Campo"
              value={deliverySummary.inField}
              subtitle={`${deliverySummary.delivered} concluídas`}
              icon={Package}
              tone={deliverySummary.inField > 0 ? "info" : "neutral"}
            />
          </KpiWithTrend>
        </div>
        <p className="mt-1 px-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Liberados:</span> {releasedOrders}
          <span className="mx-2 opacity-50">·</span>
          <span className="font-medium text-foreground">Carga:</span> {formatKgLabel(productionKg, { maximumFractionDigits: 2 })}
          <span className="mx-2 opacity-50">·</span>
          <span className="font-medium text-foreground">Prontos p/ expedição:</span> {readyForExpedition}
          {expeditionKg > 0 ? ` (${formatKgLabel(expeditionKg, { maximumFractionDigits: 2 })})` : ""}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.18 }}
        className="grid gap-4 xl:grid-cols-[1.3fr_1fr]"
      >
        <Card>
          <CardHeader>
            <CardTitle>
              {scope.mode === "all"
                ? "Tendência de Carga (últimos 7 dias ativos)"
                : scope.mode === "day"
                  ? "Tendência de Carga (dia selecionado)"
                  : `Tendência de Carga (${loadTrend.length} dias)`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/70 bg-panel/45 p-4">
              <div
                className="grid h-52 items-end gap-3"
                style={{ gridTemplateColumns: `repeat(${Math.max(loadTrend.length, 1)}, minmax(0, 1fr))` }}
              >
                {loadTrend.map((point) => {
                  const productionHeight =
                    point.productionKg > 0
                      ? Math.max((point.productionKg / trendMaxKg) * 100, 4)
                      : 0;
                  const expeditionHeight =
                    point.expeditionKg > 0
                      ? Math.max((point.expeditionKg / trendMaxKg) * 100, 4)
                      : 0;
                  const isReference = point.dateKey === anchorDate;

                  return (
                    <div key={point.dateKey} className="flex flex-col items-center gap-2">
                      <div className="flex h-40 items-end gap-1.5">
                        <div
                          className="w-3 rounded-t-md bg-info"
                          style={{ height: `${Math.min(productionHeight, 100)}%` }}
                          title={`Produção: ${formatKgLabel(point.productionKg, { maximumFractionDigits: 2 })}`}
                        />
                        <div
                          className="w-3 rounded-t-md bg-success"
                          style={{ height: `${Math.min(expeditionHeight, 100)}%` }}
                          title={`Expedição: ${formatKgLabel(point.expeditionKg, { maximumFractionDigits: 2 })}`}
                        />
                      </div>
                      <div className="space-y-0.5 text-center">
                        <p
                          className={`text-[11px] font-semibold ${
                            isReference ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {point.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{point.totalOrders} ped.</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-4 px-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-info" /> Produção
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-success" /> Expedição
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              Composição Fabril e Entrega
              <InfoHint size="sm" content="Indicadores consolidados com fluxo fabril separado da execução de entrega." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="relative size-40">
                <div className="size-full rounded-full border border-border/70" style={statusDonutStyle} />
                <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full border border-border/70 bg-card">
                  <p className="text-xl font-semibold text-foreground">{totalOrders}</p>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    Pedidos
                  </p>
                </div>
              </div>

              <ul className="grid w-full grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {statusDistribution.map((entry) => (
                  <li key={entry.status} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <span className={`size-2 rounded-full ${statusConfig[entry.status].barClassName}`} />
                      <span className="font-medium">{entry.label}</span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {entry.count}
                      <span className="ml-1 opacity-70">({entry.percentage}%)</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-border/70 pt-3">
              <ul className="space-y-1.5">
                {operationalAlerts.map((alert) => (
                  <li key={alert.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground">{alert.label}</span>
                    <span
                      className={`inline-flex min-w-10 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                        alert.tone === "danger"
                          ? "bg-danger/40 text-danger-foreground"
                          : alert.tone === "warning"
                            ? "bg-warning/40 text-warning-foreground"
                            : "bg-success/35 text-success-foreground"
                      }`}
                    >
                      {alert.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle>Carga por Categoria da Fábrica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {topCategories.rows.length > 0 && (
            <div className="rounded-lg border border-border/[var(--opacity-divider)] bg-panel/45 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Top categorias por carga
                </p>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  Total {formatKgLabel(topCategories.totalKg, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <ol className="space-y-1.5">
                {topCategories.rows.map((sector, index) => (
                  <li
                    key={sector.sectorName}
                    className="grid grid-cols-[1.25rem_minmax(7rem,11rem)_1fr_auto] items-center gap-2.5 text-xs"
                  >
                    <span className="tabular-nums text-muted-foreground">{index + 1}.</span>
                    <span
                      className="truncate font-medium text-foreground"
                      title={sector.sectorName}
                    >
                      {sector.sectorName}
                    </span>
                    <span
                      className="h-1.5 w-full overflow-hidden rounded-full bg-panel/70"
                      role="presentation"
                    >
                      <span
                        className={`block h-full rounded-full ${
                          sector.criticalOps > 0 ? "bg-danger" : "bg-info"
                        }`}
                        style={{ width: `${Math.max(sector.widthPct, 4)}%` }}
                      />
                    </span>
                    <span className="inline-flex items-baseline gap-1.5 tabular-nums">
                      <span className="font-semibold text-foreground">
                        {formatKgValue(sector.totalKg)}
                      </span>
                      <span className="text-[10.5px] text-muted-foreground">
                        {sector.sharePct}%
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <PaginatedSection items={sectorSummary} label="categorias" initialPageSize={6}>
            {(paginatedSectors) => (
              <div className="overflow-x-auto rounded-xl border border-border/75">
                <table className="w-full min-w-[680px] border-collapse">
                  <thead className="bg-panel">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Categoria</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">OPs</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Carga (Kg)</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Utilização média</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">OPs críticas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSectors.map((sector) => (
                      <tr key={sector.sectorName}>
                        <td className="border-t border-border/70 bg-card px-3 py-2 text-sm font-medium text-foreground">
                          {sector.sectorName}
                        </td>
                        <td className="border-t border-border/70 bg-card px-3 py-2 text-sm text-foreground">
                          {sector.ops}
                        </td>
                        <td className="border-t border-border/70 bg-card px-3 py-2 text-sm text-foreground">
                          {formatKgValue(sector.totalKg)}
                        </td>
                        <td className="border-t border-border/70 bg-card px-3 py-2 text-sm text-foreground">
                          {sector.averageUtilization}%
                        </td>
                        <td className="border-t border-border/70 bg-card px-3 py-2 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              sector.criticalOps > 0
                                ? "bg-danger/40 text-danger-foreground"
                                : "bg-success/35 text-success-foreground"
                            }`}
                          >
                            {sector.criticalOps}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PaginatedSection>
        </CardContent>
      </Card>

    </PageLayout>
  );
}

type KpiDelta = {
  pct: number;
  direction: "up" | "down" | "flat";
  hasData: boolean;
  points: string;
};

type KpiTrendTone = "neutral" | "info" | "success" | "warning" | "danger";

const trendToneText: Record<KpiTrendTone, string> = {
  neutral: "text-muted-foreground",
  info: "text-[var(--kpi-trend-info)]",
  success: "text-[var(--kpi-trend-success)]",
  warning: "text-[var(--kpi-trend-warning)]",
  danger: "text-[var(--kpi-trend-danger)]",
};

function KpiWithTrend({
  children,
  delta,
  stroke,
  tone,
  ariaLabel,
}: {
  children: ReactNode;
  delta: KpiDelta;
  stroke: string;
  tone: KpiTrendTone;
  ariaLabel: string;
}) {
  const hasSparkline = delta.points.length > 0;
  const deltaToneText =
    delta.direction === "up"
      ? "text-success"
      : delta.direction === "down"
        ? "text-danger"
        : "text-muted-foreground";
  const DeltaIcon =
    delta.direction === "up" ? TrendingUp : delta.direction === "down" ? TrendingDown : Minus;
  const deltaLabel = delta.hasData
    ? `${delta.direction === "down" ? "" : delta.direction === "up" ? "+" : ""}${delta.pct}%`
    : "—";

  return (
    <div className="flex flex-col gap-1.5">
      {children}
      <div className="flex items-center justify-between gap-3 px-1">
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${deltaToneText}`}
          title="Comparado aos 7 dias anteriores"
        >
          <DeltaIcon className="size-3" aria-hidden />
          <span>{deltaLabel}</span>
          <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">vs 7d ant.</span>
        </span>
        {hasSparkline && (
          <svg
            viewBox="0 0 100 28"
            preserveAspectRatio="none"
            role="img"
            aria-label={ariaLabel}
            className={`h-5 w-24 shrink-0 ${trendToneText[tone]}`}
          >
            <polyline
              points={delta.points}
              fill="none"
              stroke={stroke}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
