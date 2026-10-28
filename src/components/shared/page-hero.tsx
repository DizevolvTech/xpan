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
  /** Quadro #2 (27/10): cabeçalho de uma linha (sem selo, título menor, ações ao lado). */
  compact?: boolean;
}

export function PageHero({
  title,
  description,
  badge,
  actions,
  breadcrumbs,
  className,
  compact = false,
}: PageHeroProps) {
  if (compact) {
    return (
      <section className={cn("relative px-1", className)}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 max-lg:min-h-11 max-lg:pl-14">
          {breadcrumbs && breadcrumbs.length > 1 ? (
            <nav className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {breadcrumbs.slice(0, -1).map((crumb, index) => (
                <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
                  {crumb.href ? (
                    <Link href={crumb.href} className="transition hover:text-foreground">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                  <ChevronRight className="size-3" />
                </span>
              ))}
            </nav>
          ) : null}
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-bold leading-tight text-foreground">{title}</h1>
            {description && <InfoHint content={description} size="sm" />}
          </div>
          {actions && <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">{actions}</div>}
        </div>
      </section>
    );
  }
  return (
    // Quadro #7 (27/10): cabeçalho enxuto, estilo ERP — caminho numa linha fina e, abaixo,
    // selo + título + ajuda na mesma linha, com as ações ao lado.
    <section className={cn("relative px-1", className)}>
      {/* Abaixo de lg o botão de menu fica fixo no canto: o caminho começa à direita dele. */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="relative mb-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground max-lg:min-h-11 max-lg:pl-14">
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

      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 sm:min-w-[18rem] sm:flex-1">
          {badge && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/[var(--opacity-border)] bg-accent/[var(--opacity-faint)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-foreground">
              <span className="inline-flex size-1.5 rounded-full bg-accent" />
              {badge}
            </span>
          )}
          <div className="flex items-center gap-2">
            <h1 className="text-balance text-xl font-bold leading-tight text-foreground lg:text-[1.4rem]">
              {title}
            </h1>
            {description && <InfoHint content={description} size="sm" />}
          </div>
        </div>

        {/* Reunião 22/10 (bloco 3): ações quebram linha em vez de espremer o título. */}
        {actions && <div className="flex min-w-0 flex-wrap items-center gap-2 sm:max-w-[65%] sm:justify-end">{actions}</div>}
      </div>
    </section>
  );
}
