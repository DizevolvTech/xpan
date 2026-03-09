import { linesById, productsById, storesMasterData } from "@/lib/production-planning";
import type {
  FactorySimulationInput,
  OrderUnit,
  StoreOrder,
  StoreOrderItem,
  StoreProfile,
} from "@/lib/factory-planning/types";
import { round2 } from "@/lib/factory-planning/units";

const simulatedRegions = [
  "Centro",
  "Zona Norte",
  "Zona Sul",
  "Zona Leste",
  "Zona Oeste",
  "Bairro Industrial",
];

const simulatedOrderTimes = ["08:20", "09:45", "11:10", "13:40", "15:15", "16:50", "19:20"];

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
    return round2(18 + (seed % 7) * 8.5);
  }
  if (unit === "Un") {
    return 18 + (seed % 9) * 5;
  }
  if (unit === "Dz") {
    return 4 + (seed % 5) * 2;
  }
  if (unit === "Forma" || unit === "Travessa") {
    return 2 + (seed % 4);
  }

  return 2 + (seed % 6);
}

function buildSimulatedStores(totalStores = 24): StoreProfile[] {
  return Array.from({ length: totalStores }).map((_, index) => {
    const template = storesMasterData[index % storesMasterData.length];
    const storeNumber = String(index + 1).padStart(2, "0");
    const region = simulatedRegions[Math.floor(index / storesMasterData.length) % simulatedRegions.length];

    return {
      id: `store-${storeNumber}`,
      code: `LJ-${storeNumber}`,
      name: `${template.name} ${storeNumber} - ${region}`,
      orderingDays: template.orderingDays,
      receivingDays: template.receivingDays,
      receiveWindow: template.receiveWindow,
    };
  });
}

function buildSimulatedOrders(storesList: StoreProfile[], referenceDate: string): StoreOrder[] {
  const activeProducts = Array.from(productsById.values()).filter((product) => {
    const line = linesById.get(product.lineId);
    return product.active && product.availableForOrdering && line?.status === "ativo";
  });

  if (activeProducts.length === 0) {
    return [];
  }

  const orders: StoreOrder[] = [];
  let orderSequence = 1;

  storesList.forEach((store, storeIndex) => {
    const ordersPerStore = 2 + (storeIndex % 2);

    for (let orderIndex = 0; orderIndex < ordersPerStore; orderIndex += 1) {
      const dayOffset = -2 + ((storeIndex + orderIndex) % 4);
      const orderedDate = addDays(referenceDate, dayOffset);
      const orderTime = simulatedOrderTimes[(storeIndex * 2 + orderIndex) % simulatedOrderTimes.length];
      const itemsPerOrder = 8 + ((storeIndex + orderIndex) % 5);
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
  const stores = buildSimulatedStores(24);
  return {
    stores,
    storeOrders: buildSimulatedOrders(stores, referenceDate),
  };
}
