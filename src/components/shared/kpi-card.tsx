"use client";

import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { InfoHint } from "@/components/shared/info-hint";
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

const toneStyles: Record<KpiTone, { badge: string; trend: string; rail: string }> = {
  neutral: {
    badge: "bg-secondary text-secondary-foreground",
    trend: "text-muted-foreground",
    rail: "bg-border",
  },
  info: {
    badge: "bg-info text-info-foreground",
    trend: "text-[oklch(0.38_0.06_240)]",
    rail: "bg-info",
  },
  success: {
    badge: "bg-success text-success-foreground",
    trend: "text-[oklch(0.35_0.07_160)]",
    rail: "bg-success",
  },
  warning: {
    badge: "bg-warning text-warning-foreground",
    trend: "text-[oklch(0.4_0.08_85)]",
    rail: "bg-warning",
  },
  danger: {
    badge: "bg-danger text-danger-foreground",
    trend: "text-[oklch(0.45_0.12_22)]",
    rail: "bg-danger",
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
    <article className="group relative overflow-hidden rounded-xl border border-border/70 bg-card p-5 pl-[calc(theme(spacing.5)+3px)] text-card-foreground shadow-[var(--shadow-card)] transition-[box-shadow,transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-[var(--shadow-soft)]">
      <span
        className={cn(
          "pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full opacity-80 transition-opacity duration-300 group-hover:opacity-100",
          styles.rail,
        )}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
            {resolvedSubtitle && <InfoHint content={resolvedSubtitle} size="xs" />}
          </div>
          <p
            className="mt-2.5 font-heading text-[clamp(1.3rem,1.7vw,1.55rem)] font-bold leading-[1.1] tracking-[-0.022em] text-foreground tabular-nums"
            title={typeof displayValue === "string" ? displayValue : String(displayValue)}
          >
            {displayValue}
          </p>
        </div>

        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-border/60 shadow-[inset_0_1px_0_0_color-mix(in_oklch,white_45%,transparent)] transition-transform duration-300 group-hover:scale-[1.05]",
            styles.badge,
          )}
        >
          <Icon className="size-[1.05rem] shrink-0" />
        </div>
      </div>

      {trend && (
        <div className={cn("mt-3.5 inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums", styles.trend)}>
          {trend.direction === "up" && <TrendingUp className="size-3.5" />}
          {trend.direction === "down" && <TrendingDown className="size-3.5" />}
          <span>{trend.value}</span>
        </div>
      )}
    </article>
  );
}
