"use client";

import * as React from "react";
import { Inbox, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------------------------------
 * UX-0007 — EmptyState primitive (ícone-герói + título + descrição + CTA opcional).
 * Substitui o "<p> cinza só" do bloco data.length===0 do DataTable por uma hierarquia legível
 * (ícone neutro → título com peso → descrição orientadora → CTA ancorado). CSS + tokens UX-0005
 * (--opacity-* / --spacing-rhythm-*), ícone via lucide (já dep), CTA = <Button> UX-0004 (a trava
 * read-only-tenant é resolvida PELO CONSUMIDOR e repassada via `action.disabled` — este primitivo
 * NÃO importa o contexto de acesso, mantendo-se desacoplado). Espelha a gramática de
 * shared/toast.tsx / shared/skeleton.tsx (cn, data-slot, cabeçalho-comentário UX-####, export
 * nomeado no fim). Sem `cva` (não há variantes reais — `size` é um booleano
 * disfarçado: um ternário em `cn()` é mais simples e idiomático que `cva` para 2 valores), sem
 * animação (estado final legítimo, não uma espera → `prefers-reduced-motion` é não-aplicável),
 * sem dependência nova.
 * a11y: o ícone é decorativo (aria-hidden — a informação está no título/descrição); título e
 * descrição são <p> textuais lidos na ordem natural (sem role artificial); o CTA herda foco
 * visível, aria-busy e a desabilitação do <Button> da casa.
 * -----------------------------------------------------------------------------------------------*/

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  /** Repassado ao <Button> (UX-0004) — defesa-em-profundidade p/ o caso default/submit. */
  allowInReadOnly?: boolean;
  /**
   * Desabilita explicitamente o CTA (afordância visível, inerte). O <Button> outline
   * NÃO auto-bloqueia em read-only-tenant (UX-0004 só trava default/destructive/submit):
   * a trava efetiva vem do consumidor que conhece o contexto de acesso (ex.: o DataTable
   * calcula `isReadOnlyTenantView && !allowInReadOnly` e injeta aqui). Afordância
   * desabilitada, não removida (guard-rail R3 da iniciativa).
   */
  disabled?: boolean;
}

interface EmptyStateProps {
  /** Ícone-герói (lucide). Default: Inbox (neutro "lista vazia"). */
  icon?: LucideIcon;
  /** Título curto (peso visual). Default: "Nada por aqui ainda". */
  title?: string;
  /** Descrição orientadora (1 linha). Mapeia do `emptyMessage` do DataTable.
   *  Default seguro quando ausente — nunca sobrescreve um valor informado. */
  description?: string;
  /** CTA opcional. Quando ausente, o empty-state é só ícone + título + descrição. */
  action?: EmptyStateAction;
  /** Variação de altura. "table" = casa a moldura do DataTable (≈ h-44 atual).
   *  "section" = bloco maior p/ adoção futura (fora do escopo de UX-0007).
   *  Default: "table". */
  size?: "table" | "section";
  className?: string;
}

function EmptyState({
  icon: Icon = Inbox,
  title = "Nada por aqui ainda",
  description = "Nenhum registro para exibir.",
  action,
  size = "table",
  className,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;

  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-rhythm-sm rounded-xl border border-dashed border-border-strong/[var(--opacity-border)] bg-card px-rhythm-lg py-rhythm-lg text-center shadow-[var(--shadow-card)]",
        size === "section" ? "min-h-64" : "min-h-44",
        className,
      )}
    >
      <Icon
        data-slot="empty-state-icon"
        className="size-9 text-muted-foreground/[var(--opacity-prominent)]"
        aria-hidden="true"
      />
      <p
        data-slot="empty-state-title"
        className="text-sm font-semibold text-foreground"
      >
        {title}
      </p>
      {description ? (
        <p
          data-slot="empty-state-description"
          className="max-w-sm text-sm text-muted-foreground"
        >
          {description}
        </p>
      ) : null}
      {action ? (
        <div data-slot="empty-state-action" className="mt-rhythm-2xs">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled}
            allowInReadOnly={action.allowInReadOnly}
          >
            {ActionIcon ? <ActionIcon className="mr-1.5 size-4" /> : null}
            {action.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps, EmptyStateAction };
