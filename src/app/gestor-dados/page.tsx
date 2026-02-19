"use client";

import { motion } from "framer-motion";
import {
  Box,
  Clock,
  Database,
  Factory,
  Package,
  ShoppingCart,
  Store,
  Truck,
  Users,
} from "lucide-react";

import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { ModuleCard } from "@/components/shared/module-card";

const modules = [
  {
    title: "Ingredientes",
    description: "Cadastro e gestão de materiais e ingredientes",
    href: "/gestor-dados/ingredientes",
    icon: Package,
    tone: "blue" as const,
  },
  {
    title: "Produtos",
    description: "Cadastro e gestão de produtos",
    href: "/gestor-dados/produtos",
    icon: ShoppingCart,
    tone: "emerald" as const,
  },
  {
    title: "Setores",
    description: "Cadastro e gestão de setores",
    href: "/gestor-dados/setores",
    icon: Users,
    tone: "violet" as const,
  },
  {
    title: "Linhas de Produção",
    description: "Cadastro e gestão de linhas de produção",
    href: "/gestor-dados/linhas-producao",
    icon: Factory,
    tone: "amber" as const,
  },
  {
    title: "Lojas",
    description: "Cadastro e gestão de lojas",
    href: "/gestor-dados/lojas",
    icon: Store,
    tone: "rose" as const,
  },
  {
    title: "Embalagens",
    description: "Cadastro e gestão de embalagens",
    href: "/gestor-dados/embalagens",
    icon: Box,
    tone: "amber" as const,
  },
  {
    title: "Rotas de Expedição",
    description: "Cadastro e gestão de rotas de expedição",
    href: "/gestor-dados/rotas-expedicao",
    icon: Truck,
    tone: "cyan" as const,
  },
];

export default function GestorDadosPage() {
  return (
    <PageLayout
      title="Gestor de Dados"
      description="Gerencie os dados mestres do sistema"
      badge="Engenharia"
      breadcrumbs={[{ label: "Início", href: "/" }, { label: "Gestor de Dados" }]}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid gap-3 sm:grid-cols-3"
      >
        <KPICard title="Registros Ativos" value="1.234" tone="info" icon={Database} />
        <KPICard title="Última Atualização" value="15 min" tone="neutral" icon={Clock} />
        <KPICard title="Clientes Cadastrados" value="233" tone="success" icon={Store} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {modules.map((module, index) => (
          <motion.div
            key={module.href}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * index }}
          >
            <ModuleCard
              href={module.href}
              title={module.title}
              description={module.description}
              icon={module.icon}
              tone={module.tone}
              footerLabel="Gerenciar"
            />
          </motion.div>
        ))}
      </motion.div>
    </PageLayout>
  );
}
