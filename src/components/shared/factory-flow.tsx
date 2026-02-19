"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type FlowStep = {
  key: string;
  title: string;
  helper: string;
  value: string | number;
  href: string;
  icon: LucideIcon;
};

interface FactoryFlowProps {
  currentKey: string;
  steps: FlowStep[];
  title?: string;
  subtitle?: string;
  className?: string;
}

export function FactoryFlow({
  currentKey,
  steps,
  title = "Fluxo Operacional",
  subtitle = "Acompanhe o funil completo de pedidos, produção e expedição.",
  className,
}: FactoryFlowProps) {
  const gridColsClass =
    steps.length <= 1
      ? "md:grid-cols-1"
      : steps.length === 2
        ? "md:grid-cols-2"
        : steps.length === 3
          ? "md:grid-cols-3"
          : "md:grid-cols-4";

  return (
    <div className={cn("rounded-xl border border-border/80 bg-card p-4 shadow-[var(--shadow-soft)]", className)}>
      <div className="mb-3 flex flex-col gap-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className={cn("grid gap-2", gridColsClass)}>
        {steps.map((step, index) => {
          const isActive = step.key === currentKey;
          const Icon = step.icon;

          return (
            <Link
              key={step.key}
              href={step.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group rounded-lg border p-3 transition-colors",
                isActive
                  ? "border-primary/35 bg-primary/10"
                  : "border-border/70 bg-background/70 hover:bg-panel/80",
              )}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="inline-flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
                      isActive ? "bg-primary text-primary-foreground" : "bg-panel text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                </div>
                <Icon className={cn("size-4", isActive ? "text-foreground" : "text-muted-foreground")} />
              </div>

              <p className="text-xs text-muted-foreground">{step.helper}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{step.value}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
