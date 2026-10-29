import { PedidosPrefetchSeed } from "@/components/prefetch/pedidos-prefetch-seed";
import { loadPedidosPrefetch } from "@/lib/pedidos-prefetch";
import { getTodayDateKey } from "@/lib/order-planning";

import { PedidosFabricaPageClient } from "./pedidos-page-client";

/**
 * Cartão #18 (Pedidos em até 1 s): os dados da tela vêm no mesmo pedido do HTML.
 * Sem ?scope/?date/?start/?ref na URL a tela usa hoje (fuso operacional), então o
 * planejamento de hoje já vem junto; com data na URL a tela busca a data dela.
 */
export default async function PedidosFabricaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const usesTodayScope = !params.scope && !params.date && !params.start && !params.ref;
  const prefetch = await loadPedidosPrefetch(usesTodayScope ? getTodayDateKey() : null);
  return (
    <>
      <PedidosPrefetchSeed payload={prefetch} />
      <PedidosFabricaPageClient />
    </>
  );
}
