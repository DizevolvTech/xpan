"use client";

import Link from "next/link";
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

import { InfoHint } from "@/components/shared/info-hint";
import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { OperationalSequenceCard } from "@/components/shared/operational-sequence-card";
import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { ModuleCard } from "@/components/shared/module-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeliveryExecution } from "@/lib/delivery-execution";
import { filterFactoryPlanningDataByOperationalScope } from "@/lib/operational-date-scope";
import type { OrderStatus } from "@/lib/order-planning";
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
    saleLeadDays: String(masterDataSnapshot.operationalSettings.saleLeadDays),
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
      saleLeadDays: String(masterDataSnapshot.operationalSettings.saleLeadDays),
    });
  }, [
    masterDataSnapshot.operationalSettings.expeditionLeadDays,
    masterDataSnapshot.operationalSettings.orderCutoffTime,
    masterDataSnapshot.operationalSettings.saleLeadDays,
  ]);

  const isSettingsDirty =
    settingsDraft.orderCutoffTime !== masterDataSnapshot.operationalSettings.orderCutoffTime ||
    settingsDraft.expeditionLeadDays !== String(masterDataSnapshot.operationalSettings.expeditionLeadDays) ||
    settingsDraft.saleLeadDays !== String(masterDataSnapshot.operationalSettings.saleLeadDays);
  const expeditionLeadDaysValue = Number(settingsDraft.expeditionLeadDays);
  const saleLeadDaysValue = Number(settingsDraft.saleLeadDays);
  const settingsFormIsValid =
    /^\d{2}:\d{2}$/.test(settingsDraft.orderCutoffTime) &&
    Number.isInteger(expeditionLeadDaysValue) &&
    expeditionLeadDaysValue >= 0 &&
    expeditionLeadDaysValue <= 30 &&
    Number.isInteger(saleLeadDaysValue) &&
    saleLeadDaysValue >= 0 &&
    saleLeadDaysValue <= 30;

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

  // AJ-0001: Kanban read-only de acompanhamento. Só visualização + navegação
  // (deep-link p/ a lista filtrada — reaproveita o ?status do AJ-0002).
  // Não manipula status.
  const kanbanColumns = useMemo(() => {
    const columns: Array<{
      key: string;
      title: string;
      accent: string;
      statuses: OrderStatus[];
    }> = [
      { key: "aberto", title: "Aberto", accent: "border-info/50 bg-info/5", statuses: ["em_espera", "agendado"] },
      { key: "producao", title: "Em produção", accent: "border-warning/50 bg-warning/5", statuses: ["em_producao"] },
      {
        key: "expedicao",
        title: "Aguardando expedição",
        accent: "border-primary/50 bg-primary/5",
        statuses: ["aguardando_expedicao"],
      },
      { key: "rota", title: "Em rota / entregue", accent: "border-success/50 bg-success/5", statuses: ["rota_entrega"] },
    ];

    return columns.map((column) => ({
      ...column,
      orders: planningData.orders
        .filter((order) => column.statuses.includes(order.status))
        .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate) || a.code.localeCompare(b.code)),
    }));
  }, [planningData.orders]);

  const settingsSummary = useMemo(() => {
    const leadDaysLabel = Number.isFinite(expeditionLeadDaysValue)
      ? `D+${Math.max(0, expeditionLeadDaysValue)}`
      : `D+${masterDataSnapshot.operationalSettings.expeditionLeadDays}`;

    return `Pedidos feitos até ${settingsDraft.orderCutoffTime || masterDataSnapshot.operationalSettings.orderCutoffTime} mantêm a base do dia. Depois disso, a base avança para o próximo dia operacional, a entrega é prometida em ${leadDaysLabel} e a produção precisa caber antes dessa data.`;
  }, [
    expeditionLeadDaysValue,
    masterDataSnapshot.operationalSettings.expeditionLeadDays,
    masterDataSnapshot.operationalSettings.orderCutoffTime,
    settingsDraft.orderCutoffTime,
  ]);
  const operationalRuleSteps = useMemo(
    () => [
      {
        key: "ordered",
        label: "Pedido",
        value: `Até ${settingsDraft.orderCutoffTime || masterDataSnapshot.operationalSettings.orderCutoffTime}`,
        helper: "Dentro do cutoff, a base pode continuar no mesmo dia.",
        tone: "neutral" as const,
      },
      {
        key: "base",
        label: "Base operacional",
        value: "Mesmo dia ou próximo dia válido",
        helper: "Se o pedido passar do cutoff ou cair fora do dia operacional da loja, a base avança.",
        tone: "info" as const,
      },
      {
        key: "production",
        label: "Produção",
        value: "Antes da entrega",
        helper: "O cronograma procura um dia de produção compatível entre a base operacional e a data prometida para entregar.",
        tone: "warning" as const,
      },
      {
        key: "delivery",
        label: "Expedir / entregar",
        value: Number.isFinite(expeditionLeadDaysValue)
          ? `D+${Math.max(0, expeditionLeadDaysValue)} da base`
          : `D+${masterDataSnapshot.operationalSettings.expeditionLeadDays} da base`,
        helper: "Essa é a promessa mostrada para a loja no catálogo e no pedido.",
        tone: "warning" as const,
      },
      {
        key: "sale",
        label: "Venda",
        value: "Depois da entrega",
        helper: "A venda prevista começa após a entrega, respeitando o lead configurado no produto.",
        tone: "success" as const,
      },
    ],
    [
      expeditionLeadDaysValue,
      masterDataSnapshot.operationalSettings.expeditionLeadDays,
      masterDataSnapshot.operationalSettings.orderCutoffTime,
      settingsDraft.orderCutoffTime,
    ],
  );

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
          saleLeadDays: saleLeadDaysValue,
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
        title: "Auditoria do cronograma ativo",
        subtitle: "Auditoria e grade por linha de produção",
        description: "Acompanhe o cronograma ativo das linhas de produção e a carga consolidada por dia.",
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
        subtitle: "OP por categoria e linha de produção",
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
            <CardTitle className="flex items-center gap-1.5 text-base">
              Regras globais de pedido e expedição
              <InfoHint
                size="sm"
                content="Ajuste o horário limite do pedido e o prazo D+X usado pela fábrica para prometer recebimento às lojas. A produção sempre é derivada para caber antes dessa entrega."
              />
            </CardTitle>
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

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,200px)_minmax(0,180px)_minmax(0,180px)_1fr] xl:items-end">
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

            <div className="space-y-2">
              <Label htmlFor="factory-sale-lead-days">Prazo de venda (após entrega)</Label>
              <Input
                id="factory-sale-lead-days"
                type="number"
                min={0}
                max={30}
                step={1}
                value={settingsDraft.saleLeadDays}
                onChange={(event) => {
                  setSettingsDraft((current) => ({
                    ...current,
                    saleLeadDays: event.target.value,
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
              <InfoHint
                size="sm"
                content="Esse ajuste impacta o catálogo da loja, a promessa de recebimento e o planejamento da expedição."
              />
            </div>
          </div>

          <OperationalSequenceCard
            eyebrow="Relação entre produção e expedição"
            title="A regra global sempre segue esta ordem"
            description="Assim a fábrica transforma a regra operacional em datas que a loja consegue entender e acompanhar."
            steps={operationalRuleSteps}
            footer="Resumo da regra: a entrega nasce do D+X sobre a base operacional; a produção é calculada para acontecer antes dessa entrega; a venda começa depois que a loja recebe."
          />
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
          href="/gestor-fabrica/pedidos"
        />
        <KPICard
          title="Aguardando liberação"
          value={isLoading ? "..." : metrics.awaitingRelease}
          tone="warning"
          icon={Clock}
          compactValue
          href="/gestor-fabrica/pedidos?status=em_espera"
        />
        <KPICard
          title="Em produção"
          value={isLoading ? "..." : metrics.inProduction}
          tone="info"
          icon={Factory}
          compactValue
          href="/gestor-fabrica/ordens-producao?status=em_producao"
        />
        <KPICard
          title="Checklist pendente"
          value={isLoading ? "..." : metrics.checklistPending}
          tone="success"
          icon={ListChecks}
          compactValue
          href="/gestor-fabrica/expedicao"
        />
        <KPICard
          title="Entregas em campo"
          value={isLoading ? "..." : metrics.deliveriesInField}
          tone="neutral"
          icon={Truck}
          compactValue
          href="/chao-fabrica/entregas?status=em_rota"
        />
      </motion.div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-1.5">
          <CardTitle>Acompanhamento</CardTitle>
          <InfoHint
            size="sm"
            content="Visão read-only dos pedidos por etapa. Clique em um card para abrir a lista de pedidos já filtrada pela etapa. O status não é alterado por aqui."
          />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {kanbanColumns.map((column) => (
              <div
                key={column.key}
                className={`flex flex-col gap-2 rounded-xl border p-3 ${column.accent}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground">
                    {column.title}
                  </p>
                  <span className="rounded-full bg-background/70 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {column.orders.length}
                  </span>
                </div>
                <div className="flex max-h-[360px] flex-col gap-2 overflow-auto">
                  {column.orders.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border/60 px-2 py-3 text-center text-xs text-muted-foreground">
                      Nenhum pedido nesta etapa.
                    </p>
                  ) : (
                    column.orders.map((order) => (
                      <Link
                        key={order.id}
                        href={`/gestor-fabrica/pedidos?status=${order.status}`}
                        className="rounded-lg border border-border/70 bg-card px-3 py-2 text-sm transition-colors hover:border-primary/50 hover:bg-panel/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-foreground">{order.code}</span>
                          <span className="text-xs text-muted-foreground">{order.deliveryDateLabel}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{order.storeName}</p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
