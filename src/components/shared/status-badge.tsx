"use client";

import { cn } from "@/lib/utils";

type StatusType =
  | "ativo"
  | "inativo"
  | "active"
  | "inactive"
  | "nao_iniciado"
  | "em_preparacao"
  | "agendado"
  | "em_producao"
  | "em_forno"
  | "embalando"
  | "concluido"
  | "em_espera"
  | "cancelado"
  | "rota_entrega"
  | "entregue"
  | "pendente"
  | "aprovado"
  | "reprovado"
  | "aberta"
  | "em_analise"
  | "aguardando_cliente"
  | "resolvida"
  | "fechada"
  | "aguardando_expedicao"
  | "pronto_coleta"
  | "em_rota"
  | "no_destino"
  | "tentativa_falha";

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "bg-success text-success-foreground" },
  active: { label: "Ativo", className: "bg-success text-success-foreground" },
  inativo: { label: "Inativo", className: "bg-secondary text-secondary-foreground" },
  inactive: { label: "Inativo", className: "bg-secondary text-secondary-foreground" },
  nao_iniciado: {
    label: "Não iniciado",
    className: "bg-[oklch(0.9_0.03_255)] text-[oklch(0.42_0.05_255)]",
  },
  em_preparacao: { label: "Em Preparação", className: "bg-warning text-warning-foreground" },
  agendado: { label: "Agendado", className: "bg-warning text-warning-foreground" },
  em_producao: { label: "Em Produção", className: "bg-info text-info-foreground" },
  em_forno: {
    label: "Em Forno",
    className: "bg-[oklch(0.8_0.14_55)] text-[oklch(0.3_0.09_45)]",
  },
  embalando: {
    label: "Embalando",
    className: "bg-[oklch(0.84_0.08_165)] text-[oklch(0.33_0.08_165)]",
  },
  concluido: { label: "Concluído", className: "bg-success text-success-foreground" },
  em_espera: {
    label: "Em Espera",
    className: "bg-[oklch(0.88_0.06_295)] text-[oklch(0.43_0.08_293)]",
  },
  cancelado: { label: "Cancelado", className: "bg-danger text-danger-foreground" },
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
  aguardando_cliente: {
    label: "Aguardando Cliente",
    className: "bg-[oklch(0.88_0.05_214)] text-[oklch(0.4_0.06_228)]",
  },
  resolvida: { label: "Resolvida", className: "bg-info text-info-foreground" },
  fechada: { label: "Fechada", className: "bg-secondary text-secondary-foreground" },
  aguardando_expedicao: { label: "Aguardando Expedição", className: "bg-secondary text-secondary-foreground" },
  pronto_coleta: { label: "Pronto p/ Coleta", className: "bg-warning text-warning-foreground" },
  em_rota: { label: "Em Rota", className: "bg-info text-info-foreground" },
  no_destino: { label: "No Destino", className: "bg-[oklch(0.88_0.05_214)] text-[oklch(0.4_0.06_228)]" },
  tentativa_falha: { label: "Tentativa Falhou", className: "bg-danger text-danger-foreground" },
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
