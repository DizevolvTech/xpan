"use client";

import { useState } from "react";
import { AlertTriangle, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatKgLabel, formatLocaleNumber } from "@/lib/utils";
import { getDayPrintedAt, markDayPrinted } from "@/lib/day-print-tracker";

interface DayPrintButtonProps {
  /** Data (YYYY-MM-DD) das folhas a imprimir. */
  date: string;
  /** Rótulo legível do dia (ex.: "qui., 23/07"). */
  dayLabel: string;
  opCount: number;
  productCount: number;
  totalKg: number;
}

/**
 * XPAN-5 — Atalho "Imprimir folhas do dia" em lote. Abre um modal de resumo pré-impressão
 * (quantas OPs/produtos/kg) e, em caso de REIMPRESSÃO no mesmo dia, alerta o operador para
 * não duplicar a produção. Ao confirmar, abre a página de impressão em lote (autoPrint).
 */
export function DayPrintButton({ date, dayLabel, opCount, productCount, totalKg }: DayPrintButtonProps) {
  const [open, setOpen] = useState(false);
  const [printedAt, setPrintedAt] = useState<string | null>(null);

  const alreadyPrinted = printedAt !== null;

  // localStorage só existe no cliente — lê no clique (pós-hidratação), não no render.
  function handleOpen() {
    setPrintedAt(getDayPrintedAt(date));
    setOpen(true);
  }

  function handleConfirm() {
    window.open(`/impressao/producao-dia/${encodeURIComponent(date)}`, "_blank", "noopener");
    markDayPrinted(date, new Date().toISOString());
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={opCount === 0}
        onClick={handleOpen}
        title={
          opCount === 0
            ? "Nenhuma folha de produção com demanda para o dia"
            : `Imprimir todas as folhas de produção de ${dayLabel}`
        }
      >
        <Printer className="size-4" aria-hidden />
        Imprimir folhas do dia
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Imprimir folhas do dia {dayLabel}</DialogTitle>
            <DialogDescription>
              Revise o resumo antes de enviar todas as folhas de produção do dia para impressão.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 rounded-lg border border-border/80 bg-panel/35 p-4 text-center">
            <div>
              <p className="text-2xl font-bold tabular-nums text-foreground">{formatLocaleNumber(opCount)}</p>
              <p className="text-xs text-muted-foreground">{opCount === 1 ? "folha (OP)" : "folhas (OPs)"}</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-foreground">{formatLocaleNumber(productCount)}</p>
              <p className="text-xs text-muted-foreground">{productCount === 1 ? "produto" : "produtos"}</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {formatKgLabel(totalKg, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
              </p>
              <p className="text-xs text-muted-foreground">demanda</p>
            </div>
          </div>

          {alreadyPrinted ? (
            <div className="flex items-start gap-2 rounded-lg border border-danger/45 bg-danger/15 px-4 py-3 text-sm text-danger-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                <strong className="font-semibold">OPs já enviadas para impressão</strong> — cuide para
                não duplicar a produção. Estas folhas já foram impressas neste navegador
                {printedAt ? ` em ${new Date(printedAt).toLocaleString("pt-BR")}` : ""}. Reimprima apenas
                se necessário (ex.: falha na impressora).
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={opCount === 0}>
              <Printer className="size-4" aria-hidden />
              {alreadyPrinted ? "Reimprimir" : "Imprimir"} {formatLocaleNumber(opCount)} folha(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
