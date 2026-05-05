"use client";

import Link from "next/link";
import { ChevronRight, LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/shared/info-hint";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  breadcrumbs?: { label: string; href?: string }[];
}

export function PageHeader({ title, description, action, breadcrumbs }: PageHeaderProps) {
  return (
    <header className="rounded-xl border border-border/80 bg-surface px-5 py-5 shadow-[var(--shadow-soft)] sm:px-6">
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-2xl font-bold text-foreground">{title}</h1>
          {description && <InfoHint content={description} size="md" />}
        </div>

        {action && (
          <Button type="button" onClick={action.onClick}>
            {action.icon && <action.icon className="size-4" />}
            {action.label}
          </Button>
        )}
      </div>
    </header>
  );
}
