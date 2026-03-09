export type StoreOccurrenceSeedStatus = "aberta" | "em_analise" | "resolvida" | "fechada";

export interface StoreOccurrenceSeed {
  id: string;
  code: string;
  orderCode: string;
  product: string;
  type: string;
  quantitySummary: string;
  openDate: string;
  status: StoreOccurrenceSeedStatus;
}

export const initialStoreOccurrences: StoreOccurrenceSeed[] = [
  {
    id: "1",
    code: "OC-0001",
    orderCode: "PD-1443",
    product: "Pao Frances",
    type: "Quantidade incorreta",
    quantitySummary: "12 Un",
    openDate: "08/11/2025",
    status: "aberta",
  },
  {
    id: "2",
    code: "OC-0002",
    orderCode: "PD-1440",
    product: "Bolo Tapioca",
    type: "Produto danificado",
    quantitySummary: "1 Forma",
    openDate: "07/11/2025",
    status: "em_analise",
  },
  {
    id: "3",
    code: "OC-0003",
    orderCode: "PD-1435",
    product: "Sonho",
    type: "Atraso na entrega",
    quantitySummary: "100%",
    openDate: "05/11/2025",
    status: "resolvida",
  },
];
