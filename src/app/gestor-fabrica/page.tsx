"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CalendarRange,
  ChevronDown,
  ClipboardList,
  Factory,
  ListChecks,
  Settings2,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { InfoHint } from "@/components/shared/info-hint";
import { OperationalSequenceCard } from "@/components/shared/operational-sequence-card";
import { PageLayout } from "@/components/shared/page-layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeliveryExecution } from "@/lib/delivery-execution";
import type { PlannedOrderRow, ProductionOrderRow } from "@/lib/factory-planning/types";
import {
  filterFactoryPlanningDataByOperationalScope,
  type OperationalDateScopeMode,
} from "@/lib/operational-date-scope";
import type { OrderStatus } from "@/lib/order-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { formatKgLabel } from "@/lib/utils";

type KanbanTone = "warning" | "info" | "primary" | "success";

type KanbanColumnBase = {
  key: string;
  title: string;
  tone: KanbanTone;
  statuses: OrderStatus[];
};

type KanbanColumn =
  | (KanbanColumnBase & { kind: "orders"; items: PlannedOrderRow[] })
  | (KanbanColumnBase & { kind: "ops"; items: ProductionOrderRow[] });

const KANBAN_TONE_STYLES: Record<
  KanbanTone,
  { bar: string; count: string; eyebrow: string; ring: string }
> = {
  warning: {
    bar: "bg-warning",
    count: "text-warning",
    eyebrow: "text-warning",
    ring: "shadow-[var(--shadow-soft)] ring-1 ring-warning/20",
  },
  info: {
    bar: "bg-info",
    count: "text-info",
    eyebrow: "text-info",
    ring: "shadow-[var(--shadow-soft)] ring-1 ring-info/20",
  },
  primary: {
    bar: "bg-primary",
    count: "text-primary",
    eyebrow: "text-primary",
    ring: "shadow-[var(--shadow-soft)] ring-1 ring-primary/20",
  },
  success: {
    bar: "bg-success",
    count: "text-success",
    eyebrow: "text-success",
    ring: "shadow-[var(--shadow-soft)] ring-1 ring-success/20",
  },
};

export default function GestorFabricaPage() {
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } =
    useOperationalDateScope();
  const { planningData: planningSnapshot, isLoading, error, refresh: refreshPlanning } =
    useFactoryPlanningSnapshot(anchorDate);
  const { snapshot: masterDataSnapshot, refresh: refreshMasterData } = useMasterDataSnapshot();
  const planningData = useMemo(
    () => filterFactoryPlanningDataByOperationalScope(planningSnapshot, scope),
    [planningSnapshot, scope],
  );
  const deliveryExecution = useDeliveryExecution();
  const prefersReducedMotion = useReducedMotion();

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
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  const [expandedOpIds, setExpandedOpIds] = useState<Record<string, boolean>>({});

  function toggleOpExpansion(opId: string) {
    setExpandedOpIds((current) => ({ ...current, [opId]: !current[opId] }));
  }

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
    settingsDraft.expeditionLeadDays !==
      String(masterDataSnapshot.operationalSettings.expeditionLeadDays) ||
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
      const status = deliveryExecution.resolveExecution(
        item.orderId,
        item.status === "aguardando_expedicao",
      ).status;
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

  // Carga de produção do período: avanço agregado (donut) + ocupação por linha
  // (barras). Read-only, deriva tudo de planningData.productionOrders. Sem libs
  // de chart — mesma técnica artesanal do admin (conic-gradient + div width).
  const productionLoad = useMemo(() => {
    const ops = planningData.productionOrders;
    const totalKg = ops.reduce((sum, op) => sum + op.totalKg, 0);

    // Agrega kg por linha — top 4 por carga.
    const byLineMap = new Map<string, { lineName: string; totalKg: number; opsCount: number }>();
    ops.forEach((op) => {
      const current = byLineMap.get(op.lineId) ?? {
        lineName: op.lineName,
        totalKg: 0,
        opsCount: 0,
      };
      current.totalKg += op.totalKg;
      current.opsCount += 1;
      byLineMap.set(op.lineId, current);
    });
    const byLine = Array.from(byLineMap.entries())
      .map(([lineId, value]) => ({ lineId, ...value }))
      .sort((a, b) => b.totalKg - a.totalKg);
    const lineMaxKg = byLine.length > 0 ? byLine[0].totalKg : 0;

    // Avanço agregado em kg (% ponderado pela carga).
    let producedKg = 0;
    let inProgressKg = 0;
    let pendingKg = 0;
    ops.forEach((op) => {
      const progress = Math.max(0, Math.min(100, op.progress));
      if (op.status === "em_producao") {
        producedKg += (op.totalKg * progress) / 100;
        inProgressKg += op.totalKg * (1 - progress / 100);
      } else if (progress > 0) {
        producedKg += (op.totalKg * progress) / 100;
        pendingKg += op.totalKg * (1 - progress / 100);
      } else {
        pendingKg += op.totalKg;
      }
    });

    const safeTotal = totalKg > 0 ? totalKg : 1;
    const producedPct = (producedKg / safeTotal) * 100;
    const inProgressPct = (inProgressKg / safeTotal) * 100;
    const pendingPct = (pendingKg / safeTotal) * 100;

    return {
      totalKg,
      opsCount: ops.length,
      producedKg,
      inProgressKg,
      pendingKg,
      producedPct,
      inProgressPct,
      pendingPct,
      byLine,
      lineMaxKg,
    };
  }, [planningData.productionOrders]);

  const productionDonutStyle = useMemo<CSSProperties>(() => {
    if (productionLoad.totalKg <= 0) {
      return { background: "conic-gradient(var(--muted) 0 100%)" };
    }
    const segments: string[] = [];
    let cursor = 0;
    const push = (size: number, color: string) => {
      if (size <= 0) return;
      const end = cursor + size;
      segments.push(`${color} ${cursor}% ${end}%`);
      cursor = end;
    };
    push(productionLoad.producedPct, "oklch(0.86 0.07 148)");
    push(productionLoad.inProgressPct, "oklch(0.84 0.06 238)");
    push(productionLoad.pendingPct, "var(--muted)");
    if (segments.length === 0) {
      return { background: "conic-gradient(var(--muted) 0 100%)" };
    }
    return { background: `conic-gradient(${segments.join(", ")})` };
  }, [productionLoad]);

  // AJ-0001: Kanban read-only de acompanhamento. Só visualização + navegação
  // (deep-link p/ a lista filtrada — reaproveita o ?status do AJ-0002).
  // Não manipula status.
  // Mudança estrutural: a coluna "Em produção" agrupa por OP (a unidade real
  // de trabalho da fábrica); cada OP expande para revelar os pedidos que ela
  // cobre. As outras 3 colunas seguem pedido-centric.
  const kanbanColumns = useMemo<KanbanColumn[]>(() => {
    const orderColumns: Array<{
      key: string;
      title: string;
      tone: KanbanTone;
      statuses: OrderStatus[];
    }> = [
      { key: "aberto", title: "Aberto", tone: "warning", statuses: ["em_espera", "agendado"] },
      {
        key: "expedicao",
        title: "Aguardando expedição",
        tone: "primary",
        statuses: ["aguardando_expedicao"],
      },
      { key: "rota", title: "Em rota / entregue", tone: "success", statuses: ["rota_entrega"] },
    ];

    const mapped: KanbanColumn[] = orderColumns.map((column) => ({
      kind: "orders",
      key: column.key,
      title: column.title,
      tone: column.tone,
      statuses: column.statuses,
      items: planningData.orders
        .filter((order) => column.statuses.includes(order.status))
        .sort(
          (a, b) =>
            a.deliveryDate.localeCompare(b.deliveryDate) || a.code.localeCompare(b.code),
        ),
    }));

    const producaoColumn: KanbanColumn = {
      kind: "ops",
      key: "producao",
      title: "Em produção",
      tone: "info",
      statuses: ["em_producao"],
      items: planningData.productionOrders
        .filter((op) => op.status === "em_producao")
        .sort(
          (a, b) =>
            a.productionDate.localeCompare(b.productionDate) || a.code.localeCompare(b.code),
        ),
    };

    // Ordem visual: Aberto → Em produção → Aguardando expedição → Em rota.
    return [mapped[0], producaoColumn, mapped[1], mapped[2]];
  }, [planningData.orders, planningData.productionOrders]);

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
        helper:
          "O cronograma procura um dia de produção compatível entre a base operacional e a data prometida para entregar.",
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
        message:
          saveError instanceof Error ? saveError.message : "Falha ao salvar regras operacionais.",
      });
    } finally {
      setIsSavingSettings(false);
    }
  }

  const scopeLabel = useMemo(() => {
    if (scope.mode === "all") return "Todo o período";
    if (scope.mode === "day") return scope.date;
    return `${scope.startDate} → ${scope.endDate}`;
  }, [scope]);

  const shortcuts = useMemo(
    () => [
      {
        href: "/gestor-fabrica/sublinhas-producao",
        label: "Auditoria do cronograma",
        icon: ClipboardList,
        meta: `${planningData.productionDates.length} datas`,
      },
      {
        href: "/gestor-fabrica/pedidos",
        label: "Pedidos",
        icon: ShoppingCart,
        meta: `${metrics.totalOrders} no período`,
      },
      {
        href: "/gestor-fabrica/ordens-producao",
        label: "Ordens de produção",
        icon: Factory,
        meta: `${metrics.productionOrders} OPs`,
      },
      {
        href: "/gestor-fabrica/expedicao",
        label: "Expedição",
        icon: ListChecks,
        meta: `${metrics.checklistPending} checklist`,
      },
    ],
    [
      metrics.checklistPending,
      metrics.productionOrders,
      metrics.totalOrders,
      planningData.productionDates.length,
    ],
  );

  const motionEnabled = !prefersReducedMotion;

  return (
    <PageLayout
      title="Gestor de Fábrica"
      description="Acompanhamento operacional dos pedidos, da produção e da expedição em uma única visão."
      badge="Operacional"
      breadcrumbs={[{ label: "Início", href: "/" }, { label: "Gestor de Fábrica" }]}
    >
      {/* Action bar — escopo + chips + regras, tudo em uma linha enxuta. */}
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={isScopeOpen} onOpenChange={setIsScopeOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-[var(--shadow-soft)] transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Ajustar janela operacional"
              >
                <CalendarRange className="size-3.5 text-muted-foreground" aria-hidden />
                <span className="text-muted-foreground">Janela:</span>
                <span className="font-semibold">{scopeLabel}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[320px] space-y-3 p-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Janela operacional
                </p>
                <p className="text-xs text-muted-foreground">{summary}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Modo</Label>
                <Select
                  value={scope.mode}
                  onValueChange={(value) => setMode(value as OperationalDateScopeMode)}
                >
                  <SelectTrigger className="bg-background/80">
                    <SelectValue placeholder="Selecionar modo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo o período</SelectItem>
                    <SelectItem value="day">Data específica</SelectItem>
                    <SelectItem value="range">Período fechado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {scope.mode === "day" ? (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Data</Label>
                  <Input
                    type="date"
                    value={scope.date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </div>
              ) : null}
              {scope.mode === "range" ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">De</Label>
                    <Input
                      type="date"
                      value={scope.startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Até</Label>
                    <Input
                      type="date"
                      value={scope.endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </PopoverContent>
          </Popover>

        </div>

        <Dialog open={isRulesOpen} onOpenChange={setIsRulesOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings2 className="size-3.5" aria-hidden />
              Regras
              {isSettingsDirty ? (
                <span
                  className="ms-1 inline-block size-1.5 rounded-full bg-warning"
                  aria-label="Alterações pendentes"
                />
              ) : null}
            </Button>
          </DialogTrigger>
          <DialogContent size="xl" className="gap-5">
            <DialogHeader>
              <DialogTitle>Regras globais de pedido e expedição</DialogTitle>
              <DialogDescription>{settingsSummary}</DialogDescription>
            </DialogHeader>

            {isSettingsDirty ? (
              <div
                role="status"
                className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground"
              >
                Existem alterações pendentes nas regras de expedição.
              </div>
            ) : null}

            {settingsFeedback ? (
              <div
                role={settingsFeedback.tone === "success" ? "status" : "alert"}
                className={
                  settingsFeedback.tone === "success"
                    ? "rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success-foreground"
                    : "rounded-xl border border-danger/35 bg-danger/15 px-4 py-3 text-sm text-danger-foreground"
                }
              >
                {settingsFeedback.message}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
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
            </div>

            <details className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Como a regra cascateia no fluxo
              </summary>
              <div className="mt-3">
                <OperationalSequenceCard
                  eyebrow="Relação entre produção e expedição"
                  title="A regra global sempre segue esta ordem"
                  description="Assim a fábrica transforma a regra operacional em datas que a loja consegue entender e acompanhar."
                  steps={operationalRuleSteps}
                  footer="Resumo da regra: a entrega nasce do D+X sobre a base operacional; a produção é calculada para acontecer antes dessa entrega; a venda começa depois que a loja recebe."
                />
              </div>
            </details>

            <DialogFooter className="items-center">
              <div className="me-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <InfoHint
                  size="sm"
                  content="Esse ajuste impacta o catálogo da loja, a promessa de recebimento e o planejamento da expedição."
                />
                <span>Impacta catálogo, promessa de entrega e planejamento.</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsRulesOpen(false)}
                disabled={isSavingSettings}
              >
                Fechar
              </Button>
              <Button
                type="button"
                onClick={() => void handleSaveOperationalSettings()}
                disabled={!settingsFormIsValid || !isSettingsDirty || isSavingSettings}
              >
                {isSavingSettings ? "Salvando..." : "Salvar regras"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/35 bg-danger/15 px-4 py-3 text-sm text-danger-foreground"
        >
          {error}
        </div>
      ) : null}

      {/* Micro-linha de contexto: chips informativos antigos viram texto de fundo.
          O termo "Acompanhamento" continua no DOM (sr-only) p/ o e2e. */}
      <div className="flex items-center justify-between gap-3 text-[11px] tabular-nums text-muted-foreground/80">
        <span className="sr-only">Acompanhamento</span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href="/chao-fabrica/entregas?status=em_rota"
            className="inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="font-medium text-foreground/80">{metrics.deliveriesInField}</span>
            <span>em campo</span>
          </Link>
          <span aria-hidden className="text-muted-foreground/40">
            ·
          </span>
          <Link
            href="/gestor-fabrica/expedicao"
            className="inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="font-medium text-foreground/80">{metrics.checklistPending}</span>
            <span>checklist pendente</span>
          </Link>
        </div>
        <InfoHint
          size="sm"
          content="Visão read-only do fluxo. A coluna de produção lista ordens (OPs); as outras listam pedidos. Clique em uma coluna ou OP para abrir a lista filtrada. O status não é alterado por aqui."
        />
      </div>

      {/* Carga de produção do período — leitura agregada que o Kanban não dá:
          avanço total (donut) + ocupação por linha (barras). Read-only. */}
      {productionLoad.opsCount > 0 ? (
        <section
          aria-labelledby="production-load-title"
          className="grid gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-soft)] ring-1 ring-border/40 md:grid-cols-[auto_1fr]"
        >
          <div className="flex items-center gap-3 md:flex-col md:items-center md:justify-center md:gap-2 md:pe-4 md:border-e md:border-border/40">
            <div className="relative size-24 shrink-0">
              <div
                aria-hidden
                className="size-full rounded-full"
                style={productionDonutStyle}
              />
              <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-card">
                <span className="font-heading text-lg font-bold leading-none tabular-nums text-foreground">
                  {productionLoad.totalKg > 0
                    ? `${Math.round(productionLoad.producedPct)}%`
                    : "—"}
                </span>
                <span className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                  Avanço
                </span>
              </div>
            </div>
            <div className="min-w-0 md:text-center">
              <p
                id="production-load-title"
                className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Carga do período
              </p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-foreground">
                {formatKgLabel(productionLoad.totalKg)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {productionLoad.opsCount} {productionLoad.opsCount === 1 ? "OP" : "OPs"}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <header className="flex items-baseline justify-between gap-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Ocupação por linha
              </h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden className="size-1.5 rounded-full bg-success" />
                  Concluído
                </span>
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden className="size-1.5 rounded-full bg-info" />
                  Em andamento
                </span>
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden className="size-1.5 rounded-full bg-muted" />
                  Pendente
                </span>
              </div>
            </header>
            {productionLoad.byLine.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground/60">
                Sem ordens de produção no período.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {productionLoad.byLine.slice(0, 4).map((line) => {
                  const widthPct =
                    productionLoad.lineMaxKg > 0
                      ? Math.max(2, (line.totalKg / productionLoad.lineMaxKg) * 100)
                      : 0;
                  return (
                    <li
                      key={line.lineId}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 text-xs"
                    >
                      <span className="truncate font-medium text-foreground">
                        {line.lineName}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatKgLabel(line.totalKg)}
                        <span className="ml-1 text-muted-foreground/70">
                          · {line.opsCount} {line.opsCount === 1 ? "OP" : "OPs"}
                        </span>
                      </span>
                      <div
                        aria-hidden
                        className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted/60"
                      >
                        <div
                          className="h-full rounded-full bg-info"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {/* Kanban — protagonista. Coluna "Em produção" lista OPs (unidade real
          de trabalho); demais colunas listam pedidos. */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kanbanColumns.map((column, columnIndex) => {
          const tone = KANBAN_TONE_STYLES[column.tone];
          const isEmpty = column.items.length === 0;
          return (
            <motion.section
              key={column.key}
              initial={motionEnabled ? { opacity: 0, y: 8 } : false}
              animate={motionEnabled ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.2, delay: motionEnabled ? columnIndex * 0.04 : 0 }}
              className={`group relative flex min-h-[420px] flex-col gap-3 overflow-hidden rounded-2xl bg-card p-4 ${tone.ring}`}
              aria-labelledby={`kanban-${column.key}-title`}
            >
              <span
                aria-hidden
                className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${tone.bar}`}
              />
              <header className="flex items-baseline justify-between gap-3 pl-2">
                <Link
                  href={`/gestor-fabrica/pedidos?status=${column.statuses[0]}`}
                  className="block min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-md"
                  aria-label={`Abrir lista de pedidos ${column.title}`}
                >
                  <span
                    className={`font-heading text-4xl font-bold leading-none tabular-nums ${tone.count} sm:text-5xl`}
                  >
                    {column.items.length}
                  </span>
                  <span
                    id={`kanban-${column.key}-title`}
                    className={`mt-2 block text-[10px] font-semibold uppercase tracking-[0.14em] ${tone.eyebrow}`}
                  >
                    {column.title}
                  </span>
                </Link>
                {isLoading && isEmpty ? (
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Carregando…
                  </span>
                ) : null}
              </header>

              <div className="scroll-modern -mx-1 flex max-h-[360px] flex-col gap-1 overflow-y-auto px-1 pl-2">
                {isEmpty ? (
                  <p
                    aria-label="Nenhum item nesta etapa"
                    className="select-none py-3 text-center text-xs text-muted-foreground/40"
                  >
                    —
                  </p>
                ) : column.kind === "orders" ? (
                  column.items.map((order) => (
                    <Link
                      key={order.id}
                      href={`/gestor-fabrica/pedidos?status=${order.status}`}
                      className="group/order flex items-center justify-between gap-2 rounded-md px-2 py-1.5 leading-tight transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-xs font-semibold text-foreground">
                          {order.code}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {order.storeName}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                        {order.deliveryDateLabel}
                      </span>
                    </Link>
                  ))
                ) : (
                  column.items.map((op) => {
                    const isOpen = !!expandedOpIds[op.id];
                    const progress = Math.max(0, Math.min(100, op.progress));
                    const progressLabel =
                      progress <= 0
                        ? "iniciada"
                        : `${progress.toFixed(progress < 10 ? 1 : 0)}%`;
                    return (
                      <div
                        key={op.id}
                        className="rounded-md transition-colors hover:bg-muted/50 focus-within:bg-muted/50"
                      >
                        <button
                          type="button"
                          onClick={() => toggleOpExpansion(op.id)}
                          aria-expanded={isOpen}
                          aria-controls={`op-${op.id}-orders`}
                          className="block w-full rounded-md px-2 py-1.5 text-left leading-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate font-mono text-xs font-semibold text-foreground">
                              {op.code}
                            </span>
                            <span className="shrink-0 truncate text-[10px] text-muted-foreground">
                              {op.lineName} · {op.sectorName}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div
                              aria-hidden
                              className="relative h-1 flex-1 overflow-hidden rounded-full bg-muted"
                            >
                              <motion.div
                                className={`absolute inset-y-0 left-0 rounded-full ${tone.bar}`}
                                initial={motionEnabled ? { width: 0 } : false}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: motionEnabled ? 0.4 : 0 }}
                              />
                            </div>
                            <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground">
                              {progressLabel}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {formatKgLabel(op.totalKg)}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[11px] ${tone.count}`}>
                              <span className="tabular-nums font-medium">{op.ordersCount}</span>
                              <span className="text-muted-foreground">
                                {op.ordersCount === 1 ? "pedido" : "pedidos"}
                              </span>
                              <ChevronDown
                                aria-hidden
                                className={`size-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                              />
                            </span>
                          </div>
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen ? (
                            <motion.div
                              key="orders"
                              id={`op-${op.id}-orders`}
                              initial={motionEnabled ? { height: 0, opacity: 0 } : false}
                              animate={
                                motionEnabled
                                  ? { height: "auto", opacity: 1 }
                                  : { height: "auto", opacity: 1 }
                              }
                              exit={motionEnabled ? { height: 0, opacity: 0 } : { opacity: 0 }}
                              transition={{ duration: motionEnabled ? 0.2 : 0 }}
                              className="overflow-hidden"
                            >
                              <ul className="mt-0.5 space-y-0.5 border-l border-border/40 py-1 pl-2 ms-3">
                                {op.orderCodes.length === 0 ? (
                                  <li className="px-2 py-1 text-[11px] text-muted-foreground/60">
                                    Sem pedidos vinculados.
                                  </li>
                                ) : (
                                  op.orderCodes.map((code) => (
                                    <li key={code}>
                                      <Link
                                        href={`/gestor-fabrica/pedidos?status=em_producao`}
                                        className="block truncate rounded px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                      >
                                        {code}
                                      </Link>
                                    </li>
                                  ))
                                )}
                              </ul>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.section>
          );
        })}
      </div>

      {/* Atalhos rápidos — pílulas mínimas, supporting cast. */}
      <nav aria-label="Atalhos" className="flex flex-wrap gap-1.5">
        {shortcuts.map((shortcut) => (
          <Link
            key={shortcut.href}
            href={shortcut.href}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <shortcut.icon className="size-3 text-muted-foreground" aria-hidden />
            <span>{shortcut.label}</span>
            <span className="tabular-nums text-muted-foreground/70">{shortcut.meta}</span>
          </Link>
        ))}
      </nav>
    </PageLayout>
  );
}
