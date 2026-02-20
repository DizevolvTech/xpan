"use client";

import { motion } from "framer-motion";
import { Factory, ListChecks, Truck } from "lucide-react";
import { useMemo, useState } from "react";

import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { ModuleCard } from "@/components/shared/module-card";
import { applyFactoryOrderStatus, useFactoryOrderStatus } from "@/lib/factory-order-status";
import { buildFactoryPlanningData, getTodayDateKey } from "@/lib/order-planning";

export default function ChaoFabricaPage() {
  const [referenceDate, setReferenceDate] = useState(getTodayDateKey());
  const statusState = useFactoryOrderStatus(referenceDate);

  const basePlanningData = useMemo(() => buildFactoryPlanningData(referenceDate), [referenceDate]);
  const planningData = useMemo(
    () => applyFactoryOrderStatus(basePlanningData, statusState.resolveStatus),
    [basePlanningData, statusState.resolveStatus],
  );

  const opsCount = planningData.productionOrders.length;
  const productionKg = Number(planningData.productionOrders.reduce((sum, item) => sum + item.totalKg, 0).toFixed(2));
  const expeditionReady = planningData.expedition.filter(
    (item) => item.status === "em_producao" || item.status === "rota_entrega",
  ).length;
  const expeditionBlocked = planningData.expedition.length - expeditionReady;
  const expeditionKg = Number(planningData.expedition.reduce((sum, item) => sum + item.totalKg, 0).toFixed(2));

  const modules = [
    {
      href: "/chao-fabrica/ordens-producao",
      title: "Produção",
      subtitle: "O que produzir agora",
      description: "Lista operacional de OPs por setor e linha, pronta para execução.",
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
      <div className="rounded-xl border border-border/80 bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Referência operacional
            </p>
            <p className="text-sm text-muted-foreground">Use a data para consultar as tarefas do dia.</p>
          </div>
          <input
            type="date"
            value={referenceDate}
            onChange={(event) => setReferenceDate(event.target.value)}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground"
          />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        <KPICard title="OPs para produzir" value={opsCount} tone="info" icon={Factory} compactValue />
        <KPICard title="Carga de produção" value={`${productionKg} Kg`} tone="success" icon={Factory} compactValue />
        <KPICard title="Pedidos prontos p/ expedir" value={expeditionReady} tone="success" icon={Truck} compactValue />
        <KPICard
          title="Pedidos aguardando liberação"
          value={expeditionBlocked}
          tone="warning"
          icon={Truck}
          compactValue
        />
        <KPICard title="Carga total de expedição" value={`${expeditionKg} Kg`} tone="neutral" icon={ListChecks} compactValue />
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

