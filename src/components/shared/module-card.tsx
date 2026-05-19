import Link from "next/link";
import { ArrowUpRight, LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type ModuleTone =
  | "blue"
  | "emerald"
  | "violet"
  | "amber"
  | "rose"
  | "cyan"
  | "slate";

const toneStyles: Record<ModuleTone, { icon: string; marker: string }> = {
  blue: { icon: "bg-info text-info-foreground", marker: "bg-info-foreground/[var(--opacity-soft)]" },
  emerald: { icon: "bg-success text-success-foreground", marker: "bg-success-foreground/[var(--opacity-soft)]" },
  violet: { icon: "bg-[var(--module-violet)] text-[var(--module-violet-foreground)]", marker: "bg-[var(--module-violet-foreground)]/[var(--opacity-muted)]" },
  amber: { icon: "bg-warning text-warning-foreground", marker: "bg-warning-foreground/[var(--opacity-muted)]" },
  rose: { icon: "bg-danger text-danger-foreground", marker: "bg-danger-foreground/[var(--opacity-muted)]" },
  cyan: { icon: "bg-[var(--module-cyan)] text-[var(--module-cyan-foreground)]", marker: "bg-[var(--module-cyan-foreground)]/[var(--opacity-muted)]" },
  slate: { icon: "bg-secondary text-secondary-foreground", marker: "bg-muted-foreground/[var(--opacity-muted)]" },
};

interface ModuleCardProps {
  href: string;
  title: string;
  subtitle?: string;
  description: string;
  icon: LucideIcon;
  tone?: ModuleTone;
  items?: string[];
  footerLabel?: string;
}

export function ModuleCard({
  href,
  title,
  subtitle,
  description,
  icon: Icon,
  tone = "slate",
  items,
  footerLabel = "Acessar módulo",
}: ModuleCardProps) {
  const styles = toneStyles[tone];

  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-2xl bg-card p-5 shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
    >
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl", styles.icon)}>
          <Icon className="size-5 shrink-0" />
        </div>
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{description}</p>

      {items && items.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {items.map((item) => (
            <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("inline-block size-1.5 rounded-full", styles.marker)} />
              {item}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-5 text-sm font-semibold text-foreground">
        <span className="inline-flex items-center gap-1">
          {footerLabel}
          <ArrowUpRight className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </Link>
  );
}
