"use client";

import { useEffect, useState } from "react";

import { hoursUntilDeadline, slotOrderDeadline, type OperationalNow } from "@/lib/order-batch-progress";

function readOperationalNow(): OperationalNow {
  const now = new Date();
  const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  return { dateKey, time };
}

/** Relógio do fuso operacional, atualizado a cada minuto (null até montar no navegador). */
export function useOperationalNow() {
  const [now, setNow] = useState<OperationalNow | null>(null);
  useEffect(() => {
    const tick = () => setNow(readOperationalNow());
    const first = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);
  return now;
}

function br(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${day}/${month}`;
}

/**
 * Reunião 22/10 (bloco 8, 25:40): lembrar a loja do prazo do pedido ("8 da noite ainda tem
 * pedido pendente, alerta"). Aviso dentro do sistema; em destaque nas últimas 24 h.
 */
export function SlotDeadlineHint({
  deliveryDate,
  leadDays,
  cutoffTime,
}: {
  deliveryDate: string;
  leadDays: number;
  cutoffTime: string;
}) {
  const now = useOperationalNow();
  const deadline = slotOrderDeadline(deliveryDate, leadDays, cutoffTime);
  const label = `Prazo para pedir: ${br(deadline.dateKey)} às ${deadline.time}`;
  if (!now) return <p className="text-xs text-muted-foreground">{label}</p>;
  const hours = hoursUntilDeadline(deadline, now);
  if (hours <= 0) {
    return <p className="text-xs font-semibold text-destructive">Prazo encerrado ({br(deadline.dateKey)} às {deadline.time})</p>;
  }
  if (hours <= 24) {
    const remaining = hours < 1 ? `${Math.max(1, Math.round(hours * 60))} min` : `${Math.floor(hours)} h`;
    return (
      <p className="text-xs font-semibold text-warning-foreground" role="status">
        Faltam {remaining} — {label}
      </p>
    );
  }
  return <p className="text-xs text-muted-foreground">{label}</p>;
}
