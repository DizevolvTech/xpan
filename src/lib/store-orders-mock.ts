import type { UnitCode } from "@/lib/factory-planning/units";

export type StoreOrderStatus = "agendado" | "em_producao" | "em_espera" | "rota_entrega" | "entregue";

export interface StoreOrderSummary {
  id: string;
  code: string;
  date: string;
  deliveryDate: string;
  status: StoreOrderStatus;
  store: string;
}

export interface StoreOrderDetailItem {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: UnitCode;
  quantity: number;
}

export interface StoreOrderDetail extends StoreOrderSummary {
  dPlusLabel: string;
  cutoffTime: string;
  receivesSunday: boolean;
  receiveWindow: string;
  note: string;
  items: StoreOrderDetailItem[];
}

const mockStoreOrderDetails: StoreOrderDetail[] = [
  {
    id: "order-1443",
    code: "PD-1443",
    date: "07/11/2025 18:42",
    deliveryDate: "10/11/2025",
    status: "agendado",
    store: "Empório do Pão",
    dPlusLabel: "D+3",
    cutoffTime: "18:00",
    receivesSunday: false,
    receiveWindow: "07:30 - 10:00",
    note: "Pedido padrão do dia. Entrega prevista dentro da janela comercial.",
    items: [
      { id: "order-1443-item-1", code: "PR-6397", name: "Pão Teste", category: "Panificação", unit: "Kg", quantity: 50 },
      { id: "order-1443-item-2", code: "PR-8337", name: "Pão Francês", category: "Panificação", unit: "Un", quantity: 200 },
      { id: "order-1443-item-3", code: "PR-5279", name: "Bolo Tapioca", category: "Confeitaria", unit: "Forma", quantity: 10 },
      { id: "order-1443-item-4", code: "PR-7407", name: "Sonho", category: "Confeitaria", unit: "Dz", quantity: 15 },
      { id: "order-1443-item-5", code: "PR-2245", name: "Biscoito", category: "Secos", unit: "g", quantity: 5000 },
    ],
  },
  {
    id: "order-1442",
    code: "PD-1442",
    date: "06/11/2025 17:25",
    deliveryDate: "09/11/2025",
    status: "em_producao",
    store: "Padaria Central",
    dPlusLabel: "D+2",
    cutoffTime: "17:30",
    receivesSunday: true,
    receiveWindow: "06:00 - 08:30",
    note: "Loja habilitada para receber domingo.",
    items: [
      { id: "order-1442-item-1", code: "PR-8337", name: "Pão Francês", category: "Panificação", unit: "Un", quantity: 180 },
      { id: "order-1442-item-2", code: "PR-1120", name: "Broa de Milho", category: "Panificação", unit: "Un", quantity: 120 },
      { id: "order-1442-item-3", code: "PR-7001", name: "Bolo de Fubá", category: "Confeitaria", unit: "Forma", quantity: 8 },
    ],
  },
  {
    id: "order-1441",
    code: "PD-1441",
    date: "05/11/2025 16:55",
    deliveryDate: "08/11/2025",
    status: "rota_entrega",
    store: "Casa Express Pinheiros",
    dPlusLabel: "D+4",
    cutoffTime: "18:30",
    receivesSunday: false,
    receiveWindow: "08:00 - 11:00",
    note: "Expedição confirmada com rota prioritária.",
    items: [
      { id: "order-1441-item-1", code: "PR-9002", name: "Pão de Batata", category: "Panificação", unit: "Un", quantity: 140 },
      { id: "order-1441-item-2", code: "PR-4450", name: "Bolo de Cenoura", category: "Confeitaria", unit: "Forma", quantity: 12 },
      { id: "order-1441-item-3", code: "PR-9911", name: "Cookie Gotas", category: "Secos", unit: "g", quantity: 3200 },
      { id: "order-1441-item-4", code: "PR-3010", name: "Croissant", category: "Congelados", unit: "Un", quantity: 90 },
    ],
  },
];

export const storeOrderSummaries: StoreOrderSummary[] = mockStoreOrderDetails.map((order) => ({
  id: order.id,
  code: order.code,
  date: order.date,
  deliveryDate: order.deliveryDate,
  status: order.status,
  store: order.store,
}));

export function getStoreOrderById(orderId: string): StoreOrderDetail | null {
  return mockStoreOrderDetails.find((order) => order.id === orderId) ?? null;
}
