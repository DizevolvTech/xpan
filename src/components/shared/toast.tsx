"use client";

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  XIcon,
} from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { Toast as ToastPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------------------------------
 * UX-0002 — Toast primitive (substitui window.alert nos sítios de sucesso/erro/validação).
 * Wrapper fino sobre `radix-ui` `Toast`, espelhando a gramática visual de `ui/dialog.tsx`
 * (named import from "radix-ui", data-slot, bg-card/rounded-xl, sombra via token). Cor só via
 * token semântico + degrau --opacity-* (UX-0005). Sem dependência nova, sem cor/opacidade ad-hoc.
 * -----------------------------------------------------------------------------------------------*/

type ToastVariant = "success" | "error" | "warning" | "info";

const VARIANT_DEFAULT_TITLE: Record<ToastVariant, string> = {
  success: "Pronto",
  error: "Erro",
  warning: "Atenção",
  info: "Aviso",
};

const VARIANT_ICON: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const toastVariants = cva(
  "scroll-modern group pointer-events-auto relative flex w-full items-start gap-rhythm-xs overflow-hidden rounded-xl border bg-card p-rhythm-sm pr-rhythm-lg shadow-[var(--shadow-popover)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-[transform] data-[swipe=end]:animate-out data-[state=open]:slide-in-from-bottom-2 sm:data-[state=open]:slide-in-from-right-4 motion-reduce:animate-none motion-reduce:transition-none",
  {
    variants: {
      variant: {
        success:
          "border-success/[var(--opacity-border)] bg-success/[var(--opacity-faint)] [--toast-accent:var(--success)]",
        error:
          "border-danger/[var(--opacity-border)] bg-danger/[var(--opacity-faint)] [--toast-accent:var(--danger)]",
        warning:
          "border-warning/[var(--opacity-border)] bg-warning/[var(--opacity-faint)] [--toast-accent:var(--warning)]",
        info: "border-info/[var(--opacity-border)] bg-info/[var(--opacity-faint)] [--toast-accent:var(--info)]",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

function ToastProvider({
  children,
  swipeDirection = "right",
  duration = 5000,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Provider>) {
  return (
    <ToastPrimitive.Provider
      data-slot="toast-provider"
      swipeDirection={swipeDirection}
      duration={duration}
      {...props}
    >
      {children}
    </ToastPrimitive.Provider>
  );
}

function ToastViewport({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        // Mobile: rodapé full-width (alcance do polegar, não cobre o header da loja).
        // ≥640px: canto inferior-direito. z-50 = patamar do DialogOverlay; renderizado
        // por último no provider → empilha sobre modais (sítios 16/17 disparam de Dialog).
        "fixed inset-x-0 bottom-0 z-50 flex max-h-screen w-full flex-col-reverse gap-rhythm-2xs p-rhythm-sm outline-none sm:right-0 sm:left-auto sm:max-w-[420px]",
        className,
      )}
      {...props}
    />
  );
}

function Toast({
  className,
  variant = "info",
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Root> &
  VariantProps<typeof toastVariants>) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
}

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const Icon = VARIANT_ICON[variant];
  return (
    <span
      aria-hidden="true"
      className="mt-px shrink-0 text-[color:var(--toast-accent)]"
    >
      <Icon className="size-5" />
    </span>
  );
}

function ToastBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="toast-body"
      className={cn("flex min-w-0 flex-1 flex-col gap-rhythm-3xs", className)}
      {...props}
    />
  );
}

function ToastTitle({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Title>) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn(
        "font-heading text-sm leading-none font-semibold text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function ToastDescription({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Description>) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn(
        // Erros de API podem ser longos: quebra palavra + scroll interno, nunca trunca.
        "scroll-modern max-h-40 overflow-y-auto overscroll-contain text-sm leading-snug break-words text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function ToastClose({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Close>) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      // Hit-target ≥44px no mobile (M7): área tocável grande com ícone pequeno.
      className={cn(
        "focus:ring-ring absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground opacity-80 transition hover:bg-secondary hover:opacity-100 focus:ring-2 focus:outline-none disabled:pointer-events-none sm:size-8 motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      <XIcon className="size-4" />
      <span className="sr-only">Dispensar</span>
    </ToastPrimitive.Close>
  );
}

function ToastAction({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Action>) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      className={cn(
        "focus-visible:ring-ring/45 mt-rhythm-2xs inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-border/85 bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-secondary focus-visible:ring-[3px] focus-visible:outline-none motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------------------------------
 * useToast() — API que as 6 telas chamam (montada pelo <ToastHost> no provider global).
 * -----------------------------------------------------------------------------------------------*/

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastApi {
  toast: (opts: ToastOptions) => string;
  success: (
    description: string,
    opts?: Omit<ToastOptions, "variant" | "description">,
  ) => string;
  error: (
    description: string,
    opts?: Omit<ToastOptions, "variant" | "description">,
  ) => string;
  warning: (
    description: string,
    opts?: Omit<ToastOptions, "variant" | "description">,
  ) => string;
  info: (
    description: string,
    opts?: Omit<ToastOptions, "variant" | "description">,
  ) => string;
  dismiss: (id?: string) => void;
}

interface ToastEntry extends ToastOptions {
  id: string;
  variant: ToastVariant;
}

const ToastContext = React.createContext<ToastApi | null>(null);

const DEFAULT_DURATION = 5000;
const ERROR_DURATION = 7000;
const MAX_VISIBLE = 3;

function ToastHost({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastEntry[]>([]);
  const counter = React.useRef(0);

  const dismiss = React.useCallback((id?: string) => {
    setToasts((current) =>
      id === undefined ? [] : current.filter((entry) => entry.id !== id),
    );
  }, []);

  const push = React.useCallback((opts: ToastOptions) => {
    counter.current += 1;
    const id = `toast-${counter.current}`;
    const variant: ToastVariant = opts.variant ?? "info";
    const entry: ToastEntry = {
      ...opts,
      id,
      variant,
      duration:
        opts.duration ??
        (variant === "error" ? ERROR_DURATION : DEFAULT_DURATION),
    };
    // Fila FIFO: máx. 3 visíveis (excedente descartado pela frente — Radix gerencia
    // timer/swipe/pausa-no-hover/re-anúncio AT internamente).
    setToasts((current) => [...current, entry].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = React.useMemo<ToastApi>(
    () => ({
      toast: push,
      success: (description, opts) =>
        push({ ...opts, description, variant: "success" }),
      error: (description, opts) =>
        push({ ...opts, description, variant: "error" }),
      warning: (description, opts) =>
        push({ ...opts, description, variant: "warning" }),
      info: (description, opts) =>
        push({ ...opts, description, variant: "info" }),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      <ToastProvider>
        {children}
        {toasts.map((entry) => (
          <Toast
            key={entry.id}
            variant={entry.variant}
            duration={entry.duration}
            onOpenChange={(open) => {
              if (!open) dismiss(entry.id);
            }}
          >
            <ToastIcon variant={entry.variant} />
            <ToastBody>
              <ToastTitle>
                {entry.title ?? VARIANT_DEFAULT_TITLE[entry.variant]}
              </ToastTitle>
              {entry.description ? (
                <ToastDescription>{entry.description}</ToastDescription>
              ) : null}
            </ToastBody>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}

function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast deve ser usado dentro de <ToastHost>.");
  }
  return ctx;
}

export {
  ToastHost,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  useToast,
};
export type { ToastVariant, ToastOptions, ToastApi };
