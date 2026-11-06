"use client";

import { useState } from "react";
import { ArrowUpRight, Ban, MoreHorizontal, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Menu de três pontinhos da linha de Pedidos (quadro #316, 04/11), no molde do menu da OP:
 * a linha abre o pedido; impressão, cancelar e abrir ficam aqui.
 */
export function OrderRowActionsMenu({
  orderCode,
  onOpen,
  onPrintStoreSheet,
  onCancel,
  touchClassName,
}: {
  orderCode: string;
  onOpen: () => void;
  onPrintStoreSheet: () => void;
  /** Ausente quando o pedido não pode ser cancelado (liberado, entregue ou já cancelado). */
  onCancel?: () => void;
  touchClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const itemClassName =
    "focus:bg-primary/10 focus:text-primary data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary";

  function handleAction(action: () => void) {
    return (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      window.setTimeout(action, 0);
    };
  }

  return (
    <div
      className="flex justify-end"
      data-stop-row-click="true"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={`text-muted-foreground hover:bg-panel hover:text-foreground data-[state=open]:bg-panel ${touchClassName ?? ""}`}
            aria-label={`Abrir ações do pedido ${orderCode}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48"
          onCloseAutoFocus={(event) => event.preventDefault()}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <DropdownMenuItem className={itemClassName} onSelect={handleAction(onPrintStoreSheet)}>
            <Printer className="size-4" />
            Folha da loja
          </DropdownMenuItem>
          <DropdownMenuItem className={itemClassName} onSelect={handleAction(onOpen)}>
            <ArrowUpRight className="size-4" />
            Abrir pedido
          </DropdownMenuItem>
          {onCancel ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
                onSelect={handleAction(onCancel)}
              >
                <Ban className="size-4" />
                Cancelar pedido
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
