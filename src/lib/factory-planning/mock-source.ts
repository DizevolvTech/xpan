import { linesById, productsById } from "@/lib/production-planning";
import type { FactorySimulationInput, OrderUnit, StoreOrder, StoreOrderItem, StoreProfile } from "@/lib/factory-planning/types";
import { round2 } from "@/lib/factory-planning/units";

const simulatedRegions = [
  "Centro",
  "Zona Norte",
  "Zona Sul",
  "Zona Leste",
  "Zona Oeste",
  "Bairro Industrial",
];

const simulatedPrefixes = ["Emporio", "Padaria", "Mercado", "Loja", "Casa", "Ponto"];
const simulatedCutoffs = ["16:30", "17:00", "17:30", "18:00", "18:30"];
const simulatedOrderTimes = ["08:20", "09:45", "11:10", "13:40", "15:15", "16:50", "18:10", "19:20"];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`);
}

function addDays(dateKey: string, days: number): string {
  const date = fromDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function getSimulatedQuantity(unit: OrderUnit, seed: number): number {
  if (unit === "Kg") {
    return round2(45 + (seed % 9) * 12.5);
  }
  if (unit === "g") {
    return 500 + (seed % 7) * 250;
  }
  if (unit === "Un") {
    return 120 + (seed % 12) * 35;
  }
  if (unit === "Dz") {
    return 4 + (seed % 8) * 2;
  }
  if (unit === "Forma") {
    return 6 + (seed % 10) * 2;
  }

  return 3 + (seed % 7);
}

function buildSimulatedStores(totalStores = 30): StoreProfile[] {
  return Array.from({ length: totalStores }).map((_, index) => {
    const storeNumber = String(index + 1).padStart(2, "0");
    const prefix = simulatedPrefixes[index % simulatedPrefixes.length];
    const region = simulatedRegions[Math.floor(index / simulatedPrefixes.length) % simulatedRegions.length];
    return {
      id: `store-${storeNumber}`,
      name: `${prefix} ${storeNumber} - ${region}`,
      cutoffTime: simulatedCutoffs[index % simulatedCutoffs.length],
      dPlusDays: (index % 3) + 1,
      receivesSunday: index % 6 === 0,
    };
  });
}

function buildSimulatedOrders(storesList: StoreProfile[], referenceDate: string): StoreOrder[] {
  const activeProducts = Array.from(productsById.values()).filter((product) => {
    const line = linesById.get(product.lineId);
    return product.active && line?.status === "ativo";
  });

  if (activeProducts.length === 0) {
    return [];
  }

  const orders: StoreOrder[] = [];
  let orderSequence = 1;

  storesList.forEach((store, storeIndex) => {
    const ordersPerStore = 2 + (storeIndex % 3);

    for (let orderIndex = 0; orderIndex < ordersPerStore; orderIndex += 1) {
      const dayOffset = -2 + ((storeIndex + orderIndex) % 4);
      const orderedDate = addDays(referenceDate, dayOffset);
      const orderTime = simulatedOrderTimes[(storeIndex * 2 + orderIndex) % simulatedOrderTimes.length];
      // Simulate orders with many product lines to match real operational volume.
      const itemsPerOrder = 20 + ((storeIndex + orderIndex) % 7);
      const orderId = `order-${String(orderSequence).padStart(4, "0")}`;
      const orderCode = `PD-${referenceDate.replaceAll("-", "").slice(2)}-${String(orderSequence).padStart(4, "0")}`;

      const items: StoreOrderItem[] = [];
      for (let itemIndex = 0; itemIndex < itemsPerOrder; itemIndex += 1) {
        const product = activeProducts[(storeIndex + orderIndex * 3 + itemIndex) % activeProducts.length];
        const seed = storeIndex * 100 + orderIndex * 10 + itemIndex;

        items.push({
          id: `${orderId}-item-${itemIndex + 1}`,
          productId: product.id,
          quantity: getSimulatedQuantity(product.salesUnit, seed),
          unit: product.salesUnit,
        });
      }

      orders.push({
        id: orderId,
        code: orderCode,
        storeId: store.id,
        orderedAt: `${orderedDate}T${orderTime}:00`,
        items,
      });
      orderSequence += 1;
    }
  });

  return orders;
}

export function buildMockFactoryInput(referenceDate: string): FactorySimulationInput {
  const stores = buildSimulatedStores(30);
  return {
    stores,
    storeOrders: buildSimulatedOrders(stores, referenceDate),
  };
}
