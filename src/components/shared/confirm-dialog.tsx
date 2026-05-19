"use client";

import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* -------------------------------------------------------------------------------------------------
 * UX-0002 — Confirm primitive (substitui window.confirm nos 7 sítios destrutivos/de confirmação).
 * Wrapper sobre `radix-ui` `AlertDialog` (role="alertdialog", foco inicial no Cancelar, Esc =
 * cancelar, foco preso) — semântica de alerta correta. Estilo IDÊNTICO a `ui/dialog.tsx`
 * (mesmo overlay color-mix/backdrop-blur, bg-card/rounded-xl/shadow-elevated, data-slot, footer).
 * O botão de confirmar é o `Button` da casa → herda a trava read-only-tenant automaticamente.
 * -----------------------------------------------------------------------------------------------*/

type ConfirmTone = "destructive" | "default";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal data-slot="confirm-dialog-portal">
        <AlertDialogPrimitive.Overlay
          data-slot="confirm-dialog-overlay"
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-[color-mix(in_oklch,var(--foreground)_30%,transparent)]/35 backdrop-blur-sm motion-reduce:animate-none"
        />
        <AlertDialogPrimitive.Content
          data-slot="confirm-dialog-content"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          className={cn(
            "bg-card data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-1rem)] translate-x-[-50%] translate-y-[-50%] gap-rhythm-sm rounded-xl border border-border/85 p-rhythm-md shadow-[var(--shadow-elevated)] duration-200 outline-none sm:max-w-md motion-reduce:animate-none",
          )}
        >
          <div data-slot="confirm-dialog-header" className="flex flex-col gap-rhythm-2xs text-left">
            <AlertDialogPrimitive.Title
              id={titleId}
              data-slot="confirm-dialog-title"
              className="font-heading text-lg leading-none font-semibold"
            >
              {title}
            </AlertDialogPrimitive.Title>
            {description ? (
              <AlertDialogPrimitive.Description
                id={descriptionId}
                data-slot="confirm-dialog-description"
                className="text-muted-foreground text-sm whitespace-pre-line"
              >
                {description}
              </AlertDialogPrimitive.Description>
            ) : null}
          </div>
          <div
            data-slot="confirm-dialog-footer"
            className="flex flex-col-reverse gap-rhythm-2xs sm:flex-row sm:justify-end"
          >
            <AlertDialogPrimitive.Cancel asChild>
              {/* Foco inicial vai para o Cancelar (default seguro do AlertDialog). */}
              <Button variant="outline" className="min-h-11 sm:min-h-10">
                {cancelLabel}
              </Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button
                variant={tone === "destructive" ? "destructive" : "default"}
                className="min-h-11 sm:min-h-10"
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

/* -------------------------------------------------------------------------------------------------
 * useConfirm() — hook imperativo (espelha 1:1 a forma `if (window.confirm(M)) {…}`).
 *   antes:  if (window.confirm("Cancelar?")) { void cancelOrder(id); }
 *   depois: if (await confirm({ title: "Cancelar?", tone: "destructive" })) { void cancelOrder(id); }
 * Cancelar / Esc / click-fora → resolve false (early-return idêntico ao confirm cancelado).
 * -----------------------------------------------------------------------------------------------*/

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ConfirmState>({
    open: false,
    title: "",
  });
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);

  const settle = React.useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState((current) => ({ ...current, open: false }));
  }, []);

  const confirm = React.useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      // Resolve uma eventual promessa pendente como cancelada antes de reusar.
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setState({ ...options, open: true });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={state.open}
        onOpenChange={(open) => {
          // Esc / click-fora / botão Cancelar → false (caminho negativo idêntico ao confirm).
          if (!open) settle(false);
        }}
        title={state.title}
        description={state.description}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        tone={state.tone}
        onConfirm={() => settle(true)}
      />
    </ConfirmContext.Provider>
  );
}

function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm deve ser usado dentro de <ConfirmProvider>.");
  }
  return ctx;
}

export { ConfirmDialog, ConfirmProvider, useConfirm };
export type { ConfirmTone, ConfirmOptions };
