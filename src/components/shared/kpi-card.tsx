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
  compactValue?: boolean;
  compactThreshold?: number;
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

function normalizeNumberToken(token: string): number | null {
  const raw = token.trim().replace(/\s+/g, "");
  if (!raw) {
    return null;
  }

  const hasDot = raw.includes(".");
  const hasComma = raw.includes(",");
  let normalized = raw;

  if (hasDot && hasComma) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = raw.replace(",", ".");
  } else if (hasDot) {
    const parts = raw.split(".");
    const looksLikeThousandSeparated =
      parts.length > 1 && parts.slice(1).every((part) => part.length === 3);
    normalized = looksLikeThousandSeparated ? raw.replace(/\./g, "") : raw;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractNumericValue(value: string | number): { amount: number; unit: string } | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    return { amount: value, unit: "" };
  }

  const match = value.trim().match(/^([+-]?\d[\d.,\s]*)(?:\s+(.+))?$/);
  if (!match) {
    return null;
  }

  const amount = normalizeNumberToken(match[1]);
  if (amount === null) {
    return null;
  }

  return { amount, unit: match[2]?.trim() ?? "" };
}

function formatCompactKpiValue(
  value: string | number,
  compactThreshold: number,
): { display: string; full: string } | null {
  const parsed = extractNumericValue(value);
  if (!parsed || Math.abs(parsed.amount) < compactThreshold) {
    return null;
  }

  const compactNumber = new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(parsed.amount);

  const fullNumber = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: Number.isInteger(parsed.amount) ? 0 : 2,
  }).format(parsed.amount);

  const display = parsed.unit ? `${compactNumber} ${parsed.unit}` : compactNumber;
  const full = parsed.unit ? `${fullNumber} ${parsed.unit}` : fullNumber;

  return { display, full };
}

export function KPICard({
  title,
  value,
  icon: Icon,
  tone = "neutral",
  subtitle,
  compactValue = false,
  compactThreshold = 1000,
  trend,
}: KPICardProps) {
  const styles = toneStyles[tone];
  const compact = compactValue ? formatCompactKpiValue(value, compactThreshold) : null;
  const displayValue = compact?.display ?? value;
  const resolvedSubtitle = subtitle ?? compact?.full;

  return (
    <article className="rounded-xl border border-border/80 bg-card p-4 text-card-foreground shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
          <p
            className="mt-2 text-[clamp(1.25rem,2.1vw,1.7rem)] font-bold leading-tight text-foreground tabular-nums"
            title={typeof displayValue === "string" ? displayValue : String(displayValue)}
          >
            {displayValue}
          </p>
          {resolvedSubtitle && <p className="mt-2 text-xs text-muted-foreground">{resolvedSubtitle}</p>}
        </div>

        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", styles.badge)}>
          <Icon className="size-4 shrink-0" />
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
