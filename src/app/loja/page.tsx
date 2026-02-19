"use client";

import { motion } from "framer-motion";
import { AlertCircle, Clock, Package, ShoppingCart, Truck } from "lucide-react";

import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { ModuleCard } from "@/components/shared/module-card";

const kpis = [
  { title: "Total de Pedidos", value: "1", tone: "info" as const, icon: ShoppingCart },
  { title: "Agendado", value: "1", tone: "warning" as const, icon: Clock },
  { title: "Em Produção", value: "0", tone: "neutral" as const, icon: Package },
  { title: "Rota de Entrega", value: "0", tone: "success" as const, icon: Truck },
  { title: "Ocorrências", value: "12", tone: "danger" as const, icon: AlertCircle },
];

const modules = [
  {
    href: "/loja/pedidos",
    title: "Meus Pedidos",
    subtitle: "Gerencie seus pedidos",
    description: "Faça novos pedidos e acompanhe o status com visibilidade das etapas de produção.",
    icon: ShoppingCart,
    tone: "violet" as const,
  },
  {
    href: "/loja/ocorrencias",
    title: "Ocorrências",
    subtitle: "Gerencie ocorrências",
    description: "Abra e acompanhe ocorrências de forma estruturada e rastreável.",
    icon: AlertCircle,
    tone: "rose" as const,
  },
];

export default function LojaPage() {
  return (
    <PageLayout
      title="Olá, Rommel Filho"
      description="Bem-vindo ao sistema de pedidos"
      badge="Responsável de Loja"
      breadcrumbs={[{ label: "Início", href: "/" }, { label: "Loja" }]}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        {kpis.map((kpi) => (
          <KPICard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            tone={kpi.tone}
            icon={kpi.icon}
          />
        ))}
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
              footerLabel="Abrir módulo"
            />
          </motion.div>
        ))}
      </motion.div>
    </PageLayout>
  );
}
