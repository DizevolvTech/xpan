import type { StoreProfile } from "@/lib/factory-planning/types";

/**
 * AJ-A8: roteirização básica de entregas — agrupa por (data, zona ou janela
 * horária) e ordena por janela horária + código da loja dentro do grupo.
 *
 * Limitação consciente: o schema atual de `stores` não tem endereço/CEP/
 * latitude. O melhor sinal real que temos é a janela de recebimento
 * (`receiveWindow`) + o campo opcional `deliveryZone` (texto livre que o
 * gestor preenche). Sem geo, evitamos heurísticas falsas; a clusterização
 * é honesta: agrupa o que já é natural agrupar (mesma zona ou mesma janela).
 *
 * Se o cliente decidir cadastrar zona em todas as lojas, a roteirização
 * passa a refletir essa zona automaticamente — sem mudar este código.
 */

export interface DeliveryRoutingInput {
  orderId: string;
  storeId: string;
  deliveryDate: string;
}

export interface DeliveryRouteAssignment {
  orderId: string;
  routeCode: string;
  /** Nome legível da rota — "Zona Centro" ou "Janela 07:00 - 10:00" */
  zone: string;
  /** Ordem dentro da rota: 1, 2, 3… */
  stopNumber: number;
  /** "1ª parada", "2ª parada", … */
  stopLabel: string;
}

interface RouteBucket {
  key: string;
  zoneLabel: string;
  sortKey: string;
  items: Array<{
    orderId: string;
    storeCode: string;
    storeName: string;
    receiveWindow: string;
  }>;
}

function buildBucketKey(deliveryDate: string, zoneLabel: string): string {
  return `${deliveryDate}|${zoneLabel}`;
}

/**
 * Resolve a chave de agrupamento e o label exibido para uma loja:
 *   1. Se a loja tem `deliveryZone` preenchida (não vazia), usa "Zona X"
 *   2. Caso contrário, usa a janela de recebimento "Janela HH:MM - HH:MM"
 *   3. Sem nenhum dos dois, cai em "Sem agrupamento" (rota livre)
 */
function resolveZoneLabel(store: StoreProfile | undefined): {
  zoneLabel: string;
  /** chave de ordenação — janelas em ordem cronológica, depois alfabética */
  sortKey: string;
} {
  if (!store) {
    return { zoneLabel: "Sem agrupamento", sortKey: "~~~" };
  }
  const zone = store.deliveryZone?.trim();
  if (zone && zone.length > 0) {
    return { zoneLabel: `Zona ${zone}`, sortKey: `1|${zone.toLowerCase()}` };
  }
  const window = store.receiveWindow?.trim();
  if (window && window.length > 0) {
    return { zoneLabel: `Janela ${window}`, sortKey: `0|${window}` };
  }
  return { zoneLabel: "Sem agrupamento", sortKey: "~~~" };
}

/**
 * Extrai HH:MM de uma `receiveWindow` ("07:00 - 10:00" → "07:00"). Usado
 * apenas como tiebreaker — strings inválidas vão para o fim.
 */
function extractWindowStart(receiveWindow: string | undefined | null): string {
  if (!receiveWindow) return "99:99";
  const match = receiveWindow.match(/(\d{1,2}):(\d{2})/);
  if (!match) return "99:99";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function buildDeliveryRoutes(
  deliveries: DeliveryRoutingInput[],
  stores: StoreProfile[],
): DeliveryRouteAssignment[] {
  const storeById = new Map(stores.map((store) => [store.id, store]));
  const buckets = new Map<string, RouteBucket>();

  deliveries.forEach((delivery) => {
    const store = storeById.get(delivery.storeId);
    const { zoneLabel, sortKey } = resolveZoneLabel(store);
    const bucketKey = buildBucketKey(delivery.deliveryDate, zoneLabel);

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, {
        key: bucketKey,
        zoneLabel,
        sortKey: `${delivery.deliveryDate}|${sortKey}`,
        items: [],
      });
    }
    buckets.get(bucketKey)!.items.push({
      orderId: delivery.orderId,
      storeCode: store?.code ?? delivery.storeId,
      storeName: store?.name ?? delivery.storeId,
      receiveWindow: store?.receiveWindow ?? "",
    });
  });

  const orderedBuckets = Array.from(buckets.values()).sort((a, b) =>
    a.sortKey.localeCompare(b.sortKey),
  );

  const assignments: DeliveryRouteAssignment[] = [];

  orderedBuckets.forEach((bucket, bucketIndex) => {
    bucket.items.sort((a, b) => {
      // Dentro do grupo: janela mais cedo primeiro, depois código da loja.
      const byWindow = extractWindowStart(a.receiveWindow).localeCompare(
        extractWindowStart(b.receiveWindow),
      );
      if (byWindow !== 0) return byWindow;
      return a.storeCode.localeCompare(b.storeCode);
    });

    const [datePart] = bucket.key.split("|");
    const dateSuffix = datePart.replaceAll("-", "").slice(2);
    const routeCode = `R-${dateSuffix}-${String(bucketIndex + 1).padStart(2, "0")}`;

    bucket.items.forEach((item, index) => {
      assignments.push({
        orderId: item.orderId,
        routeCode,
        zone: bucket.zoneLabel,
        stopNumber: index + 1,
        stopLabel: `${index + 1}ª parada`,
      });
    });
  });

  return assignments;
}
