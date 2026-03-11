"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, Database, Factory, Package, ShoppingCart, Store, Users } from "lucide-react";

import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { ModuleCard } from "@/components/shared/module-card";
import { formatDateBr } from "@/lib/production-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";

function formatTimestampLabel(value: string | undefined) {
  if (!value) {
    return "Sem revisão";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const dateLabel = formatDateBr(date.toISOString().slice(0, 10));
  const timeLabel = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${dateLabel} · ${timeLabel}`;
}

export default function GestorDadosPage() {
  const { snapshot, isLoading, error } = useMasterDataSnapshot();

  const dashboard = useMemo(() => {
    const activeIngredients = snapshot.ingredients.filter((ingredient) => ingredient.status === "ativo");
    const activeProducts = snapshot.products.filter((product) => product.active);
    const activeCategories = snapshot.sectors.filter((sector) => sector.status === "ativo");
    const activeSubcategories = snapshot.lines.filter((line) => line.status === "ativo");
    const activeStores = snapshot.stores.filter((store) => store.status === "ativo");
    const activeSchedules = snapshot.schedules.filter((schedule) => schedule.status === "ativo");
    const mpiProducts = snapshot.products.filter((product) => product.canBeIngredient);
    const looseProducts = snapshot.products.filter((product) => product.isSoldLoose);
    const mixedIngredients = snapshot.ingredients.filter((ingredient) => ingredient.type === "misturado");
    const latestSchedule = [...snapshot.schedules].sort((left, right) => {
      const leftValue = left.auditedAt ?? left.createdAt;
      const rightValue = right.auditedAt ?? right.createdAt;
      return rightValue.localeCompare(leftValue);
    })[0];

    const activeRecords =
      activeIngredients.length +
      activeProducts.length +
      activeCategories.length +
      activeSubcategories.length +
      activeStores.length;

    return {
      activeRecords,
      activeStores: activeStores.length,
      activeSchedules: activeSchedules.length,
      latestSchedule,
      modules: [
        {
          title: "Ingredientes",
          description: "Cadastro e gestão de materiais, bases e ingredientes misturados.",
          href: "/gestor-dados/ingredientes",
          icon: Package,
          tone: "blue" as const,
          subtitle: `${snapshot.ingredients.length} cadastrados`,
          items: [
            `${activeIngredients.length} ativos`,
            `${mixedIngredients.length} misturados`,
          ],
        },
        {
          title: "Produtos",
          description: "Engenharia em kg, receita, cronograma e reaproveitamento MPI.",
          href: "/gestor-dados/produtos",
          icon: ShoppingCart,
          tone: "emerald" as const,
          subtitle: `${snapshot.products.length} cadastrados`,
          items: [
            `${activeProducts.length} ativos`,
            `${mpiProducts.length} produto ingrediente`,
            `${looseProducts.length} a granel`,
          ],
        },
        {
          title: "Categorias",
          description: "Estrutura macro de produção e responsabilidade por área.",
          href: "/gestor-dados/setores",
          icon: Users,
          tone: "violet" as const,
          subtitle: `${snapshot.sectors.length} categorias`,
          items: [`${activeCategories.length} ativas`],
        },
        {
          title: "Subcategorias",
          description: "Capacidade, tipo operacional e vínculo de produtos por subcategoria.",
          href: "/gestor-dados/linhas-producao",
          icon: Factory,
          tone: "amber" as const,
          subtitle: `${snapshot.lines.length} subcategorias`,
          items: [
            `${activeSubcategories.length} ativas`,
            `${activeSchedules.length} linhas auditadas`,
          ],
        },
        {
          title: "Lojas",
          description: "Cadastro comercial com dias de pedido, recebimento e janela operacional.",
          href: "/gestor-dados/lojas",
          icon: Store,
          tone: "rose" as const,
          subtitle: `${snapshot.stores.length} lojas`,
          items: [
            `${activeStores.length} ativas`,
            `Corte ${snapshot.operationalSettings.orderCutoffTime}`,
          ],
        },
      ],
    };
  }, [snapshot]);

  return (
    <PageLayout
      title="Gestor de Dados"
      description="Visão real dos cadastros mestres, cronogramas auditados e engenharia operacional."
      badge="Engenharia"
      breadcrumbs={[{ label: "Início", href: "/" }, { label: "Gestor de Dados" }]}
    >
      {error ? (
        <div className="rounded-xl border border-danger/35 bg-danger/15 px-4 py-3 text-sm text-danger-foreground">
          {error}
        </div>
      ) : null}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KPICard
          title="Registros Ativos"
          value={isLoading ? "..." : dashboard.activeRecords}
          subtitle="Categorias, subcategorias, lojas, ingredientes e produtos ativos"
          tone="info"
          icon={Database}
        />
        <KPICard
          title="Linhas Auditadas"
          value={isLoading ? "..." : dashboard.activeSchedules}
          subtitle={isLoading ? "Carregando cronogramas" : `${snapshot.schedules.length} linhas no total`}
          tone="success"
          icon={Factory}
        />
        <KPICard
          title="Última Revisão"
          value={isLoading ? "..." : formatTimestampLabel(dashboard.latestSchedule?.auditedAt ?? dashboard.latestSchedule?.createdAt)}
          subtitle={
            isLoading
              ? "Carregando histórico"
              : dashboard.latestSchedule
                ? dashboard.latestSchedule.name
                : "Nenhuma linha cadastrada"
          }
          tone="neutral"
          icon={Clock}
        />
        <KPICard
          title="Lojas Cadastradas"
          value={isLoading ? "..." : snapshot.stores.length}
          subtitle={isLoading ? "Carregando lojas" : `${dashboard.activeStores} ativas`}
          tone="success"
          icon={Store}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {dashboard.modules.map((module, index) => (
          <motion.div
            key={module.href}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * index }}
          >
            <ModuleCard
              href={module.href}
              title={module.title}
              subtitle={module.subtitle}
              description={module.description}
              icon={module.icon}
              tone={module.tone}
              items={module.items}
              footerLabel="Gerenciar"
            />
          </motion.div>
        ))}
      </motion.div>
    </PageLayout>
  );
}
