"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Factory, ListChecks, Truck } from "lucide-react";
import { useMemo } from "react";

import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { Button } from "@/components/ui/button";
import { filterFactoryPlanningDataByOperationalScope } from "@/lib/operational-date-scope";
import { formatKgLabel } from "@/lib/utils";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";

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

      {/* Atalhos primários do chão. Navegação completa está na sidebar; aqui só os 2 destinos do dia. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
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
