"use client";

import { cn } from "@/lib/utils";

type OperationalSequenceTone = "neutral" | "info" | "warning" | "success";

export interface OperationalSequenceStep {
  key: string;
  label: string;
  value: string;
  helper?: string | null;
  tone?: OperationalSequenceTone;
}

interface OperationalSequenceCardProps {
  eyebrow?: string;
  title: string;
  description: string;
  steps: OperationalSequenceStep[];
  footer?: string;
  className?: string;
}

const toneClassNames: Record<OperationalSequenceTone, string> = {
  neutral: "border-border/70 bg-panel/25",
  info: "border-info/30 bg-info/10",
  warning: "border-warning/30 bg-warning/10",
  success: "border-success/30 bg-success/10",
};

export function OperationalSequenceCard({
  eyebrow = "Sequência operacional",
  title,
  description,
  steps,
  footer,
  className,
}: OperationalSequenceCardProps) {
  const gridColsClass =
    steps.length <= 2
      ? "md:grid-cols-2"
      : steps.length === 3
        ? "lg:grid-cols-3"
        : steps.length === 4
          ? "lg:grid-cols-4"
          : "xl:grid-cols-5";

  return (
    <div className={cn("rounded-xl border border-border/80 bg-card p-4", className)}>
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {eyebrow}
        </p>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className={cn("mt-4 grid gap-3", gridColsClass)}>
        {steps.map((step, index) => (
          <div
            key={step.key}
            className={cn(
              "rounded-xl border p-4",
              toneClassNames[step.tone ?? "neutral"],
            )}
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-background/80 text-[10px] font-semibold text-foreground">
                {index + 1}
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {step.label}
              </p>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">{step.value}</p>
            {step.helper ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.helper}</p>
            ) : null}
          </div>
        ))}
      </div>

      {footer ? (
        <div className="mt-4 rounded-xl border border-border/70 bg-panel/25 px-4 py-3 text-sm text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
