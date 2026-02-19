"use client";

import { motion } from "framer-motion";
import {
  ClipboardList,
  Clock,
  Factory,
  ListChecks,
  Package,
  ShoppingCart,
  Truck,
} from "lucide-react";

import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { ModuleCard } from "@/components/shared/module-card";

const kpis = [
  { title: "Total de Pedidos", value: "1.234", tone: "info" as const, icon: ShoppingCart },
  { title: "Pendentes", value: "32", tone: "warning" as const, icon: Clock },
  { title: "Em Produção", value: "32", tone: "info" as const, icon: Factory },
  { title: "Em Espera", value: "12", tone: "neutral" as const, icon: Package },
  { title: "Rota de Entrega", value: "32", tone: "success" as const, icon: Truck },
];

const modules = [
  {
    href: "/gestor-fabrica/sublinhas-producao",
    title: "Sublinhas de Produção",
    subtitle: "Aprovar e gerenciar cronogramas",
    description: "Controle os cronogramas e a liberação operacional para os módulos de pedidos.",
    icon: ClipboardList,
    tone: "emerald" as const,
  },
  {
    href: "/gestor-fabrica/pedidos",
    title: "Gestão de Pedidos",
    subtitle: "Pedidos de todas as lojas",
    description: "Acompanhe pedidos, prazo D+X, datas de recebimento e acesso ao detalhe individual.",
    icon: ShoppingCart,
    tone: "violet" as const,
  },
  {
    href: "/gestor-fabrica/ordens-producao",
    title: "Ordens de Produção",
    subtitle: "OP por setor e linha",
    description: "Visualize as OPs geradas automaticamente com alocação por sublinha ativa.",
    icon: Factory,
    tone: "amber" as const,
  },
  {
    href: "/gestor-fabrica/expedicao",
    title: "Expedição",
    subtitle: "Reconversão e separação",
    description: "Converta o interno em Kg para unidade de separação de cada pedido de loja.",
    icon: ListChecks,
    tone: "emerald" as const,
  },
];

export default function GestorFabricaPage() {
  return (
    <PageLayout
      title="Gestor de Fábrica"
      description="Gerencie sublinhas e pedidos da fábrica"
      badge="Operacional"
      breadcrumbs={[{ label: "Início", href: "/" }, { label: "Gestor de Fábrica" }]}
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
              footerLabel="Abrir módulo"
            />
          </motion.div>
        ))}
      </motion.div>
    </PageLayout>
  );
}
