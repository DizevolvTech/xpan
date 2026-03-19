"use client";

import { motion } from "framer-motion";
import { AlertCircle, Clock, Package, ShoppingCart, Truck } from "lucide-react";
import { useMemo } from "react";

import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { ModuleCard } from "@/components/shared/module-card";
import { filterStoreOrderSummariesByOperationalScope } from "@/lib/operational-date-scope";
import { useCurrentProfile } from "@/lib/use-current-profile";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";
import { useStoreOccurrences } from "@/lib/use-store-occurrences";
import { useStoreOrderSummaries } from "@/lib/use-store-orders";
import { useStoreScope } from "@/lib/use-store-scope";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function getFirstName(fullName: string | undefined) {
  if (!fullName) {
    return "";
  }

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
    const totalOrders = scopedOrders.length;
    const scheduled = scopedOrders.filter((item) => item.status === "agendado").length;
    const inProduction = scopedOrders.filter((item) => item.status === "em_producao").length;
    const readyToReceive = scopedOrders.filter((item) =>
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

    return {
      totalOrders,
      scheduled,
      inProduction,
      readyToReceive,
      openOccurrences,
    };
  }, [scopedOccurrences, scopedOrders]);

  const modules = useMemo(
    () => [
      {
        href: "/loja/pedidos",
        title: "Meus Pedidos",
        subtitle: "Gerencie seus pedidos",
        description: "Faça novos pedidos e acompanhe o status com visibilidade das etapas de produção.",
        icon: ShoppingCart,
        tone: "violet" as const,
        items: [
          `${metrics.totalOrders} pedidos na referência`,
          `${metrics.readyToReceive} prontos para receber`,
        ],
      },
      {
        href: "/loja/ocorrencias",
        title: "Ocorrências",
        subtitle: "Gerencie ocorrências",
        description: "Abra e acompanhe ocorrências de forma estruturada e rastreável.",
        icon: AlertCircle,
        tone: "rose" as const,
        items: [
          `${scopedOccurrences.length} ocorrências registradas`,
          `${metrics.openOccurrences} em aberto`,
        ],
      },
    ],
    [metrics.openOccurrences, metrics.readyToReceive, metrics.totalOrders, scopedOccurrences.length],
  );

  const combinedError = profileError ?? ordersError ?? occurrencesError;
  const isLoading = isProfileLoading || isOrdersLoading || isOccurrencesLoading;
  const firstName = getFirstName(profile?.name);

  return (
    <PageLayout
      title={isProfileLoading ? "Loja" : firstName ? `Olá, ${firstName}` : "Loja"}
      description="Visão real dos pedidos da loja, recebimentos previstos e ocorrências abertas."
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

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        <KPICard
          title="Pedidos"
          value={isLoading ? "..." : metrics.totalOrders}
          tone="info"
          icon={ShoppingCart}
        />
        <KPICard
          title="Agendados"
          value={isLoading ? "..." : metrics.scheduled}
          tone="warning"
          icon={Clock}
        />
        <KPICard
          title="Em produção"
          value={isLoading ? "..." : metrics.inProduction}
          tone="neutral"
          icon={Package}
        />
        <KPICard
          title="Prontos p/ receber"
          value={isLoading ? "..." : metrics.readyToReceive}
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

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid gap-4 md:grid-cols-2"
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
