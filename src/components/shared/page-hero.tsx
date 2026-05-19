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
        "relative overflow-hidden rounded-2xl border border-border/[var(--opacity-strong)] bg-surface px-5 py-7 shadow-[var(--shadow-card)] sm:px-7 lg:px-9 lg:py-8",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:accent-rule",
        "after:pointer-events-none after:absolute after:-right-24 after:-top-24 after:size-64 after:rounded-full after:bg-[radial-gradient(circle,color-mix(in_oklch,var(--accent)_18%,transparent)_0%,transparent_70%)]",
        className,
      )}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="relative mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
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

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {badge && (
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/[var(--opacity-border)] bg-accent/[var(--opacity-faint)] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-accent-foreground backdrop-blur-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              {badge}
            </span>
          )}
          <div className="mt-3 flex items-center gap-2.5">
            <h1 className="text-balance text-[1.5rem] font-bold leading-[1.12] text-foreground sm:text-[1.75rem] lg:text-[1.9rem]">
              {title}
            </h1>
            {description && <InfoHint content={description} size="md" />}
          </div>
        </div>

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </section>
  );
}
