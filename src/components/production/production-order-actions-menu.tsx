"use client";

import { pushWithProgress } from "@/lib/navigation-progress";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Factory, MoreHorizontal, Package, Scale, SquarePen, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ProductionOrderActionsMenuProps = {
  detailHref: string;
  preWeighingHref: string;
  /** Separação de embalagens da OP. Opcional: telas que não passam o link não mostram o item. */
  packagingHref?: string;
  productionPrintHref: string;
  onOpenWorkflow: () => void;
  onOpenPrint: (pathname: string) => void;
  /** Reunião 22/10 (bloco 8): só o Master recebe — manda a OP para a lixeira. */
  onTrash?: () => void;
};

export function ProductionOrderActionsMenu({
  detailHref,
  preWeighingHref,
  packagingHref,
  productionPrintHref,
  onOpenWorkflow,
  onOpenPrint,
  onTrash,
}: ProductionOrderActionsMenuProps) {
  const router = useRouter();
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
            className="text-muted-foreground hover:bg-panel hover:text-foreground data-[state=open]:bg-panel"
            aria-label="Abrir ações da OP"
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
          <DropdownMenuItem className={itemClassName} onSelect={handleAction(onOpenWorkflow)}>
            <SquarePen className="size-4" />
            Atualizar itens
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className={itemClassName} onSelect={handleAction(() => onOpenPrint(preWeighingHref))}>
            <Scale className="size-4" />
            Pré-pesagem
          </DropdownMenuItem>
          {packagingHref ? (
            <DropdownMenuItem className={itemClassName} onSelect={handleAction(() => onOpenPrint(packagingHref))}>
              <Package className="size-4" />
              Separação de embalagens
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem className={itemClassName} onSelect={handleAction(() => onOpenPrint(productionPrintHref))}>
            <Factory className="size-4" />
            Produção A4
          </DropdownMenuItem>
          <DropdownMenuItem className={itemClassName} onSelect={handleAction(() => onOpenPrint(`${productionPrintHref}${productionPrintHref.includes("?") ? "&" : "?"}format=80mm`))}>
            <Factory className="size-4" />
            Produção 80 mm
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className={itemClassName} onSelect={handleAction(() => pushWithProgress(router, detailHref))}>
            <ArrowUpRight className="size-4" />
            Abrir OP
          </DropdownMenuItem>
          {onTrash ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
                onSelect={handleAction(onTrash)}
              >
                <Trash2 className="size-4" />
                Excluir OP (Master)
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
