import type { ProductionItemStatus } from "@/lib/order-planning";

export const PRODUCTION_ITEM_STATUS_OPTIONS: Array<{ value: ProductionItemStatus; label: string }> = [
  { value: "nao_iniciado", label: "Não iniciado" },
  { value: "em_preparacao", label: "Em preparação" },
  { value: "em_producao", label: "Em produção" },
  { value: "em_forno", label: "Em forno" },
  { value: "embalando", label: "Embalando" },
  { value: "concluido", label: "Concluído" },
];
