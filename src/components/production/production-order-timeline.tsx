"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/shared/info-hint";

type TimelineEvent = {
  id: string;
  eventType: string;
  statusFrom: string | null;
  statusTo: string | null;
  productionItemKey: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

interface TimelineResponse {
  opCode: string;
  planningKey: string;
  events: TimelineEvent[];
}

const STATUS_LABELS: Record<string, string> = {
  nao_iniciado: "Não iniciado",
  em_preparacao: "Em preparação",
  em_producao: "Em produção",
  em_forno: "No forno",
  embalando: "Embalando",
  concluido: "Concluído",
};

function formatStatus(status: string | null) {
  if (!status) return "—";
  return STATUS_LABELS[status] ?? status;
}

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function describeEvent(event: TimelineEvent): string {
  if (event.eventType === "item_status_changed") {
    return `${formatStatus(event.statusFrom)} → ${formatStatus(event.statusTo)}`;
  }
  if (event.eventType === "op_released") return "OP liberada para produção";
  if (event.eventType === "op_aborted") return "OP abortada";
  return event.eventType;
}

interface ProductionOrderTimelineProps {
  opCode: string;
  referenceDate: string;
}

type TimelineResult =
  | { kind: "loading" }
  | { kind: "ready"; events: TimelineEvent[] }
  | { kind: "error"; message: string };

export function ProductionOrderTimeline({
  opCode,
  referenceDate,
}: ProductionOrderTimelineProps) {
  // Estado começa em loading; em mudanças de opCode/referenceDate o consumer
  // remonta o componente via `key` — assim não precisamos resetar state dentro
  // do effect (anti-pattern react-hooks/set-state-in-effect).
  const [result, setResult] = useState<TimelineResult>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetch(
      `/api/factory-planning/ops/${encodeURIComponent(opCode)}/timeline?referenceDate=${encodeURIComponent(referenceDate)}`,
    )
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(body?.message ?? "Falha ao carregar o histórico");
        }
        return (await response.json()) as TimelineResponse;
      })
      .then((payload) => {
        if (cancelled) return;
        setResult({ kind: "ready", events: payload.events });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setResult({
          kind: "error",
          message: error instanceof Error ? error.message : "Falha ao carregar o histórico",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [opCode, referenceDate]);

  return (
    <Card>
      <CardHeader className="border-b border-border/60">
        <div className="flex items-center gap-1.5">
          <CardTitle>Histórico da OP</CardTitle>
          <InfoHint content="Toda transição de status persistida na tabela production_order_events. Append-only: o histórico nunca é editado, só acrescido." />
        </div>
      </CardHeader>
      <CardContent>
        {result.kind === "loading" ? (
          <p className="text-sm text-muted-foreground">Carregando histórico…</p>
        ) : result.kind === "error" ? (
          <p className="text-sm text-destructive">{result.message}</p>
        ) : result.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum evento registrado ainda. As transições futuras de status ficarão aqui.
          </p>
        ) : (
          <ol className="space-y-3">
            {result.events.map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-border/70 bg-card/80 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-foreground">{describeEvent(event)}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(event.createdAt)}
                  </span>
                </div>
                {event.productionItemKey ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    item: <code className="font-mono">{event.productionItemKey}</code>
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
