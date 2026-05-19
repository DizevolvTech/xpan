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

type StatusTone = {
  label: string;
  bg: string;
  text: string;
  ring: string;
  dot: string;
};

const statusConfig: Record<StatusType, StatusTone> = {
  ativo: {
    label: "Ativo",
    bg: "bg-success/[var(--opacity-subtle)]",
    text: "text-[oklch(0.34_0.07_162)]",
    ring: "ring-success/[var(--opacity-border)]",
    dot: "bg-[oklch(0.62_0.14_158)]",
  },
  active: {
    label: "Ativo",
    bg: "bg-success/[var(--opacity-subtle)]",
    text: "text-[oklch(0.34_0.07_162)]",
    ring: "ring-success/[var(--opacity-border)]",
    dot: "bg-[oklch(0.62_0.14_158)]",
  },
  inativo: {
    label: "Inativo",
    bg: "bg-secondary/[var(--opacity-strong)]",
    text: "text-secondary-foreground",
    ring: "ring-border",
    dot: "bg-muted-foreground/[var(--opacity-strong)]",
  },
  inactive: {
    label: "Inativo",
    bg: "bg-secondary/[var(--opacity-strong)]",
    text: "text-secondary-foreground",
    ring: "ring-border",
    dot: "bg-muted-foreground/[var(--opacity-strong)]",
  },
  nao_iniciado: {
    label: "Não iniciado",
    bg: "bg-[var(--status-neutral)]",
    text: "text-[var(--status-neutral-foreground)]",
    ring: "ring-[var(--status-neutral-ring)]",
    dot: "bg-[var(--status-neutral-dot)]",
  },
  em_preparacao: {
    label: "Em Preparação",
    bg: "bg-warning/[var(--opacity-soft)]",
    text: "text-[oklch(0.39_0.07_85)]",
    ring: "ring-warning/[var(--opacity-border)]",
    dot: "bg-[oklch(0.7_0.14_85)]",
  },
  agendado: {
    label: "Agendado",
    bg: "bg-warning/[var(--opacity-soft)]",
    text: "text-[oklch(0.39_0.07_85)]",
    ring: "ring-warning/[var(--opacity-border)]",
    dot: "bg-[oklch(0.7_0.14_85)]",
  },
  em_producao: {
    label: "Em Produção",
    bg: "bg-info/[var(--opacity-soft)]",
    text: "text-[oklch(0.34_0.05_240)]",
    ring: "ring-info/[var(--opacity-border)]",
    dot: "bg-[oklch(0.6_0.14_238)]",
  },
  em_forno: {
    label: "Em Forno",
    bg: "bg-[var(--status-bake)]",
    text: "text-[var(--status-bake-foreground)]",
    ring: "ring-[var(--status-bake-ring)]",
    dot: "bg-[var(--status-bake-dot)]",
  },
  embalando: {
    label: "Embalando",
    bg: "bg-[var(--status-pack)]",
    text: "text-[var(--status-pack-foreground)]",
    ring: "ring-[var(--status-pack-ring)]",
    dot: "bg-[var(--status-pack-dot)]",
  },
  concluido: {
    label: "Concluído",
    bg: "bg-success/[var(--opacity-subtle)]",
    text: "text-[oklch(0.34_0.07_162)]",
    ring: "ring-success/[var(--opacity-border)]",
    dot: "bg-[oklch(0.62_0.14_158)]",
  },
  em_espera: {
    label: "Em Espera",
    bg: "bg-[var(--status-hold)]",
    text: "text-[var(--status-hold-foreground)]",
    ring: "ring-[var(--status-hold-ring)]",
    dot: "bg-[var(--status-hold-dot)]",
  },
  cancelado: {
    label: "Cancelado",
    bg: "bg-danger/[var(--opacity-subtle)]",
    text: "text-[oklch(0.43_0.13_22)]",
    ring: "ring-danger/[var(--opacity-border)]",
    dot: "bg-[oklch(0.62_0.18_22)]",
  },
  rota_entrega: {
    label: "Rota de Entrega",
    bg: "bg-[var(--status-transit)]",
    text: "text-[var(--status-transit-foreground)]",
    ring: "ring-[var(--status-transit-ring)]",
    dot: "bg-[var(--status-transit-dot)]",
  },
  entregue: {
    label: "Entregue",
    bg: "bg-success/[var(--opacity-subtle)]",
    text: "text-[oklch(0.34_0.07_162)]",
    ring: "ring-success/[var(--opacity-border)]",
    dot: "bg-[oklch(0.62_0.14_158)]",
  },
  pendente: {
    label: "Pendente",
    bg: "bg-warning/[var(--opacity-soft)]",
    text: "text-[oklch(0.39_0.07_85)]",
    ring: "ring-warning/[var(--opacity-border)]",
    dot: "bg-[oklch(0.7_0.14_85)]",
  },
  aprovado: {
    label: "Aprovado",
    bg: "bg-success/[var(--opacity-subtle)]",
    text: "text-[oklch(0.34_0.07_162)]",
    ring: "ring-success/[var(--opacity-border)]",
    dot: "bg-[oklch(0.62_0.14_158)]",
  },
  reprovado: {
    label: "Reprovado",
    bg: "bg-danger/[var(--opacity-subtle)]",
    text: "text-[oklch(0.43_0.13_22)]",
    ring: "ring-danger/[var(--opacity-border)]",
    dot: "bg-[oklch(0.62_0.18_22)]",
  },
  aberta: {
    label: "Aberta",
    bg: "bg-danger/[var(--opacity-subtle)]",
    text: "text-[oklch(0.43_0.13_22)]",
    ring: "ring-danger/[var(--opacity-border)]",
    dot: "bg-[oklch(0.62_0.18_22)]",
  },
  em_analise: {
    label: "Em Análise",
    bg: "bg-warning/[var(--opacity-soft)]",
    text: "text-[oklch(0.39_0.07_85)]",
    ring: "ring-warning/[var(--opacity-border)]",
    dot: "bg-[oklch(0.7_0.14_85)]",
  },
  aguardando_cliente: {
    label: "Aguardando Cliente",
    bg: "bg-[var(--status-transit)]",
    text: "text-[var(--status-transit-foreground)]",
    ring: "ring-[var(--status-transit-ring)]",
    dot: "bg-[var(--status-transit-dot)]",
  },
  resolvida: {
    label: "Resolvida",
    bg: "bg-info/[var(--opacity-soft)]",
    text: "text-[oklch(0.34_0.05_240)]",
    ring: "ring-info/[var(--opacity-border)]",
    dot: "bg-[oklch(0.6_0.14_238)]",
  },
  fechada: {
    label: "Fechada",
    bg: "bg-secondary/[var(--opacity-strong)]",
    text: "text-secondary-foreground",
    ring: "ring-border",
    dot: "bg-muted-foreground/[var(--opacity-strong)]",
  },
  aguardando_expedicao: {
    label: "Aguardando Expedição",
    bg: "bg-secondary/[var(--opacity-strong)]",
    text: "text-secondary-foreground",
    ring: "ring-border",
    dot: "bg-muted-foreground/[var(--opacity-strong)]",
  },
  pronto_coleta: {
    label: "Pronto p/ Coleta",
    bg: "bg-warning/[var(--opacity-soft)]",
    text: "text-[oklch(0.39_0.07_85)]",
    ring: "ring-warning/[var(--opacity-border)]",
    dot: "bg-[oklch(0.7_0.14_85)]",
  },
  em_rota: {
    label: "Em Rota",
    bg: "bg-info/[var(--opacity-soft)]",
    text: "text-[oklch(0.34_0.05_240)]",
    ring: "ring-info/[var(--opacity-border)]",
    dot: "bg-[oklch(0.6_0.14_238)]",
  },
  no_destino: {
    label: "No Destino",
    bg: "bg-[var(--status-transit)]",
    text: "text-[var(--status-transit-foreground)]",
    ring: "ring-[var(--status-transit-ring)]",
    dot: "bg-[var(--status-transit-dot)]",
  },
  tentativa_falha: {
    label: "Tentativa Falhou",
    bg: "bg-danger/[var(--opacity-subtle)]",
    text: "text-[oklch(0.43_0.13_22)]",
    ring: "ring-danger/[var(--opacity-border)]",
    dot: "bg-[oklch(0.62_0.18_22)]",
  },
};

const fallbackTone: StatusTone = {
  label: "",
  bg: "bg-secondary/[var(--opacity-strong)]",
  text: "text-secondary-foreground",
  ring: "ring-border",
  dot: "bg-muted-foreground/[var(--opacity-strong)]",
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const tone = statusConfig[status] ?? { ...fallbackTone, label: status };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.08em] ring-1 ring-inset",
        tone.bg,
        tone.text,
        tone.ring,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden />
      {tone.label}
    </span>
  );
}
