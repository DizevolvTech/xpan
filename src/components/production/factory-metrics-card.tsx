"use client";

import { useEffect, useState } from "react";
import { Activity, AlertOctagon, Boxes, Gauge, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/shared/info-hint";

interface LeadTimePerStage {
  stage: string;
  averageMinutes: number;
  samples: number;
}

interface ThroughputPerStage {
  stage: string;
  itemsCount: number;
  perDay: number;
}

interface LineOccupancy {
  lineId: string;
  lineName: string;
  capacityKg: number;
  scheduledKg: number;
  occupancyPercent: number;
}

interface DeliveryFailureBreakdown {
  reason: string;
  count: number;
}

interface FactoryMetricsResult {
  referenceDate: string;
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  leadTime: {
    averageTotalMinutes: number;
    perStage: LeadTimePerStage[];
    samples: number;
  };
  throughput: {
    perStage: ThroughputPerStage[];
    windowDays: number;
  };
  otif: {
    deliveredOnTime: number;
    deliveredLate: number;
    pending: number;
    otifPercent: number;
  };
  occupancy: {
    lines: LineOccupancy[];
    averageOccupancyPercent: number;
    busiestLine: LineOccupancy | null;
  };
  deliveryFailures: {
    total: number;
    breakdown: DeliveryFailureBreakdown[];
  };
}

type FetchState =
  | { kind: "loading" }
  | { kind: "ready"; metrics: FactoryMetricsResult }
  | { kind: "error"; message: string };

const STAGE_LABELS: Record<string, string> = {
  nao_iniciado: "Não iniciado",
  em_preparacao: "Em preparação",
  em_producao: "Em produção",
  em_forno: "No forno",
  embalando: "Embalando",
  concluido: "Concluído",
};

const FAILURE_REASON_LABELS: Record<string, string> = {
  cliente_ausente: "Cliente ausente",
  endereco_errado: "Endereço errado",
  recusa_cliente: "Recusa do cliente",
  estabelecimento_fechado: "Estabelecimento fechado",
  veiculo_avaria: "Avaria no veículo",
  acesso_bloqueado: "Acesso bloqueado",
  documentacao_pendente: "Documentação pendente",
  outro: "Outro motivo",
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes - hours * 60);
  return rest > 0 ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

interface FactoryMetricsCardProps {
  referenceDate: string;
  windowDays?: number;
}

export function FactoryMetricsCard({
  referenceDate,
  windowDays = 7,
}: FactoryMetricsCardProps) {
  // Estado em union — evita múltiplos setState no effect; remount via key no
  // consumer garante state fresco em mudança de janela.
  const [state, setState] = useState<FetchState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/factory-planning/metrics?referenceDate=${encodeURIComponent(referenceDate)}&windowDays=${windowDays}`,
    )
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(payload?.message ?? "Falha ao carregar métricas");
        }
        return (await response.json()) as FactoryMetricsResult;
      })
      .then((metrics) => {
        if (cancelled) return;
        setState({ kind: "ready", metrics });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "Falha ao carregar métricas",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [referenceDate, windowDays]);

  return (
    <Card>
      <CardHeader className="border-b border-border/60">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CardTitle>Métricas operacionais</CardTitle>
            <InfoHint content="Lead time vem dos eventos de OP (A5). OTIF compara entregas vs delivery_date no período. Ocupação cruza demanda agendada com capacidade da linha." />
          </div>
          {state.kind === "ready" ? (
            <span className="text-xs text-muted-foreground">
              {state.metrics.windowStart} → {state.metrics.windowEnd} · janela de {state.metrics.windowDays} dia(s)
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {state.kind === "loading" ? (
          <p className="text-sm text-muted-foreground">Calculando métricas…</p>
        ) : state.kind === "error" ? (
          <p className="text-sm text-destructive">{state.message}</p>
        ) : (
          <MetricsContent metrics={state.metrics} />
        )}
      </CardContent>
    </Card>
  );
}

function MetricsContent({ metrics }: { metrics: FactoryMetricsResult }) {
  const { leadTime, throughput, otif, occupancy, deliveryFailures } = metrics;
  const totalThroughput = throughput.perStage.reduce((sum, row) => sum + row.itemsCount, 0);
  const concluidoThroughput =
    throughput.perStage.find((row) => row.stage === "concluido") ?? null;
  // Sem amostras → tom NEUTRO. Evita pintar de vermelho um KPI que só está sem
  // dados (ex.: OTIF "—" sem entregas no período não é "ruim", é ausência de dado).
  const hasLeadTime = leadTime.samples > 0;
  const hasOtif = otif.deliveredOnTime + otif.deliveredLate > 0;
  const hasOccupancy = occupancy.lines.length > 0;
  const leadTimeTone = hasLeadTime ? "info" : "neutral";
  const otifTone = !hasOtif
    ? "neutral"
    : otif.otifPercent >= 95
      ? "success"
      : otif.otifPercent >= 80
        ? "warning"
        : "danger";
  const occupancyTone = !hasOccupancy
    ? "neutral"
    : occupancy.averageOccupancyPercent >= 90
      ? "danger"
      : occupancy.averageOccupancyPercent >= 70
        ? "warning"
        : "info";

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <MetricTile
        icon={Activity}
        title="Lead time médio"
        value={leadTime.samples > 0 ? formatMinutes(leadTime.averageTotalMinutes) : "—"}
        helper={leadTime.samples > 0 ? `${leadTime.samples} item(ns) com >1 evento` : "Sem amostras no período"}
        tone={leadTimeTone}
      >
        {leadTime.perStage.length > 0 ? (
          <>
            <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
              {leadTime.perStage.map((row) => (
                <li key={row.stage} className="flex justify-between gap-2">
                  <span>{STAGE_LABELS[row.stage] ?? row.stage}</span>
                  <span className="font-medium text-foreground/80">{formatMinutes(row.averageMinutes)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-muted-foreground/80">
              Médias por etapa — não somam o total.
            </p>
          </>
        ) : null}
      </MetricTile>

      <MetricTile
        icon={Boxes}
        title="Throughput por etapa"
        value={
          concluidoThroughput
            ? `${concluidoThroughput.perDay}/dia`
            : totalThroughput > 0
              ? `${totalThroughput} mov.`
              : "—"
        }
        helper={
          concluidoThroughput
            ? `${concluidoThroughput.itemsCount} concluído(s) na janela`
            : totalThroughput > 0
              ? "Transições de itens por etapa"
              : "Sem movimentações no período"
        }
        tone={totalThroughput > 0 ? "info" : "neutral"}
      >
        {throughput.perStage.length > 0 ? (
          <>
            <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
              {throughput.perStage.map((row) => (
                <li key={row.stage} className="flex justify-between gap-2">
                  <span>{STAGE_LABELS[row.stage] ?? row.stage}</span>
                  <span className="font-medium text-foreground/80">
                    {row.itemsCount} · {row.perDay}/dia
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-muted-foreground/80">
              Itens que entraram em cada etapa na janela.
            </p>
          </>
        ) : null}
      </MetricTile>

      <MetricTile
        icon={TrendingUp}
        title="OTIF"
        value={otif.deliveredOnTime + otif.deliveredLate > 0 ? `${otif.otifPercent.toFixed(1)}%` : "—"}
        helper={
          otif.deliveredOnTime + otif.deliveredLate > 0
            ? `${otif.deliveredOnTime} no prazo · ${otif.deliveredLate} atrasada(s) · ${otif.pending} pendente(s)`
            : "Sem entregas no período"
        }
        tone={otifTone}
      />

      <MetricTile
        icon={Gauge}
        title="Ocupação média"
        value={occupancy.lines.length > 0 ? `${occupancy.averageOccupancyPercent.toFixed(1)}%` : "—"}
        helper={
          occupancy.busiestLine
            ? `Pico: ${occupancy.busiestLine.lineName} (${occupancy.busiestLine.occupancyPercent.toFixed(1)}%)`
            : "Sem linhas com carga hoje"
        }
        tone={occupancyTone}
      >
        {occupancy.lines.length > 0 ? (
          <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
            {occupancy.lines.slice(0, 3).map((line) => (
              <li key={line.lineId} className="flex justify-between gap-2">
                <span className="truncate">{line.lineName}</span>
                <span className="font-medium text-foreground/80">
                  {line.occupancyPercent.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </MetricTile>

      <MetricTile
        icon={AlertOctagon}
        title="Falhas de entrega"
        value={String(deliveryFailures.total)}
        helper={
          deliveryFailures.breakdown.length > 0
            ? `${deliveryFailures.breakdown.length} motivo(s) distintos`
            : "Sem tentativas falhadas no período"
        }
        tone={deliveryFailures.total === 0 ? "success" : "warning"}
      >
        {deliveryFailures.breakdown.length > 0 ? (
          <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
            {deliveryFailures.breakdown.slice(0, 3).map((row) => (
              <li key={row.reason} className="flex justify-between gap-2">
                <span className="truncate">{FAILURE_REASON_LABELS[row.reason] ?? row.reason}</span>
                <span className="font-medium text-foreground/80">{row.count}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </MetricTile>
    </div>
  );
}

interface MetricTileProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  helper?: string;
  tone: "info" | "success" | "warning" | "danger" | "neutral";
  children?: React.ReactNode;
}

const TONE_CLASSES: Record<MetricTileProps["tone"], string> = {
  info: "border-info/40 bg-info/5",
  success: "border-success/40 bg-success/5",
  warning: "border-warning/40 bg-warning/5",
  danger: "border-destructive/40 bg-destructive/5",
  neutral: "border-border/60",
};

function MetricTile({ icon: Icon, title, value, helper, tone, children }: MetricTileProps) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${TONE_CLASSES[tone]}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {title}
        </span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-semibold text-foreground tabular-nums">{value}</p>
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      {children}
    </div>
  );
}
