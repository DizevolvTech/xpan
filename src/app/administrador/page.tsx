"use client";

import { motion } from "framer-motion";
import { useMemo, type CSSProperties } from "react";
import {
  Factory,
  Package,
  ShoppingCart,
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
          <KPICard title="Pedidos Totais" value={totalOrders} icon={ShoppingCart} tone="info" />
          <KPICard title="OPs em Progresso" value={opsInProgress} icon={Factory} tone="warning" />
          <KPICard
            title="Entregas em Campo"
            value={deliverySummary.inField}
            subtitle={`${deliverySummary.delivered} concluídas`}
            icon={Package}
            tone={deliverySummary.inField > 0 ? "info" : "neutral"}
          />
        </div>
        <p className="px-1 text-xs text-muted-foreground">
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
        <CardContent>
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
