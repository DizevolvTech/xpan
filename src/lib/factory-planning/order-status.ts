import type { OrderStatus } from "@/lib/factory-planning/types";

export function isOpenOrderStatus(status: OrderStatus): boolean {
  return status !== "cancelado" && status !== "entregue";
}

export function countOpenOrders<T extends { status: OrderStatus }>(orders: T[]): number {
  let count = 0;
  for (const order of orders) {
    if (isOpenOrderStatus(order.status)) {
      count += 1;
    }
  }
  return count;
}
