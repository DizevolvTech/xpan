"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

/**
 * Transição de ETAPA nos kanbans (chão + gestor). Envolve o card real: quando o card muda
 * de coluna (avança de etapa), ele sai da coluna antiga (encolhe + esvaece) e ENTRA na nova
 * com um "flash" de anel na cor da etapa, que some. O reflow dos demais cards é animado
 * (layout spring). Deve ficar dentro de um <AnimatePresence initial={false} mode="popLayout">
 * e receber uma `key` ESTÁVEL (não o id posicional da OP — usar getProductionOrderNavKey).
 *
 * O glow vive no WRAPPER (não no card): o card já usa `ring` do Tailwind (box-shadow) e um
 * box-shadow inline no próprio card apagaria esse anel.
 *
 * Respeita prefers-reduced-motion: sem transform/opacity/flash, só o card estático.
 */
export function KanbanCardMotion({
  className,
  glowColor = "var(--primary)",
  children,
}: {
  /** Deve casar o arredondamento do card para o anel de glow ficar alinhado (ex.: "rounded-xl"). */
  className?: string;
  /** Cor do flash de chegada (um `<color>` CSS; default = primária). */
  glowColor?: string;
  children: ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  // O anel encolhe de 3px → 0 conforme `--kanban-glow` vai de 1 → 0 (o CSS faz o color-mix;
  // o framer só anima o número — robusto e theme-aware).
  const style = {
    boxShadow: `0 0 0 calc(var(--kanban-glow, 0) * 3px) color-mix(in oklch, ${glowColor} 55%, transparent)`,
  } as CSSProperties;

  return (
    <motion.div
      layout
      className={className}
      style={style}
      initial={{ opacity: 0, scale: 0.92, "--kanban-glow": 1 }}
      animate={{ opacity: 1, scale: 1, "--kanban-glow": 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{
        layout: { type: "spring", stiffness: 460, damping: 38 },
        opacity: { duration: 0.2, ease: "easeOut" },
        scale: { duration: 0.24, ease: "easeOut" },
        "--kanban-glow": { duration: 0.8, ease: "easeOut" },
      }}
    >
      {children}
    </motion.div>
  );
}
