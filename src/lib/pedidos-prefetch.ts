import "server-only";

import { GET as getDeliveryExecutions } from "@/app/api/delivery-executions/route";
import { GET as getFactoryPlanning } from "@/app/api/factory-planning/route";
import { GET as getMasterData } from "@/app/api/master-data/route";
import { GET as getListFilters } from "@/app/api/me/list-filters/route";
import { GET as getOrderBatchesOverview } from "@/app/api/order-batches/overview/route";

/**
 * Cartão #18 (Pedidos em até 1 s): a tela fazia 5 leituras depois de carregar, cada uma
 * um pedido separado ao servidor; uma delas costumava cair num servidor "frio" (~1 s a
 * mais). Aqui as mesmas rotas rodam dentro do pedido do HTML, com a mesma sessão e as
 * mesmas checagens de acesso, e os dados vão junto com a página. Leitura que falhar fica
 * de fora e a tela busca sozinha, como antes.
 */
export type PedidosPrefetch = {
  referenceDate: string | null;
  factoryPlanning?: unknown;
  masterData?: unknown;
  deliveryExecutions?: unknown;
  listFilters?: unknown;
  orderBatchesOverview?: unknown;
};

async function readOk(response: Promise<Response>) {
  try {
    const res = await response;
    return res.ok ? ((await res.json()) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

export async function loadPedidosPrefetch(referenceDate: string | null): Promise<PedidosPrefetch> {
  const [factoryPlanning, masterData, deliveryExecutions, listFilters, orderBatchesOverview] = await Promise.all([
    referenceDate
      ? readOk(getFactoryPlanning(new Request(`http://localhost/api/factory-planning?referenceDate=${referenceDate}`)))
      : undefined,
    readOk(getMasterData()),
    readOk(getDeliveryExecutions()),
    readOk(getListFilters()),
    readOk(getOrderBatchesOverview()),
  ]);
  return { referenceDate, factoryPlanning, masterData, deliveryExecutions, listFilters, orderBatchesOverview };
}
