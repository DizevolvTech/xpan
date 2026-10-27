"use client";

import { Loader2, PackageCheck } from "lucide-react";

import { batchReleaseBlockedReason, brDate } from "@/components/production/use-batch-release";
import { Button } from "@/components/ui/button";
import type { BatchGroupView } from "@/lib/supabase-data/order-batch-overview";

/**
 * Faixa de lote na lista de Pedidos (quadro #4, Lucas 27/10): agrupa os pedidos das lojas do
 * mesmo lote e libera o lote inteiro — desabilitado enquanto as lojas ainda podem pedir.
 */
export function BatchBandRow({
  group,
  busy,
  onRelease,
}: {
  group: BatchGroupView;
  busy: boolean;
  onRelease: () => void;
}) {
  const blocked = batchReleaseBlockedReason(group);
  const released = group.state === "liberado";
  return (
    <tr className="bg-info/5" data-batch-band={group.deliveryDate}>
      <td colSpan={4} className="border-t border-info/30 px-2 py-1 text-xs">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <strong className="text-[13px]">Lote · entrega {brDate(group.deliveryDate)}</strong>
          <span className="tabular-nums">
            {group.orderedStores}/{group.totalStores} lojas ({group.percent}%)
          </span>
          <span className="text-muted-foreground">
            · prazo das lojas {brDate(group.deadline.dateKey)} às {group.deadline.time}
            {group.deadlinePassed ? " (encerrado)" : ""}
          </span>
          {group.missingStoreNames.length > 0 && !released ? (
            <span className="max-w-[28rem] truncate text-muted-foreground" title={group.missingStoreNames.join(", ")}>
              · {group.deadlinePassed ? "não pediram" : "faltam"}: {group.missingStoreNames.join(", ")}
            </span>
          ) : null}
        </span>
      </td>
      <td className="whitespace-nowrap border-t border-info/30 bg-info/5 px-2 py-1 text-right sm:sticky sm:right-0 sm:z-[1]">
        {released ? (
          <span className="text-xs font-semibold text-success-foreground">Lote liberado</span>
        ) : (
          <Button
            type="button"
            size="xs"
            variant={blocked ? "outline" : "default"}
            disabled={busy || blocked !== null}
            title={blocked ?? undefined}
            onClick={onRelease}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <PackageCheck className="size-3.5" aria-hidden />}
            {blocked && group.state === "aguardando_lojas" ? "Aguardando prazo" : `Liberar lote (${group.pendingOrderIds.length})`}
          </Button>
        )}
      </td>
    </tr>
  );
}
