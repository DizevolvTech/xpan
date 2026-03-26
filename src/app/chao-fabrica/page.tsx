"use client";

import { motion } from "framer-motion";
import { Factory, ListChecks, Truck } from "lucide-react";
import { useMemo } from "react";

import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { ModuleCard } from "@/components/shared/module-card";
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

  const modules = [
    {
      href: "/chao-fabrica/ordens-producao",
      title: "Produção",
      subtitle: "O que produzir agora",
      description: "Lista operacional de OPs por categoria, linha de produção e linha executora, pronta para execução.",
      icon: Factory,
      tone: "amber" as const,
    },
    {
      href: "/chao-fabrica/expedicao",
      title: "Expedição",
      subtitle: "O que separar e enviar",
      description: "Separação por pedido com impressão de apoio para o time de expedição.",
      icon: ListChecks,
      tone: "emerald" as const,
    },
    {
      href: "/chao-fabrica/entregas",
      title: "Entregas",
      subtitle: "Execução em campo",
      description: "Use o fluxo mobile para sair com os pedidos, registrar rota e confirmar entrega.",
      icon: Truck,
      tone: "cyan" as const,
    },
  ];

  return (
    <PageLayout
      title="Chão de Fábrica"
      description="Somente visualização operacional do que produzir e do que expedir."
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
        description="Navegue por todo o backlog, foque em um dia ou feche um período sem trocar a referência manual em cada módulo."
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        <KPICard title="OPs para produzir" value={opsCount} tone="info" icon={Factory} compactValue />
        <KPICard
          title="Carga de produção"
          value={formatKgLabel(productionKg, { maximumFractionDigits: 2 })}
          tone="success"
          icon={Factory}
          compactValue
        />
        <KPICard title="Pedidos liberados" value={releasedOrders} tone="info" icon={ListChecks} compactValue />
        <KPICard title="Pedidos prontos p/ expedir" value={expeditionReady} tone="success" icon={Truck} compactValue />
        <KPICard
          title="Pedidos aguardando liberação"
          value={awaitingRelease}
          tone="warning"
          icon={Truck}
          compactValue
        />
        <KPICard
          title="Carga total de expedição"
          value={formatKgLabel(expeditionKg, { maximumFractionDigits: 2 })}
          tone="neutral"
          icon={ListChecks}
          compactValue
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {modules.map((module, index) => (
          <motion.div
            key={module.href}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
          >
            <ModuleCard
              href={module.href}
              title={module.title}
              subtitle={module.subtitle}
              description={module.description}
              icon={module.icon}
              tone={module.tone}
              footerLabel="Abrir módulo"
            />
          </motion.div>
        ))}
      </motion.div>
    </PageLayout>
  );
}

