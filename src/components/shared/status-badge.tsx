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
    bg: "bg-success/15",
    text: "text-[oklch(0.34_0.07_162)]",
    ring: "ring-success/35",
    dot: "bg-[oklch(0.62_0.14_158)]",
  },
  active: {
    label: "Ativo",
    bg: "bg-success/15",
    text: "text-[oklch(0.34_0.07_162)]",
    ring: "ring-success/35",
    dot: "bg-[oklch(0.62_0.14_158)]",
  },
  inativo: {
    label: "Inativo",
    bg: "bg-secondary/70",
    text: "text-secondary-foreground",
    ring: "ring-border",
    dot: "bg-muted-foreground/65",
  },
  inactive: {
    label: "Inativo",
    bg: "bg-secondary/70",
    text: "text-secondary-foreground",
    ring: "ring-border",
    dot: "bg-muted-foreground/65",
  },
  nao_iniciado: {
    label: "Não iniciado",
    bg: "bg-[oklch(0.94_0.018_255)]",
    text: "text-[oklch(0.42_0.05_255)]",
    ring: "ring-[oklch(0.86_0.03_255)]",
    dot: "bg-[oklch(0.62_0.07_255)]",
  },
  em_preparacao: {
    label: "Em Preparação",
    bg: "bg-warning/22",
    text: "text-[oklch(0.39_0.07_85)]",
    ring: "ring-warning/35",
    dot: "bg-[oklch(0.7_0.14_85)]",
  },
  agendado: {
    label: "Agendado",
    bg: "bg-warning/22",
    text: "text-[oklch(0.39_0.07_85)]",
    ring: "ring-warning/35",
    dot: "bg-[oklch(0.7_0.14_85)]",
  },
  em_producao: {
    label: "Em Produção",
    bg: "bg-info/22",
    text: "text-[oklch(0.34_0.05_240)]",
    ring: "ring-info/35",
    dot: "bg-[oklch(0.6_0.14_238)]",
  },
  em_forno: {
    label: "Em Forno",
    bg: "bg-[oklch(0.93_0.06_55)]",
    text: "text-[oklch(0.3_0.09_45)]",
    ring: "ring-[oklch(0.83_0.1_55)]",
    dot: "bg-[oklch(0.62_0.16_45)]",
  },
  embalando: {
    label: "Embalando",
    bg: "bg-[oklch(0.92_0.05_165)]",
    text: "text-[oklch(0.33_0.08_165)]",
    ring: "ring-[oklch(0.82_0.07_165)]",
    dot: "bg-[oklch(0.55_0.12_165)]",
  },
  concluido: {
    label: "Concluído",
    bg: "bg-success/15",
    text: "text-[oklch(0.34_0.07_162)]",
    ring: "ring-success/35",
    dot: "bg-[oklch(0.62_0.14_158)]",
  },
  em_espera: {
    label: "Em Espera",
    bg: "bg-[oklch(0.94_0.04_295)]",
    text: "text-[oklch(0.43_0.08_293)]",
    ring: "ring-[oklch(0.85_0.05_295)]",
    dot: "bg-[oklch(0.6_0.13_295)]",
  },
  cancelado: {
    label: "Cancelado",
    bg: "bg-danger/18",
    text: "text-[oklch(0.43_0.13_22)]",
    ring: "ring-danger/35",
    dot: "bg-[oklch(0.62_0.18_22)]",
  },
  rota_entrega: {
    label: "Rota de Entrega",
    bg: "bg-[oklch(0.93_0.04_214)]",
    text: "text-[oklch(0.4_0.06_228)]",
    ring: "ring-[oklch(0.83_0.05_214)]",
    dot: "bg-[oklch(0.6_0.12_214)]",
  },
  entregue: {
    label: "Entregue",
    bg: "bg-success/15",
    text: "text-[oklch(0.34_0.07_162)]",
    ring: "ring-success/35",
    dot: "bg-[oklch(0.62_0.14_158)]",
  },
  pendente: {
    label: "Pendente",
    bg: "bg-warning/22",
    text: "text-[oklch(0.39_0.07_85)]",
    ring: "ring-warning/35",
    dot: "bg-[oklch(0.7_0.14_85)]",
  },
  aprovado: {
    label: "Aprovado",
    bg: "bg-success/15",
    text: "text-[oklch(0.34_0.07_162)]",
    ring: "ring-success/35",
    dot: "bg-[oklch(0.62_0.14_158)]",
  },
  reprovado: {
    label: "Reprovado",
    bg: "bg-danger/18",
    text: "text-[oklch(0.43_0.13_22)]",
    ring: "ring-danger/35",
    dot: "bg-[oklch(0.62_0.18_22)]",
  },
  aberta: {
    label: "Aberta",
    bg: "bg-danger/18",
    text: "text-[oklch(0.43_0.13_22)]",
    ring: "ring-danger/35",
    dot: "bg-[oklch(0.62_0.18_22)]",
  },
  em_analise: {
    label: "Em Análise",
    bg: "bg-warning/22",
    text: "text-[oklch(0.39_0.07_85)]",
    ring: "ring-warning/35",
    dot: "bg-[oklch(0.7_0.14_85)]",
  },
  aguardando_cliente: {
    label: "Aguardando Cliente",
    bg: "bg-[oklch(0.93_0.04_214)]",
    text: "text-[oklch(0.4_0.06_228)]",
    ring: "ring-[oklch(0.83_0.05_214)]",
    dot: "bg-[oklch(0.6_0.12_214)]",
  },
  resolvida: {
    label: "Resolvida",
    bg: "bg-info/22",
    text: "text-[oklch(0.34_0.05_240)]",
    ring: "ring-info/35",
    dot: "bg-[oklch(0.6_0.14_238)]",
  },
  fechada: {
    label: "Fechada",
    bg: "bg-secondary/70",
    text: "text-secondary-foreground",
    ring: "ring-border",
    dot: "bg-muted-foreground/65",
  },
  aguardando_expedicao: {
    label: "Aguardando Expedição",
    bg: "bg-secondary/70",
    text: "text-secondary-foreground",
    ring: "ring-border",
    dot: "bg-muted-foreground/65",
  },
  pronto_coleta: {
    label: "Pronto p/ Coleta",
    bg: "bg-warning/22",
    text: "text-[oklch(0.39_0.07_85)]",
    ring: "ring-warning/35",
    dot: "bg-[oklch(0.7_0.14_85)]",
  },
  em_rota: {
    label: "Em Rota",
    bg: "bg-info/22",
    text: "text-[oklch(0.34_0.05_240)]",
    ring: "ring-info/35",
    dot: "bg-[oklch(0.6_0.14_238)]",
  },
  no_destino: {
    label: "No Destino",
    bg: "bg-[oklch(0.93_0.04_214)]",
    text: "text-[oklch(0.4_0.06_228)]",
    ring: "ring-[oklch(0.83_0.05_214)]",
    dot: "bg-[oklch(0.6_0.12_214)]",
  },
  tentativa_falha: {
    label: "Tentativa Falhou",
    bg: "bg-danger/18",
    text: "text-[oklch(0.43_0.13_22)]",
    ring: "ring-danger/35",
    dot: "bg-[oklch(0.62_0.18_22)]",
  },
};

const fallbackTone: StatusTone = {
  label: "",
  bg: "bg-secondary/70",
  text: "text-secondary-foreground",
  ring: "ring-border",
  dot: "bg-muted-foreground/65",
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
