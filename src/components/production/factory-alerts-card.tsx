"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";

import { InfoHint } from "@/components/shared/info-hint";

type AlertSeverity = "info" | "warning" | "danger";

interface FactoryAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  metric: string;
}

interface MetricsWithAlerts {
  alerts: FactoryAlert[];
}

type FetchState =
  | { kind: "loading" }
  | { kind: "ready"; alerts: FactoryAlert[] }
  | { kind: "error"; message: string };

// Tons consistentes com o card de métricas (border-<tone>/40 + bg-<tone>/5).
const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  info: "border-info/40 bg-info/5",
  warning: "border-warning/40 bg-warning/5",
  danger: "border-destructive/40 bg-destructive/5",
};

const SEVERITY_ICON: Record<AlertSeverity, React.ComponentType<{ className?: string }>> = {
  info: Info,
  warning: AlertTriangle,
  danger: ShieldAlert,
};

const SEVERITY_RANK: Record<AlertSeverity, number> = { danger: 0, warning: 1, info: 2 };

interface FactoryAlertsCardProps {
  referenceDate: string;
  windowDays?: number;
}

/**
 * 2.3-D — Painel de alertas de divergência. Consome o mesmo endpoint de
 * métricas (que já expõe `alerts` via computeFactoryAlerts). Some quando não há
 * alertas para não poluir a visão do gestor.
 */
export function FactoryAlertsCard({ referenceDate, windowDays = 7 }: FactoryAlertsCardProps) {
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
          throw new Error(payload?.message ?? "Falha ao carregar alertas");
        }
        return (await response.json()) as MetricsWithAlerts;
      })
      .then((metrics) => {
        if (cancelled) return;
        setState({ kind: "ready", alerts: metrics.alerts ?? [] });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "Falha ao carregar alertas",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [referenceDate, windowDays]);

  // Carregando ou erro: não ocupa espaço — o card de métricas já sinaliza falha.
  if (state.kind !== "ready" || state.alerts.length === 0) {
    return null;
  }

  const sorted = [...state.alerts].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );

  return (
    <section
      aria-label="Alertas de divergência"
      className="rounded-2xl border border-border/60 bg-card p-4"
    >
      <div className="mb-3 flex items-center gap-1.5">
        <AlertTriangle className="size-4 text-warning" />
        <h2 className="text-sm font-semibold text-foreground">
          Alertas de divergência ({sorted.length})
        </h2>
        <InfoHint
          size="sm"
          content="Divergências detectadas no período: produção vs planejado, atraso por etapa, OTIF/entregas e lojas sem pedido no prazo."
        />
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {sorted.map((alert) => {
          const Icon = SEVERITY_ICON[alert.severity];
          return (
            <li
              key={alert.id}
              className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${SEVERITY_STYLES[alert.severity]}`}
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{alert.title}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground/80">
                    {alert.metric}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{alert.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
