"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  Factory,
  LayoutDashboard,
  LucideIcon,
  Package,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  Users,
} from "lucide-react";

import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { ModuleCard, type ModuleTone } from "@/components/shared/module-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { applyFactoryOrderStatus, useFactoryOrderStatus } from "@/lib/factory-order-status";
import { buildFactoryPlanningData, getTodayDateKey, type OrderStatus } from "@/lib/order-planning";
import { productionLines } from "@/lib/production-planning";

type QuickAccessModule = {
  href: string;
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  tone: ModuleTone;
};

const quickAccessGroups: Array<{ label: string; modules: QuickAccessModule[] }> = [
  {
    label: "Administração",
    modules: [
      {
        href: "/administrador",
        title: "Dashboard Executivo",
        subtitle: "Visão completa da fábrica",
        description: "Acompanhe indicadores de produção, expedição e gargalos em uma única visão.",
        icon: LayoutDashboard,
        tone: "slate",
      },
      {
        href: "/administrador/usuarios",
        title: "Gestão de Usuários",
        subtitle: "Delegação de acessos",
        description: "Gerencie perfis, ativações e permissões por módulo e tipo de usuário.",
        icon: ShieldCheck,
        tone: "blue",
      },
    ],
  },
  {
    label: "Gestor de Dados",
    modules: [
      {
        href: "/gestor-dados",
        title: "Visão Geral de Dados",
        subtitle: "Dados mestres",
        description: "Acesso ao painel de engenharia com status de cadastros principais.",
        icon: LayoutDashboard,
        tone: "cyan",
      },
      {
        href: "/gestor-dados/produtos",
        title: "Produtos",
        subtitle: "Cadastro e revisão",
        description: "Atualize estrutura de itens, unidades e fatores utilizados na operação.",
        icon: Package,
        tone: "emerald",
      },
      {
        href: "/gestor-dados/setores",
        title: "Setores",
        subtitle: "Responsáveis e estrutura",
        description: "Defina setores produtivos e lideranças que suportam a fábrica.",
        icon: Users,
        tone: "violet",
      },
    ],
  },
  {
    label: "Gestor de Fábrica",
    modules: [
      {
        href: "/gestor-fabrica/pedidos",
        title: "Pedidos de Fábrica",
        subtitle: "Demanda consolidada",
        description: "Controle todos os pedidos e seus estados para produção e entrega.",
        icon: ShoppingCart,
        tone: "violet",
      },
      {
        href: "/gestor-fabrica/ordens-producao",
        title: "Ordens de Produção",
        subtitle: "Planejamento por linha",
        description: "Monitore OPs por setor, linha e capacidade diária utilizada.",
        icon: Factory,
        tone: "amber",
      },
      {
        href: "/gestor-fabrica/expedicao",
        title: "Expedição",
        subtitle: "Separação por pedido",
        description: "Acompanhe reconversão e separação para envio às lojas.",
        icon: Truck,
        tone: "emerald",
      },
    ],
  },
  {
    label: "Chão de Fábrica e Loja",
    modules: [
      {
        href: "/chao-fabrica/ordens-producao",
        title: "Execução da Produção",
        subtitle: "Chão de fábrica",
        description: "Visão operacional do time de execução com foco em OPs do dia.",
        icon: Factory,
        tone: "amber",
      },
      {
        href: "/chao-fabrica/expedicao",
        title: "Execução da Expedição",
        subtitle: "Chão de fábrica",
        description: "Acompanhamento do que precisa ser separado e despachado.",
        icon: Truck,
        tone: "emerald",
      },
      {
        href: "/loja/pedidos",
        title: "Pedidos de Loja",
        subtitle: "Ponto de venda",
        description: "Consulte a experiência da loja em pedidos, prazos e ocorrências.",
        icon: Store,
        tone: "rose",
      },
    ],
  },
];

const statusLabels: Record<OrderStatus, string> = {
  agendado: "Agendado",
  em_producao: "Em Produção",
  em_espera: "Em Espera",
  rota_entrega: "Rota de Entrega",
};

const statusBars: Record<OrderStatus, string> = {
  agendado: "bg-info",
  em_producao: "bg-success",
  em_espera: "bg-warning",
  rota_entrega: "bg-[oklch(0.62_0.08_220)]",
};

const statusConicColors: Record<OrderStatus, string> = {
  agendado: "oklch(0.84 0.06 238)",
  em_producao: "oklch(0.86 0.07 148)",
  em_espera: "oklch(0.89 0.09 90)",
  rota_entrega: "oklch(0.62 0.08 220)",
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

function formatCompactValue(value: number, unit?: string) {
  const compactValue = new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);

  return unit ? `${compactValue} ${unit}` : compactValue;
}

function isValidDateKey(value: string) {
  return DATE_KEY_PATTERN.test(value);
}

function getInitialReferenceDate() {
  const today = getTodayDateKey();
  if (typeof window === "undefined") {
    return today;
  }

  const refFromQuery = new URLSearchParams(window.location.search).get("ref");
  return refFromQuery && isValidDateKey(refFromQuery) ? refFromQuery : today;
}

export default function AdministradorPage() {
  const [referenceDate, setReferenceDate] = useState(getInitialReferenceDate);

  function handleReferenceDateChange(nextDate: string) {
    if (!isValidDateKey(nextDate) || nextDate === referenceDate) {
      return;
    }

    setReferenceDate(nextDate);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("ref", nextDate);
      window.history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}`);
    }
  }

  const statusState = useFactoryOrderStatus(referenceDate);

  const basePlanningData = useMemo(() => buildFactoryPlanningData(referenceDate), [referenceDate]);
  const planningData = useMemo(
    () => applyFactoryOrderStatus(basePlanningData, statusState.resolveStatus),
    [basePlanningData, statusState.resolveStatus],
  );

  const activeLineCapacityByName = useMemo(
    () =>
      new Map(
        productionLines
          .filter((line) => line.status === "ativo")
          .map((line) => [line.name, line.capacityPerDayKg]),
      ),
    [],
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
    const summary: Record<OrderStatus, number> = {
      agendado: 0,
      em_producao: 0,
      em_espera: 0,
      rota_entrega: 0,
    };

    planningData.orders.forEach((order) => {
      summary[order.status] += 1;
    });

    return summary;
  }, [planningData.orders]);

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
  const readyForExpedition = planningData.expedition.filter(
    (order) => order.status === "em_producao" || order.status === "rota_entrega",
  ).length;
  const operationalAlertsTotal = noScheduleItems + delayedItems + criticalOps;
  const statusDistribution = useMemo(
    () =>
      (Object.keys(statusLabels) as OrderStatus[]).map((status) => {
        const count = ordersByStatus[status];
        const percentage = totalOrders > 0 ? Number(((count / totalOrders) * 100).toFixed(1)) : 0;
        return {
          status,
          label: statusLabels[status],
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

    let cursor = 0;
    const segments = statusDistribution
      .filter((entry) => entry.count > 0)
      .map((entry) => {
        const start = cursor;
        cursor += entry.percentage;
        return `${statusConicColors[entry.status]} ${start}% ${cursor}%`;
      });

    if (segments.length === 0) {
      return { background: "conic-gradient(var(--muted) 0 100%)" };
    }

    return {
      background: `conic-gradient(${segments.join(", ")})`,
    };
  }, [statusDistribution, totalOrders]);

  const loadTrend = useMemo(() => {
    const dayOffsets = [-3, -2, -1, 0, 1, 2, 3];
    return dayOffsets.map((offset) => {
      const dateKey = addDays(referenceDate, offset);
      const dayPlanning = buildFactoryPlanningData(dateKey);
      const dayProductionKg = Number(
        dayPlanning.productionOrders.reduce((sum, op) => sum + op.totalKg, 0).toFixed(2),
      );
      const dayExpeditionKg = Number(
        dayPlanning.expedition.reduce((sum, expeditionRow) => sum + expeditionRow.totalKg, 0).toFixed(2),
      );

      return {
        dateKey,
        label: formatShortDate(dateKey),
        productionKg: dayProductionKg,
        expeditionKg: dayExpeditionKg,
        totalOrders: dayPlanning.orders.length,
      };
    });
  }, [referenceDate]);

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
      description="Painel central para acompanhar operação da fábrica e administrar acessos do sistema."
      badge="Governança"
      breadcrumbs={[{ label: "Início", href: "/" }, { label: "Administrador" }]}
    >
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Referência Operacional</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Data de referência
            </span>
            <input
              type="date"
              value={referenceDate}
              onChange={(event) => handleReferenceDateChange(event.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground"
            />
          </div>
        </CardHeader>
      </Card>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
      >
        <KPICard title="Pedidos Totais" value={totalOrders} icon={ShoppingCart} tone="info" />
        <KPICard title="Em Produção" value={ordersByStatus.em_producao} icon={Factory} tone="success" />
        <KPICard title="Em Espera" value={ordersByStatus.em_espera} icon={Package} tone="warning" />
        <KPICard
          title="Carga Produção"
          value={formatCompactValue(productionKg, "Kg")}
          subtitle={`${productionKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} Kg`}
          icon={Factory}
          tone="neutral"
        />
        <KPICard
          title="Carga Expedição"
          value={formatCompactValue(expeditionKg, "Kg")}
          subtitle={`${expeditionKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} Kg`}
          icon={Truck}
          tone="success"
        />
        <KPICard
          title="Alertas Operacionais"
          value={operationalAlertsTotal}
          icon={AlertTriangle}
          tone={operationalAlertsTotal > 0 ? "danger" : "success"}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.18 }}
        className="grid gap-4 xl:grid-cols-[1.3fr_1fr]"
      >
        <Card>
          <CardHeader>
            <CardTitle>Tendência de Carga (7 dias)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/70 bg-panel/45 p-4">
              <div className="grid h-52 grid-cols-7 items-end gap-3">
                {loadTrend.map((point) => {
                  const productionHeight =
                    point.productionKg > 0
                      ? Math.max((point.productionKg / trendMaxKg) * 100, 4)
                      : 0;
                  const expeditionHeight =
                    point.expeditionKg > 0
                      ? Math.max((point.expeditionKg / trendMaxKg) * 100, 4)
                      : 0;
                  const isReference = point.dateKey === referenceDate;

                  return (
                    <div key={point.dateKey} className="flex flex-col items-center gap-2">
                      <div className="flex h-40 items-end gap-1.5">
                        <div
                          className="w-3 rounded-t-md bg-info"
                          style={{ height: `${Math.min(productionHeight, 100)}%` }}
                          title={`Produção: ${point.productionKg} Kg`}
                        />
                        <div
                          className="w-3 rounded-t-md bg-success"
                          style={{ height: `${Math.min(expeditionHeight, 100)}%` }}
                          title={`Expedição: ${point.expeditionKg} Kg`}
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

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border/70 bg-card p-3 text-xs">
                <div className="mb-2 flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-info" />
                  <span className="font-medium text-foreground">Produção (Kg)</span>
                </div>
                <p className="text-muted-foreground">Volume total planejado por dia.</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-card p-3 text-xs">
                <div className="mb-2 flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-success" />
                  <span className="font-medium text-foreground">Expedição (Kg)</span>
                </div>
                <p className="text-muted-foreground">Carga prevista para separação e entrega.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Composição e Alertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/70 bg-panel/45 p-3">
              <div className="relative mx-auto size-44">
                <div className="size-full rounded-full border border-border/70" style={statusDonutStyle} />
                <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full border border-border/70 bg-card">
                  <p className="text-xl font-semibold text-foreground">{totalOrders}</p>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    Pedidos
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {statusDistribution.map((entry) => (
                  <div key={entry.status} className="rounded-lg border border-border/70 bg-card p-2.5">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`size-2.5 rounded-full ${statusBars[entry.status]}`} />
                        <span className="font-medium text-foreground">{entry.label}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {entry.count} ({entry.percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-panel">
                      <div
                        className={`h-full rounded-full ${statusBars[entry.status]}`}
                        style={{ width: `${Math.min(entry.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-panel/45 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Pronto para expedição
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">{readyForExpedition} pedidos</p>
            </div>

            {operationalAlerts.map((alert) => (
              <div key={alert.key} className="flex items-start justify-between rounded-lg border border-border/70 bg-card p-3">
                <div className="pr-4">
                  <p className="text-sm font-medium text-foreground">{alert.label}</p>
                </div>
                <span
                  className={`inline-flex min-w-14 items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                    alert.tone === "danger"
                      ? "bg-danger/40 text-danger-foreground"
                      : alert.tone === "warning"
                        ? "bg-warning/40 text-warning-foreground"
                        : "bg-success/35 text-success-foreground"
                  }`}
                >
                  {alert.value}
                </span>
              </div>
            ))}

            <div className="rounded-lg border border-border/70 bg-panel/35 p-3 text-xs text-muted-foreground">
              Indicadores consolidados com base na data de referência para pedidos, produção e expedição.
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle>Carga por Setor da Fábrica</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-border/75">
            <table className="w-full min-w-[680px] border-collapse">
              <thead className="bg-panel">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Setor</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">OPs</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Carga (Kg)</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Utilização média</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">OPs críticas</th>
                </tr>
              </thead>
              <tbody>
                {sectorSummary.map((sector) => (
                  <tr key={sector.sectorName}>
                    <td className="border-t border-border/70 bg-card px-3 py-2 text-sm font-medium text-foreground">
                      {sector.sectorName}
                    </td>
                    <td className="border-t border-border/70 bg-card px-3 py-2 text-sm text-foreground">
                      {sector.ops}
                    </td>
                    <td className="border-t border-border/70 bg-card px-3 py-2 text-sm text-foreground">
                      {sector.totalKg}
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
        </CardContent>
      </Card>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.24 }}
        className="space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Acesso por Tipo de Usuário</h2>
            <p className="text-sm text-muted-foreground">
              O administrador acessa todos os módulos, separados por perfil para navegação rápida.
            </p>
          </div>
        </div>

        {quickAccessGroups.map((group) => (
          <section key={group.label} className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/70 pb-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {group.label}
              </h3>
              <span className="rounded-full bg-panel px-2.5 py-1 text-xs font-semibold text-foreground">
                {group.modules.length} páginas
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {group.modules.map((module) => (
                <ModuleCard
                  key={module.href}
                  href={module.href}
                  title={module.title}
                  subtitle={module.subtitle}
                  description={module.description}
                  icon={module.icon}
                  tone={module.tone}
                  footerLabel="Abrir página"
                />
              ))}
            </div>
          </section>
        ))}

        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Delegação e segurança de acesso</p>
              <p className="text-sm text-muted-foreground">
                Defina quem pode acessar cada módulo e com qual nível de permissão.
              </p>
            </div>
            <Link
              href="/administrador/usuarios"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Users className="size-4" />
              Abrir gestão de usuários
            </Link>
          </CardContent>
        </Card>
      </motion.div>
    </PageLayout>
  );
}
