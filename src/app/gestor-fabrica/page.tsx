"use client";

import { motion } from "framer-motion";
import {
  ClipboardList,
  Clock,
  Factory,
  ListChecks,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { useMemo } from "react";

import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { ModuleCard } from "@/components/shared/module-card";
import { useDeliveryExecution } from "@/lib/delivery-execution";
import { filterFactoryPlanningDataByOperationalScope } from "@/lib/operational-date-scope";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";

export default function GestorFabricaPage() {
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const { planningData: planningSnapshot, isLoading, error } = useFactoryPlanningSnapshot(anchorDate);
  const planningData = useMemo(
    () => filterFactoryPlanningDataByOperationalScope(planningSnapshot, scope),
    [planningSnapshot, scope],
  );
  const deliveryExecution = useDeliveryExecution();

  const metrics = useMemo(() => {
    const totalOrders = planningData.orders.length;
    const awaitingRelease = planningData.orders.filter((item) => !item.releasedToProduction).length;
    const inProduction = planningData.orders.filter((item) => item.status === "em_producao").length;
    const checklistPending = planningData.expedition.filter((item) => {
      if (item.status !== "aguardando_expedicao") {
        return false;
      }

      return deliveryExecution.resolveExecution(item.orderId, true).status === "aguardando_expedicao";
    }).length;
    const deliveriesInField = planningData.expedition.filter((item) => {
      const status = deliveryExecution.resolveExecution(item.orderId, item.status === "aguardando_expedicao").status;
      return status === "em_rota" || status === "no_destino";
    }).length;

    return {
      totalOrders,
      awaitingRelease,
      inProduction,
      checklistPending,
      deliveriesInField,
      productionOrders: planningData.productionOrders.length,
      expeditionRows: planningData.expedition.length,
    };
  }, [deliveryExecution, planningData.expedition, planningData.orders, planningData.productionOrders.length]);

  const modules = useMemo(
    () => [
      {
        href: "/gestor-fabrica/sublinhas-producao",
        title: "Linhas",
        subtitle: "Visão derivada do cronograma",
        description: "Acompanhe a linha executora derivada dos produtos e a carga consolidada por dia.",
        icon: ClipboardList,
        tone: "emerald" as const,
        items: [
          `${planningData.productionDates.length} datas produtivas na referência`,
          `${planningData.productionOrders.length} OPs consolidadas`,
        ],
      },
      {
        href: "/gestor-fabrica/pedidos",
        title: "Gestão de Pedidos",
        subtitle: "Pedidos de todas as lojas",
        description: "Acompanhe pedidos, prazo D+X, datas de recebimento e acesso ao detalhe individual.",
        icon: ShoppingCart,
        tone: "violet" as const,
        items: [
          `${metrics.totalOrders} pedidos no dia`,
          `${metrics.awaitingRelease} aguardando liberação`,
        ],
      },
      {
        href: "/gestor-fabrica/ordens-producao",
        title: "Ordens de Produção",
        subtitle: "OP por categoria e subcategoria",
        description: "Visualize as OPs liberadas com progresso derivado por item operacional.",
        icon: Factory,
        tone: "amber" as const,
        items: [
          `${metrics.productionOrders} OPs geradas`,
          `${metrics.inProduction} pedidos em produção`,
        ],
      },
      {
        href: "/gestor-fabrica/expedicao",
        title: "Expedição",
        subtitle: "Reconversão e separação",
        description: "Converta o interno em Kg para unidade de separação de cada pedido de loja.",
        icon: ListChecks,
        tone: "emerald" as const,
        items: [
          `${metrics.checklistPending} checklists pendentes`,
          `${metrics.deliveriesInField} entregas em campo`,
        ],
      },
    ],
    [
      metrics.awaitingRelease,
      metrics.checklistPending,
      metrics.deliveriesInField,
      metrics.inProduction,
      metrics.productionOrders,
      metrics.totalOrders,
      planningData.productionDates.length,
      planningData.productionOrders.length,
    ],
  );

  return (
    <PageLayout
      title="Gestor de Fábrica"
      description="Visão operacional real de pedidos, produção, checklist de expedição e entregas."
      badge="Operacional"
      breadcrumbs={[{ label: "Início", href: "/" }, { label: "Gestor de Fábrica" }]}
    >
      {error ? (
        <div className="rounded-xl border border-danger/35 bg-danger/15 px-4 py-3 text-sm text-danger-foreground">
          {error}
        </div>
      ) : null}

      <OperationalDateScopeCard
        scope={scope}
        summary={summary}
        setMode={setMode}
        setDate={setDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        title="Janela operacional"
        description="Veja a fábrica inteira, um único dia ou um período fechado sem trocar manualmente a referência em cada tela."
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        <KPICard
          title="Pedidos no dia"
          value={isLoading ? "..." : metrics.totalOrders}
          tone="info"
          icon={ShoppingCart}
          compactValue
        />
        <KPICard
          title="Aguardando liberação"
          value={isLoading ? "..." : metrics.awaitingRelease}
          tone="warning"
          icon={Clock}
          compactValue
        />
        <KPICard
          title="Em produção"
          value={isLoading ? "..." : metrics.inProduction}
          tone="info"
          icon={Factory}
          compactValue
        />
        <KPICard
          title="Checklist pendente"
          value={isLoading ? "..." : metrics.checklistPending}
          tone="success"
          icon={ListChecks}
          compactValue
        />
        <KPICard
          title="Entregas em campo"
          value={isLoading ? "..." : metrics.deliveriesInField}
          tone="neutral"
          icon={Truck}
          compactValue
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
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
              items={module.items}
              footerLabel="Abrir módulo"
            />
          </motion.div>
        ))}
      </motion.div>
    </PageLayout>
  );
}
