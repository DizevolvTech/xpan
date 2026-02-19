"use client";

import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiTone = "neutral" | "info" | "success" | "warning" | "danger";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  tone?: KpiTone;
  subtitle?: string;
  trend?: {
    value: string;
    direction: "up" | "down" | "flat";
  };
}

const toneStyles: Record<KpiTone, { badge: string; trend: string }> = {
  neutral: {
    badge: "bg-secondary text-secondary-foreground",
    trend: "text-muted-foreground",
  },
  info: {
    badge: "bg-info text-info-foreground",
    trend: "text-[oklch(0.38_0.06_240)]",
  },
  success: {
    badge: "bg-success text-success-foreground",
    trend: "text-[oklch(0.35_0.07_160)]",
  },
  warning: {
    badge: "bg-warning text-warning-foreground",
    trend: "text-[oklch(0.4_0.08_85)]",
  },
  danger: {
    badge: "bg-danger text-danger-foreground",
    trend: "text-[oklch(0.45_0.12_22)]",
  },
};

export function KPICard({
  title,
  value,
  icon: Icon,
  tone = "neutral",
  subtitle,
  trend,
}: KPICardProps) {
  const styles = toneStyles[tone];

  return (
    <article className="rounded-xl border border-border/80 bg-card p-4 text-card-foreground shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold leading-none text-foreground">{value}</p>
          {subtitle && <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>}
        </div>

        <div className={cn("flex size-10 items-center justify-center rounded-lg", styles.badge)}>
          <Icon className="size-4" />
        </div>
      </div>

      {trend && (
        <div className={cn("mt-3 inline-flex items-center gap-1.5 text-xs font-semibold", styles.trend)}>
          {trend.direction === "up" && <TrendingUp className="size-3.5" />}
          {trend.direction === "down" && <TrendingDown className="size-3.5" />}
          <span>{trend.value}</span>
        </div>
      )}
    </article>
  );
}
