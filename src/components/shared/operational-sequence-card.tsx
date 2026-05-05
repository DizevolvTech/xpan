"use client";

import { InfoHint } from "@/components/shared/info-hint";
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
  description?: string;
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
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="space-y-1">
        <p className="eyebrow">{eyebrow}</p>
        <div className="flex items-center gap-1.5">
          <h3 className="font-heading text-[0.95rem] font-semibold text-foreground">{title}</h3>
          {description ? <InfoHint content={description} size="sm" /> : null}
        </div>
      </div>

      <div className={cn("mt-4 grid gap-3", gridColsClass)}>
        {steps.map((step, index) => (
          <div
            key={step.key}
            className={cn(
              "relative rounded-xl border p-4 transition-colors duration-200 hover:border-border-strong/40",
              toneClassNames[step.tone ?? "neutral"],
            )}
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-background text-[10px] font-bold text-foreground tabular-nums shadow-[0_1px_0_0_color-mix(in_oklch,var(--foreground)_8%,transparent),inset_0_0_0_1px_color-mix(in_oklch,var(--border-strong)_22%,transparent)]">
                {index + 1}
              </span>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {step.label}
              </p>
              {step.helper ? <InfoHint content={step.helper} size="xs" /> : null}
            </div>
            <p className="mt-2.5 font-heading text-[0.95rem] font-semibold leading-tight text-foreground">
              {step.value}
            </p>
          </div>
        ))}
      </div>

      {footer ? (
        <div className="mt-4 rounded-xl border border-dashed border-border/65 bg-panel/30 px-4 py-3 text-sm text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
