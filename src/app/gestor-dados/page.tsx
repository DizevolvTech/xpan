"use client";

import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Clock,
  Database,
  Factory,
  FileText,
  Image as ImageIcon,
  Package,
  ShoppingCart,
  Store,
  Weight,
} from "lucide-react";

import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const coverageConfig = {
  description: {
    label: "Com descrição",
    color: "oklch(0.84 0.06 238)", // info
    barClassName: "bg-info",
  },
  recipe: {
    label: "Com receita",
    color: "oklch(0.86 0.07 148)", // success
    barClassName: "bg-success",
  },
  weight: {
    label: "Com peso",
    color: "oklch(0.89 0.09 90)", // warning
    barClassName: "bg-warning",
  },
} as const;

type CoverageKey = keyof typeof coverageConfig;

function parseWeight(weight: string | undefined): number {
  if (!weight) return 0;
  const normalized = weight.replace(",", ".").replace(/[^\d.]/g, "");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
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
      activeProductsList: activeProducts,
      activeLines: activeSubcategories,
    };
  }, [snapshot]);

  // --- Cobertura de cadastros (qualidade dos produtos) ---
  const coverage = useMemo(() => {
    const total = dashboard.activeProductsList.length;
    if (total === 0) {
      return {
        total,
        description: { count: 0, pct: 0 },
        recipe: { count: 0, pct: 0 },
        weight: { count: 0, pct: 0 },
        complete: 0,
        completePct: 0,
      };
    }

    let description = 0;
    let recipe = 0;
    let weight = 0;
    let complete = 0;

    dashboard.activeProductsList.forEach((product) => {
      const hasDescription = product.description?.trim().length > 0;
      const hasRecipe = Array.isArray(product.recipe) && product.recipe.length > 0;
      const hasWeight = parseWeight(product.weight) > 0;

      if (hasDescription) description += 1;
      if (hasRecipe) recipe += 1;
      if (hasWeight) weight += 1;
      if (hasDescription && hasRecipe && hasWeight) complete += 1;
    });

    return {
      total,
      description: { count: description, pct: Number(((description / total) * 100).toFixed(1)) },
      recipe: { count: recipe, pct: Number(((recipe / total) * 100).toFixed(1)) },
      weight: { count: weight, pct: Number(((weight / total) * 100).toFixed(1)) },
      complete,
      completePct: Number(((complete / total) * 100).toFixed(1)),
    };
  }, [dashboard.activeProductsList]);

  const coverageDonutStyle = useMemo<CSSProperties>(() => {
    if (coverage.total === 0) {
      return { background: "conic-gradient(var(--muted) 0 100%)" };
    }

    // O donut representa o cadastro mais completo (todas as 3 dimensões).
    // Fatia colorida = % completos; resto = lacuna.
    const completed = coverage.completePct;
    return {
      background: `conic-gradient(oklch(0.86 0.07 148) 0% ${completed}%, var(--muted) ${completed}% 100%)`,
    };
  }, [coverage]);

  // --- Top 5 linhas de produção por produtos vinculados ---
  const topLines = useMemo(() => {
    const sectorById = new Map(snapshot.sectors.map((sector) => [sector.id, sector.name]));
    const lineById = new Map(snapshot.lines.map((line) => [line.id, line]));

    const counter = new Map<string, number>();
    dashboard.activeProductsList.forEach((product) => {
      const lineId = product.operationalLineId ?? product.masterLineId ?? product.lineId;
      if (!lineId) return;
      counter.set(lineId, (counter.get(lineId) ?? 0) + 1);
    });

    const ranked = Array.from(counter.entries())
      .map(([lineId, count]) => {
        const line = lineById.get(lineId);
        return {
          lineId,
          lineName: line?.name ?? "Linha removida",
          sectorName: line?.sectorId ? sectorById.get(line.sectorId) ?? "—" : "—",
          status: line?.status ?? "inativo",
          count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const max = ranked.length > 0 ? Math.max(...ranked.map((entry) => entry.count)) : 0;

    return { ranked, max };
  }, [dashboard.activeProductsList, snapshot.lines, snapshot.sectors]);

  // --- Alertas de qualidade ---
  const qualityAlerts = useMemo(() => {
    const productsWithoutDescription = dashboard.activeProductsList.filter(
      (product) => !product.description?.trim(),
    ).length;
    const productsWithoutRecipe = dashboard.activeProductsList.filter(
      (product) => !Array.isArray(product.recipe) || product.recipe.length === 0,
    ).length;
    const productsWithoutWeight = dashboard.activeProductsList.filter(
      (product) => parseWeight(product.weight) <= 0,
    ).length;

    const scheduledLineIds = new Set(
      snapshot.schedules
        .filter((schedule) => schedule.status === "ativo")
        .map((schedule) => schedule.lineId),
    );
    const linesWithoutSchedule = dashboard.activeLines.filter(
      (line) => !scheduledLineIds.has(line.id),
    ).length;

    const storesWithoutResponsible = snapshot.stores.filter(
      (store) => store.status === "ativo" && !store.responsible?.trim(),
    ).length;

    return [
      {
        key: "produtos-sem-descricao",
        label: "Produtos sem descrição",
        value: productsWithoutDescription,
        href: "/gestor-dados/produtos",
        icon: FileText,
      },
      {
        key: "produtos-sem-receita",
        label: "Produtos sem receita",
        value: productsWithoutRecipe,
        href: "/gestor-dados/produtos",
        icon: ImageIcon,
      },
      {
        key: "produtos-sem-peso",
        label: "Produtos sem peso",
        value: productsWithoutWeight,
        href: "/gestor-dados/produtos",
        icon: Weight,
      },
      {
        key: "linhas-sem-cronograma",
        label: "Linhas sem cronograma ativo",
        value: linesWithoutSchedule,
        href: "/gestor-dados/linhas-producao",
        icon: Factory,
      },
      {
        key: "lojas-sem-responsavel",
        label: "Lojas sem responsável",
        value: storesWithoutResponsible,
        href: "/gestor-dados/lojas",
        icon: Store,
      },
    ];
  }, [dashboard.activeLines, dashboard.activeProductsList, snapshot.schedules, snapshot.stores]);

  const totalPendingAlerts = qualityAlerts.reduce((sum, alert) => sum + alert.value, 0);

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

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.22 }}
        className="grid gap-4 xl:grid-cols-[1fr_1.2fr]"
      >
        <Card>
          <CardHeader>
            <CardTitle>Cobertura de cadastros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="relative size-40">
                <div
                  className="size-full rounded-full border border-border/70"
                  style={coverageDonutStyle}
                  aria-hidden
                />
                <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full border border-border/70 bg-card">
                  <p className="text-xl font-semibold text-foreground tabular-nums">
                    {coverage.total === 0 ? "—" : `${coverage.completePct}%`}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    Completos
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {coverage.total === 0
                  ? "Nenhum produto ativo cadastrado."
                  : `${coverage.complete} de ${coverage.total} produtos têm descrição, receita e peso.`}
              </p>
            </div>

            <ul className="space-y-2 border-t border-border/70 pt-3">
              {(["description", "recipe", "weight"] as CoverageKey[]).map((key) => {
                const config = coverageConfig[key];
                const entry = coverage[key];
                return (
                  <li key={key} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 text-foreground">
                        <span className={`size-2 rounded-full ${config.barClassName}`} aria-hidden />
                        <span className="font-medium">{config.label}</span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {entry.count}/{coverage.total}
                        <span className="ml-1 opacity-70">({entry.pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel/60">
                      <div
                        className={`h-full ${config.barClassName} transition-[width] duration-500`}
                        style={{ width: `${entry.pct}%` }}
                        aria-hidden
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top linhas por produtos vinculados</CardTitle>
          </CardHeader>
          <CardContent>
            {topLines.ranked.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum produto ativo vinculado a uma linha.
              </p>
            ) : (
              <ul className="space-y-3">
                {topLines.ranked.map((entry, index) => {
                  const widthPct = topLines.max > 0 ? (entry.count / topLines.max) * 100 : 0;
                  return (
                    <li key={entry.lineId} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-baseline gap-2">
                          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground/80">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="truncate font-medium text-foreground">{entry.lineName}</span>
                          <span className="truncate text-[11px] text-muted-foreground/80">
                            {entry.sectorName}
                          </span>
                        </div>
                        <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{entry.count}</span>
                          <span className="ml-1 opacity-70">prod.</span>
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-panel/60">
                        <div
                          className="h-full rounded-full bg-info transition-[width] duration-500"
                          style={{ width: `${Math.max(widthPct, 3)}%` }}
                          aria-hidden
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.28 }}
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning-foreground" aria-hidden />
              Alertas de qualidade
            </CardTitle>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
                totalPendingAlerts > 0
                  ? "bg-warning/35 text-warning-foreground"
                  : "bg-success/30 text-success-foreground"
              }`}
            >
              {totalPendingAlerts} {totalPendingAlerts === 1 ? "pendência" : "pendências"}
            </span>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-panel/40">
              {qualityAlerts.map((alert) => {
                const Icon = alert.icon;
                const isClean = alert.value === 0;
                return (
                  <li key={alert.key}>
                    <Link
                      href={alert.href}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                    >
                      <span className="flex min-w-0 items-center gap-2.5 text-sm">
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate text-foreground">{alert.label}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span
                          className={`inline-flex min-w-9 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                            isClean
                              ? "bg-success/30 text-success-foreground"
                              : "bg-warning/40 text-warning-foreground"
                          }`}
                        >
                          {alert.value}
                        </span>
                        <span
                          aria-hidden
                          className="text-[11px] font-medium text-muted-foreground"
                        >
                          {isClean ? "ok" : "ver"}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </motion.div>
    </PageLayout>
  );
}
