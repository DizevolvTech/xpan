"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronRight, Info, ShieldAlert, Store } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InfoHint } from "@/components/shared/info-hint";

type AlertSeverity = "info" | "warning" | "danger";

interface FactoryAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  metric: string;
}

interface StoreWithoutOrder {
  id: string;
  code: string;
  name: string;
}

interface MetricsWithAlerts {
  alerts: FactoryAlert[];
  storesWithoutOrderList?: StoreWithoutOrder[];
}

type FetchState =
  | { kind: "loading" }
  | { kind: "ready"; alerts: FactoryAlert[]; storesWithoutOrder: StoreWithoutOrder[] }
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

// Alerta de lojas sem pedido vira um botão que abre o modal com a lista.
const STORES_ALERT_ID = "stores-without-order";

interface FactoryAlertsCardProps {
  referenceDate: string;
  windowDays?: number;
}

/**
 * 2.3-D — Painel de alertas de divergência. Consome o mesmo endpoint de
 * métricas (que já expõe `alerts` via computeFactoryAlerts). Some quando não há
 * alertas para não poluir a visão do gestor. O alerta de lojas sem pedido abre
 * um modal com a lista das lojas — assim o card fica enxuto.
 */
export function FactoryAlertsCard({ referenceDate, windowDays = 7 }: FactoryAlertsCardProps) {
  const [state, setState] = useState<FetchState>({ kind: "loading" });
  const [storesModalOpen, setStoresModalOpen] = useState(false);

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
        setState({
          kind: "ready",
          alerts: metrics.alerts ?? [],
          storesWithoutOrder: metrics.storesWithoutOrderList ?? [],
        });
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
  const stores = state.storesWithoutOrder;

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
          content="Divergências detectadas no período: produção vs planejado, atraso por etapa, entregas no prazo e lojas sem pedido no prazo."
        />
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {sorted.map((alert) => {
          const Icon = SEVERITY_ICON[alert.severity];
          const isStoresAlert = alert.id === STORES_ALERT_ID && stores.length > 0;

          const body = (
            <>
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{alert.title}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground/80">
                    {alert.metric}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{alert.detail}</p>
                {isStoresAlert ? (
                  <span className="mt-1 inline-flex items-center gap-0.5 text-xs font-medium text-foreground/70">
                    Ver lojas
                    <ChevronRight className="size-3.5" />
                  </span>
                ) : null}
              </div>
            </>
          );

          if (isStoresAlert) {
            return (
              <li key={alert.id}>
                <button
                  type="button"
                  onClick={() => setStoresModalOpen(true)}
                  className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${SEVERITY_STYLES[alert.severity]}`}
                >
                  {body}
                </button>
              </li>
            );
          }

          return (
            <li
              key={alert.id}
              className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${SEVERITY_STYLES[alert.severity]}`}
            >
              {body}
            </li>
          );
        })}
      </ul>

      <Dialog open={storesModalOpen} onOpenChange={setStoresModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lojas sem pedido no prazo</DialogTitle>
            <DialogDescription>
              {stores.length} loja(s) que pedem nesse dia ainda não registraram pedido para a data de
              referência.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto">
            {stores.map((store) => (
              <li key={store.id} className="flex items-center gap-2.5 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Store className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{store.name}</p>
                  <p className="text-xs text-muted-foreground">Código {store.code}</p>
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </section>
  );
}
