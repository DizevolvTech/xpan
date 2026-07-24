"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";

import { readClientAccessContext } from "@/lib/client-access-context";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // `cursor-pointer`: o Tailwind v4 removeu o cursor de ponteiro padrão do <button>; sem
  // isto o mouse fica em seta e o botão "não parece clicável" (feedback do usuário).
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold tracking-[0.005em] transition-[transform,box-shadow,background-color,border-color,color,filter] duration-200 ease-out disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/45 focus-visible:ring-[3px] active:translate-y-0 active:duration-75",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-primary text-primary-foreground shadow-[var(--shadow-card)] hover:-translate-y-px hover:shadow-[var(--shadow-soft)] hover:brightness-[1.06]",
        destructive:
          "border border-transparent bg-destructive text-white shadow-[var(--shadow-card)] hover:-translate-y-px hover:shadow-[var(--shadow-soft)] hover:brightness-[1.06]",
        outline:
          "border-border-strong/30 bg-surface text-foreground hover:border-border-strong/55 hover:bg-panel hover:-translate-y-px",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/85",
        ghost:
          "border border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
        link: "h-auto border-none p-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        xs: "h-7 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-lg px-6 has-[>svg]:px-4",
        icon: "size-10",
        "icon-xs": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/*
 * UX-0004 — Convenção "botão enviando".
 * `isLoading`/`loadingText` são puramente apresentacionais: somam o estado de
 * envio (spinner + texto opcional + `disabled` + `aria-busy`) e previnem o
 * re-submit em voo (mitiga D03 na origem da UI). NÃO alteram regra, dado, fetch
 * nem navegação. Ausente/false ⇒ render byte-idêntico ao anterior (requisito-
 * âncora). Regras duras: `isLoading` é SOMADO ao `disabled` (read-only/
 * `props.disabled` preservados, precedência intacta); `asChild` ⇒ Slot exige 1
 * filho, então só atributos (sem injetar spinner/texto, sem quebrar
 * React.Children.only); `size="icon*"` ⇒ spinner substitui o ícone, sem texto.
 * Spinner = `Loader2` (lucide, já dep) + `animate-spin` Tailwind nativo —
 * idioma já provado em `login-form.tsx:131`, zero dependência nova.
 */
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;
const ICON_SIZES = new Set<ButtonSize>(["icon", "icon-xs", "icon-sm", "icon-lg"]);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  allowInReadOnly = false,
  isLoading = false,
  loadingText,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    allowInReadOnly?: boolean;
    /**
     * UX-0004: quando true, o botão entra em estado "enviando":
     * - desabilita (somado ao `disabled` atual — read-only/`disabled` intactos);
     * - prefixa um `<Loader2 animate-spin aria-hidden>` antes do conteúdo;
     * - troca o texto por `loadingText` quando informado;
     * - expõe `aria-busy` e `data-loading`.
     * Ausente/false ⇒ comportamento byte-idêntico ao anterior. Default: false.
     */
    isLoading?: boolean;
    /**
     * UX-0004: rótulo de progresso opcional. Quando ausente e `isLoading`,
     * mantém o `children` original (só prefixa o spinner — não inventa texto,
     * zero reflow). Ignorado em `size="icon*"` (sem espaço p/ texto) e em
     * `asChild` (Slot 1-filho). Use ≈ o comprimento do label para evitar CLS.
     */
    loadingText?: React.ReactNode;
  }) {
  const Comp = asChild ? Slot.Root : "button";
  const isReadOnlyTenantView = readClientAccessContext().accessMode === "read-only-tenant";
  const blocksInReadOnly =
    !allowInReadOnly &&
    !asChild &&
    (variant === "default" || variant === "destructive" || props.type === "submit");
  const disabled =
    props.disabled || (isReadOnlyTenantView && blocksInReadOnly) || isLoading;

  // `asChild`: Slot.Root exige 1 único filho — NÃO injetar spinner/texto; só atributos.
  const showSpinnerAndText = isLoading && !asChild;
  const isIcon = ICON_SIZES.has(size ?? "default");
  const { children, ...rest } = props;
  const content = showSpinnerAndText ? (
    <>
      <Loader2
        className={cn(
          isIcon || size === "xs" || size === "sm" ? "size-3" : "size-4",
          "animate-spin motion-reduce:animate-none",
        )}
        aria-hidden="true"
      />
      {isIcon ? null : (loadingText ?? children)}
    </>
  ) : (
    children
  );

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-read-only-disabled={disabled && isReadOnlyTenantView ? "true" : "false"}
      data-loading={isLoading ? "true" : "false"}
      aria-busy={isLoading || undefined}
      aria-disabled={asChild && isLoading ? true : undefined}
      className={cn(
        buttonVariants({ variant, size, className }),
        asChild && isLoading && "pointer-events-none",
      )}
      {...rest}
      disabled={disabled}
    >
      {asChild ? children : content}
    </Comp>
  );
}

export { Button, buttonVariants };
