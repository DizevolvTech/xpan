"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------------------------------
 * UX-0003 — Skeleton primitive (placeholder de FORMA; elimina o CLS dos sítios de "Carregando…"
 * textual). CSS puro + tokens UX-0005 (--opacity-strong sobre --secondary), pulsação suave via
 * `animate-pulse` nativo do Tailwind (sem shimmer agressivo, sem dependência). Espelha a gramática
 * de `shared/toast.tsx` (cva, data-slot, motion-reduce explícito, cn, export nomeado no fim).
 * a11y: decorativo por padrão (aria-hidden); com `label` vira região role="status" aria-busy.
 * Cor/opacidade SEMPRE via token — nenhuma prop de cor (previne regressão de token).
 * -----------------------------------------------------------------------------------------------*/

type SkeletonVariant = "block" | "text" | "circle";

const skeletonVariants = cva(
  "relative overflow-hidden bg-secondary/[var(--opacity-strong)] motion-safe:animate-pulse motion-reduce:animate-none",
  {
    variants: {
      variant: {
        block: "rounded-md",
        text: "h-[1em] rounded-sm",
        circle: "aspect-square rounded-full",
      },
      rounded: {
        none: "rounded-none",
        sm: "rounded-sm",
        md: "rounded-md",
        lg: "rounded-lg",
        full: "rounded-full",
      },
    },
    defaultVariants: { variant: "block" },
  },
);

interface SkeletonProps
  extends Omit<React.ComponentProps<"div">, "color">,
    VariantProps<typeof skeletonVariants> {
  /** Largura. number → px; string → passthrough (ex.: "60%", "8rem"). */
  width?: number | string;
  /** Altura. number → px; string → passthrough. Default por variante. */
  height?: number | string;
  /** Atalho para repetir N linhas "text" com gap de ritmo; a última sai ≈70% (imita parágrafo). */
  lines?: number;
  /** Rótulo acessível: presente → região role="status" aria-busy; ausente → decorativo (aria-hidden). */
  label?: string;
}

function toCssSize(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value;
}

function Skeleton({
  className,
  variant = "block",
  rounded,
  width,
  height,
  lines,
  label,
  style,
  ...props
}: SkeletonProps) {
  const dim: React.CSSProperties = {
    ...(width !== undefined && { width: toCssSize(width) }),
    ...(height !== undefined && { height: toCssSize(height) }),
    ...style,
  };

  const a11y = label
    ? ({ role: "status", "aria-busy": true, "aria-label": label } as const)
    : ({ "aria-hidden": true } as const);

  if (lines && lines > 1) {
    return (
      <div
        data-slot="skeleton-group"
        className="flex flex-col gap-rhythm-2xs"
        {...a11y}
      >
        {label ? <span className="sr-only">{label}</span> : null}
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            aria-hidden
            data-slot="skeleton"
            className={cn(skeletonVariants({ variant: "text", rounded }), className)}
            style={index === lines - 1 ? { ...dim, width: "70%" } : dim}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      data-slot="skeleton"
      className={cn(skeletonVariants({ variant, rounded }), className)}
      style={dim}
      {...a11y}
      {...props}
    >
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * DataTableSkeleton — composto fino que casa a FORMA do <table> real (thead + N linhas + coluna de
 * ações), vivendo dentro da MESMA moldura do estado carregado/empty (rounded-xl border bg-card
 * shadow-card). Reserva caixa equivalente à tabela → minimiza CLS na transição loading→loaded.
 * -----------------------------------------------------------------------------------------------*/

interface DataTableSkeletonProps {
  columns: number;
  hasActions?: boolean;
  /** Linhas reservadas. Default 8: preenche a viewport típica sem exagerar a caixa (R1). */
  rows?: number;
  compact?: boolean;
}

function DataTableSkeleton({
  columns,
  hasActions = false,
  rows = 8,
  compact = false,
}: DataTableSkeletonProps) {
  const cols = columns + (hasActions ? 1 : 0);

  return (
    <div
      role="status"
      aria-busy
      aria-label="Carregando registros"
      className="overflow-hidden rounded-xl border border-border/[var(--opacity-strong)] bg-card shadow-[var(--shadow-card)]"
    >
      <span className="sr-only">Carregando registros</span>

      {/* Faixa do thead — mesma altura vertical do <thead> real (py-3.5 / compact py-2.5, px-4). */}
      <div
        className={cn(
          "flex gap-rhythm-sm border-b border-border bg-panel/[var(--opacity-strong)] px-4",
          compact ? "py-2.5" : "py-3.5",
        )}
      >
        {Array.from({ length: cols }).map((_, index) => (
          <Skeleton key={index} variant="text" className="h-3 flex-1" />
        ))}
      </div>

      {/* N linhas — mesma altura de célula do <td> real (py-3 / compact py-2.5, px-4). */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className={cn(
            "flex gap-rhythm-sm border-t border-border/[var(--opacity-divider)] px-4",
            compact ? "py-2.5" : "py-3",
          )}
        >
          {Array.from({ length: cols }).map((_, cellIndex) => (
            <Skeleton key={cellIndex} variant="text" className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export { Skeleton, DataTableSkeleton, skeletonVariants };
export type { SkeletonProps, SkeletonVariant, DataTableSkeletonProps };
