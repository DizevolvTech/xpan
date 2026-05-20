"use client";

import { motion } from "framer-motion";
import { AlertCircle, ShoppingCart, Truck } from "lucide-react";
import { useMemo } from "react";

import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { KPICard, PageLayout } from "@/components/shared/page-layout";
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

    return {
      openOrders,
      incoming,
      openOccurrences,
    };
  }, [scopedOccurrences, scopedOrders]);

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
    </PageLayout>
  );
}
