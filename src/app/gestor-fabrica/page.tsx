"use client";

import { motion } from "framer-motion";
import {
  CalendarClock,
  ClipboardList,
  Clock,
  Factory,
  ListChecks,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { ModuleCard } from "@/components/shared/module-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeliveryExecution } from "@/lib/delivery-execution";
import { filterFactoryPlanningDataByOperationalScope } from "@/lib/operational-date-scope";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";

export default function GestorFabricaPage() {
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const { planningData: planningSnapshot, isLoading, error, refresh: refreshPlanning } =
    useFactoryPlanningSnapshot(anchorDate);
  const { snapshot: masterDataSnapshot, refresh: refreshMasterData } = useMasterDataSnapshot();
  const planningData = useMemo(
    () => filterFactoryPlanningDataByOperationalScope(planningSnapshot, scope),
    [planningSnapshot, scope],
  );
  const deliveryExecution = useDeliveryExecution();
  const [settingsDraft, setSettingsDraft] = useState({
    orderCutoffTime: masterDataSnapshot.operationalSettings.orderCutoffTime,
    expeditionLeadDays: String(masterDataSnapshot.operationalSettings.expeditionLeadDays),
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    setSettingsDraft({
      orderCutoffTime: masterDataSnapshot.operationalSettings.orderCutoffTime,
      expeditionLeadDays: String(masterDataSnapshot.operationalSettings.expeditionLeadDays),
    });
  }, [
    masterDataSnapshot.operationalSettings.expeditionLeadDays,
    masterDataSnapshot.operationalSettings.orderCutoffTime,
  ]);

  const isSettingsDirty =
    settingsDraft.orderCutoffTime !== masterDataSnapshot.operationalSettings.orderCutoffTime ||
    settingsDraft.expeditionLeadDays !== String(masterDataSnapshot.operationalSettings.expeditionLeadDays);
  const expeditionLeadDaysValue = Number(settingsDraft.expeditionLeadDays);
  const settingsFormIsValid =
    /^\d{2}:\d{2}$/.test(settingsDraft.orderCutoffTime) &&
    Number.isInteger(expeditionLeadDaysValue) &&
    expeditionLeadDaysValue >= 0 &&
    expeditionLeadDaysValue <= 30;

  useUnsavedChangesGuard({
    isDirty: isSettingsDirty,
    message: "Existem alterações pendentes nas regras de expedição. Deseja sair mesmo assim?",
  });

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

  const settingsSummary = useMemo(() => {
    const leadDaysLabel = Number.isFinite(expeditionLeadDaysValue)
      ? `D+${Math.max(0, expeditionLeadDaysValue)}`
      : `D+${masterDataSnapshot.operationalSettings.expeditionLeadDays}`;

    return `Pedidos feitos até ${settingsDraft.orderCutoffTime || masterDataSnapshot.operationalSettings.orderCutoffTime} mantêm a base do dia. Após esse horário, a expedição passa a considerar a próxima base operacional e entrega padrão em ${leadDaysLabel}.`;
  }, [
    expeditionLeadDaysValue,
    masterDataSnapshot.operationalSettings.expeditionLeadDays,
    masterDataSnapshot.operationalSettings.orderCutoffTime,
    settingsDraft.orderCutoffTime,
  ]);

  async function handleSaveOperationalSettings() {
    if (!settingsFormIsValid || isSavingSettings) {
      return;
    }

    setIsSavingSettings(true);
    setSettingsFeedback(null);

    try {
      const response = await fetch("/api/master-data/operational-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderCutoffTime: settingsDraft.orderCutoffTime,
          expeditionLeadDays: expeditionLeadDaysValue,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Falha ao salvar regras operacionais.");
      }

      await Promise.all([refreshMasterData(true), refreshPlanning(true)]);
      setSettingsFeedback({
        tone: "success",
        message: "Regras de pedido e expedição atualizadas com sucesso.",
      });
    } catch (saveError) {
      setSettingsFeedback({
        tone: "error",
        message: saveError instanceof Error ? saveError.message : "Falha ao salvar regras operacionais.",
      });
    } finally {
      setIsSavingSettings(false);
    }
  }

  const modules = useMemo(
    () => [
      {
        href: "/gestor-fabrica/sublinhas-producao",
        title: "Linhas - Subcategoria",
        subtitle: "Auditoria e grade por subcategoria",
        description: "Acompanhe a linha executora derivada das subcategorias e a carga consolidada por dia.",
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

      <Card>
        <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <CalendarClock className="size-4" />
              Expedição
            </div>
            <CardTitle className="text-base">Regras globais de pedido e expedição</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ajuste o horário limite do pedido e o prazo D+X usado pela fábrica para prometer recebimento às lojas.
            </p>
          </div>
          <div className="max-w-xl rounded-2xl border border-border/70 bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
            {settingsSummary}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSettingsDirty ? (
            <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Existem alterações pendentes nas regras de expedição.
            </div>
          ) : null}

          {settingsFeedback ? (
            <div
              className={
                settingsFeedback.tone === "success"
                  ? "rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                  : "rounded-xl border border-danger/35 bg-danger/15 px-4 py-3 text-sm text-danger-foreground"
              }
            >
              {settingsFeedback.message}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,240px)_minmax(0,220px)_1fr] xl:items-end">
            <div className="space-y-2">
              <Label htmlFor="factory-order-cutoff-time">Horário limite do pedido</Label>
              <Input
                id="factory-order-cutoff-time"
                type="time"
                value={settingsDraft.orderCutoffTime}
                onChange={(event) => {
                  setSettingsDraft((current) => ({
                    ...current,
                    orderCutoffTime: event.target.value,
                  }));
                  setSettingsFeedback(null);
                }}
                disabled={isSavingSettings}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="factory-expedition-lead-days">Prazo de expedição (D+X)</Label>
              <Input
                id="factory-expedition-lead-days"
                type="number"
                min={0}
                max={30}
                step={1}
                value={settingsDraft.expeditionLeadDays}
                onChange={(event) => {
                  setSettingsDraft((current) => ({
                    ...current,
                    expeditionLeadDays: event.target.value,
                  }));
                  setSettingsFeedback(null);
                }}
                disabled={isSavingSettings}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => void handleSaveOperationalSettings()}
                disabled={!settingsFormIsValid || !isSettingsDirty || isSavingSettings}
              >
                {isSavingSettings ? "Salvando..." : "Salvar regras"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Esse ajuste impacta o catálogo da loja, a promessa de recebimento e o planejamento da expedição.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
