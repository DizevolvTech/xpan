"use client";

import { cn } from "@/lib/utils";

type StatusType =
  | "ativo"
  | "inativo"
  | "active"
  | "inactive"
  | "agendado"
  | "em_producao"
  | "em_espera"
  | "rota_entrega"
  | "entregue"
  | "pendente"
  | "aprovado"
  | "reprovado"
  | "aberta"
  | "em_analise"
  | "resolvida"
  | "fechada";

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "bg-success text-success-foreground" },
  active: { label: "Ativo", className: "bg-success text-success-foreground" },
  inativo: { label: "Inativo", className: "bg-secondary text-secondary-foreground" },
  inactive: { label: "Inativo", className: "bg-secondary text-secondary-foreground" },
  agendado: { label: "Agendado", className: "bg-warning text-warning-foreground" },
  em_producao: { label: "Em Produção", className: "bg-info text-info-foreground" },
  em_espera: {
    label: "Em Espera",
    className: "bg-[oklch(0.88_0.06_295)] text-[oklch(0.43_0.08_293)]",
  },
  rota_entrega: {
    label: "Rota de Entrega",
    className: "bg-[oklch(0.88_0.05_214)] text-[oklch(0.4_0.06_228)]",
  },
  entregue: { label: "Entregue", className: "bg-success text-success-foreground" },
  pendente: { label: "Pendente", className: "bg-warning text-warning-foreground" },
  aprovado: { label: "Aprovado", className: "bg-success text-success-foreground" },
  reprovado: { label: "Reprovado", className: "bg-danger text-danger-foreground" },
  aberta: { label: "Aberta", className: "bg-danger text-danger-foreground" },
  em_analise: { label: "Em Análise", className: "bg-warning text-warning-foreground" },
  resolvida: { label: "Resolvida", className: "bg-info text-info-foreground" },
  fechada: { label: "Fechada", className: "bg-secondary text-secondary-foreground" },
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    className: "bg-secondary text-secondary-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em]",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
