"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { InfoHint } from "@/components/shared/info-hint";
import { cn } from "@/lib/utils";

export interface PageHeroProps {
  title: string;
  description?: string;
  badge?: string;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  className?: string;
}

export function PageHero({
  title,
  description,
  badge,
  actions,
  breadcrumbs,
  className,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/80 bg-surface px-5 py-6 shadow-[var(--shadow-soft)] sm:px-6 lg:px-7",
        className,
      )}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1.5">
              {index > 0 && <ChevronRight className="size-3" />}
              {crumb.href ? (
                <Link href={crumb.href} className="transition hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {badge && (
            <span className="inline-flex items-center rounded-full border border-border/70 bg-panel px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {badge}
            </span>
          )}
          <div className="mt-3 flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
            {description && <InfoHint content={description} size="md" />}
          </div>
        </div>

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </section>
  );
}
