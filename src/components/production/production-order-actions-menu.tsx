"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Factory, MoreHorizontal, Scale, SquarePen } from "lucide-react";

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
  productionPrintHref: string;
  onOpenWorkflow: () => void;
  onOpenPrint: (pathname: string) => void;
};

export function ProductionOrderActionsMenu({
  detailHref,
  preWeighingHref,
  productionPrintHref,
  onOpenWorkflow,
  onOpenPrint,
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
          <DropdownMenuItem className={itemClassName} onSelect={handleAction(() => onOpenPrint(productionPrintHref))}>
            <Factory className="size-4" />
            Produção
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className={itemClassName} onSelect={handleAction(() => router.push(detailHref))}>
            <ArrowUpRight className="size-4" />
            Abrir OP
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
