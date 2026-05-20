"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, Database, Factory, Package, ShoppingCart } from "lucide-react";

import { KPICard, PageLayout } from "@/components/shared/page-layout";
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
      activeProducts: activeProducts.length,
      activeIngredients: activeIngredients.length,
      activeStores: activeStores.length,
      activeSchedules: activeSchedules.length,
      totalSchedules: snapshot.schedules.length,
      latestSchedule,
    };
  }, [snapshot]);

  const quickActions = [
    {
      href: "/gestor-dados/produtos",
      label: "Cadastrar produto",
      icon: ShoppingCart,
    },
    {
      href: "/gestor-dados/ingredientes",
      label: "Cadastrar ingrediente",
      icon: Package,
    },
    {
      href: "/gestor-dados/linhas-producao",
      label: "Linhas de produção",
      icon: Factory,
    },
  ];

  return (
    <PageLayout
      title="Gestor de Dados"
      description="Cadastros mestres e cronogramas auditados."
      badge="Engenharia"
      breadcrumbs={[{ label: "Início", href: "/" }, { label: "Gestor de Dados" }]}
    >
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/35 bg-danger/15 px-4 py-3 text-sm text-danger-foreground"
        >
          {error}
        </div>
      ) : null}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="space-y-2"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <KPICard
            title="Registros Ativos"
            value={isLoading ? "..." : dashboard.activeRecords}
            subtitle="Cadastros mestres ativos"
            tone="info"
            icon={Database}
          />
          <KPICard
            title="Linhas Auditadas"
            value={isLoading ? "..." : dashboard.activeSchedules}
            subtitle={isLoading ? "Carregando cronogramas" : `${dashboard.totalSchedules} linhas no total`}
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
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Produtos:</span> {dashboard.activeProducts} ativos
          <span className="mx-2 opacity-50">·</span>
          <span className="font-medium text-foreground">Ingredientes:</span> {dashboard.activeIngredients} ativos
          <span className="mx-2 opacity-50">·</span>
          <span className="font-medium text-foreground">Lojas:</span> {dashboard.activeStores} ativas
        </p>
      </motion.div>

      <motion.nav
        aria-label="Atalhos de cadastro"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.16 }}
        className="flex flex-wrap gap-2"
      >
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-[var(--shadow-soft)] transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon className="size-3.5 text-muted-foreground" aria-hidden />
              {action.label}
            </Link>
          );
        })}
      </motion.nav>
    </PageLayout>
  );
}
