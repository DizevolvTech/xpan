"use client";

import { motion } from "framer-motion";
import { AlertCircle, Clock, Package, ShoppingCart, Truck } from "lucide-react";
import { useMemo, useState } from "react";

import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { ModuleCard } from "@/components/shared/module-card";
import { getTodayDateKey } from "@/lib/order-planning";
import { useCurrentProfile } from "@/lib/use-current-profile";
import { useStoreOccurrences } from "@/lib/use-store-occurrences";
import { useStoreOrderSummaries } from "@/lib/use-store-orders";

function getFirstName(fullName: string | undefined) {
  if (!fullName) {
    return "";
  }

  return fullName.trim().split(/\s+/)[0] ?? "";
}

export default function LojaPage() {
  const [referenceDate, setReferenceDate] = useState(getTodayDateKey());
  const { profile, isLoading: isProfileLoading, error: profileError } = useCurrentProfile();
  const { orders, isLoading: isOrdersLoading, error: ordersError } = useStoreOrderSummaries(referenceDate);
  const { occurrences, isLoading: isOccurrencesLoading, error: occurrencesError } = useStoreOccurrences();

  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    const scheduled = orders.filter((item) => item.status === "agendado").length;
    const inProduction = orders.filter((item) => item.status === "em_producao").length;
    const readyToReceive = orders.filter((item) => item.status === "aguardando_expedicao").length;
    const openOccurrences = occurrences.filter(
      (item) => item.status === "aberta" || item.status === "em_analise",
    ).length;

    return {
      totalOrders,
      scheduled,
      inProduction,
      readyToReceive,
      openOccurrences,
    };
  }, [occurrences, orders]);

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
          `${occurrences.length} ocorrências registradas`,
          `${metrics.openOccurrences} em aberto`,
        ],
      },
    ],
    [metrics.openOccurrences, metrics.readyToReceive, metrics.totalOrders, occurrences.length],
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

      <div className="rounded-xl border border-border/80 bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Referência da loja
            </p>
            <p className="text-sm text-muted-foreground">Os indicadores abaixo seguem a data usada no módulo de pedidos.</p>
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
