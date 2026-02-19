import type { UnitCode } from "@/lib/factory-planning/units";

export type RecordStatus = "ativo" | "inativo";
export type LineType = "Seco" | "Úmido";
export type ScheduleStatus = "pendente" | "ativo" | "inativo";
export type ProductionWeekDay =
  | "segunda"
  | "terca"
  | "quarta"
  | "quinta"
  | "sexta"
  | "sabado"
  | "domingo";

export interface ProductionSector {
  id: string;
  code: string;
  name: string;
  responsible: string;
  status: RecordStatus;
}

export interface ProductionLine {
  id: string;
  code: string;
  name: string;
  sectorId: string;
  type: LineType;
  operatingHours: string;
  capacityPerDayKg: number;
  status: RecordStatus;
}

export interface ProductionProduct {
  id: string;
  code: string;
  name: string;
  lineId: string;
  active: boolean;
  weight: string;
  validityDays: number;
  minimumProductionKg: number;
  economicProductionKg: number;
  productionUnit: UnitCode;
  salesUnit: UnitCode;
  salesToKgFactor: number;
  expeditionUnit: UnitCode;
  expeditionToKgFactor: number;
  isMpiIngredient: boolean;
}

export interface WeeklyScheduleItem {
  id: string;
  productId: string;
  minimumProduction: number;
  productionDays: ProductionWeekDay[];
}

export interface WeeklyProductionSchedule {
  id: string;
  code: string;
  name: string;
  lineId: string;
  revisionOfId?: string;
  status: ScheduleStatus;
  createdAt: string;
  createdBy: string;
  auditedAt?: string;
  auditedBy?: string;
  auditNotes?: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  items: WeeklyScheduleItem[];
}

export const productionWeekDays: { key: ProductionWeekDay; label: string; shortLabel: string }[] = [
  { key: "segunda", label: "Segunda-feira", shortLabel: "Seg" },
  { key: "terca", label: "Terça-feira", shortLabel: "Ter" },
  { key: "quarta", label: "Quarta-feira", shortLabel: "Qua" },
  { key: "quinta", label: "Quinta-feira", shortLabel: "Qui" },
  { key: "sexta", label: "Sexta-feira", shortLabel: "Sex" },
  { key: "sabado", label: "Sábado", shortLabel: "Sab" },
  { key: "domingo", label: "Domingo", shortLabel: "Dom" },
];

export const productionSectors: ProductionSector[] = [
  {
    id: "sector-panificacao",
    code: "SE-001",
    name: "Panificação",
    responsible: "Maria Santos",
    status: "ativo",
  },
  {
    id: "sector-confeitaria",
    code: "SE-002",
    name: "Confeitaria",
    responsible: "João Silva",
    status: "ativo",
  },
  {
    id: "sector-rotisseria",
    code: "SE-003",
    name: "Rotisseria",
    responsible: "Rafaela Moura",
    status: "ativo",
  },
  {
    id: "sector-secos",
    code: "SE-004",
    name: "Secos",
    responsible: "Pedro Costa",
    status: "inativo",
  },
];

export const productionLines: ProductionLine[] = [
  {
    id: "line-paes",
    code: "LP-001",
    name: "Linha de Pães",
    sectorId: "sector-panificacao",
    type: "Seco",
    operatingHours: "04:30 - 13:30",
    capacityPerDayKg: 1500,
    status: "ativo",
  },
  {
    id: "line-confeitaria",
    code: "LP-002",
    name: "Linha de Confeitaria",
    sectorId: "sector-confeitaria",
    type: "Úmido",
    operatingHours: "05:30 - 14:30",
    capacityPerDayKg: 900,
    status: "ativo",
  },
  {
    id: "line-rotisseria",
    code: "LP-003",
    name: "Linha de Rotisseria",
    sectorId: "sector-rotisseria",
    type: "Úmido",
    operatingHours: "06:00 - 15:00",
    capacityPerDayKg: 1100,
    status: "ativo",
  },
  {
    id: "line-biscoitos",
    code: "LP-004",
    name: "Linha de Biscoitos",
    sectorId: "sector-secos",
    type: "Seco",
    operatingHours: "06:30 - 15:30",
    capacityPerDayKg: 540,
    status: "inativo",
  },
  {
    id: "line-salgados",
    code: "LP-005",
    name: "Linha de Salgados",
    sectorId: "sector-rotisseria",
    type: "Úmido",
    operatingHours: "07:00 - 16:30",
    capacityPerDayKg: 850,
    status: "ativo",
  },
];

export const productionProducts: ProductionProduct[] = [
  {
    id: "product-pao-frances",
    code: "PR-83374",
    name: "Pão Francês",
    lineId: "line-paes",
    active: true,
    weight: "0.05 Kg",
    validityDays: 5,
    minimumProductionKg: 200,
    economicProductionKg: 260,
    productionUnit: "Kg",
    salesUnit: "Un",
    salesToKgFactor: 0.05,
    expeditionUnit: "Pacote",
    expeditionToKgFactor: 2.5,
    isMpiIngredient: false,
  },
  {
    id: "product-pao-forma",
    code: "PR-83375",
    name: "Pão de Forma",
    lineId: "line-paes",
    active: true,
    weight: "0.45 Kg",
    validityDays: 6,
    minimumProductionKg: 150,
    economicProductionKg: 190,
    productionUnit: "Kg",
    salesUnit: "Un",
    salesToKgFactor: 0.45,
    expeditionUnit: "Caixa",
    expeditionToKgFactor: 9,
    isMpiIngredient: false,
  },
  {
    id: "product-pao-doce",
    code: "PR-83376",
    name: "Pão Doce",
    lineId: "line-paes",
    active: true,
    weight: "0.08 Kg",
    validityDays: 4,
    minimumProductionKg: 120,
    economicProductionKg: 180,
    productionUnit: "Kg",
    salesUnit: "Un",
    salesToKgFactor: 0.08,
    expeditionUnit: "Bandeja",
    expeditionToKgFactor: 2.4,
    isMpiIngredient: false,
  },
  {
    id: "product-bolo-tapioca",
    code: "PR-52797",
    name: "Bolo de Tapioca",
    lineId: "line-confeitaria",
    active: true,
    weight: "2.0 Kg",
    validityDays: 7,
    minimumProductionKg: 80,
    economicProductionKg: 120,
    productionUnit: "Forma",
    salesUnit: "Forma",
    salesToKgFactor: 2,
    expeditionUnit: "Forma",
    expeditionToKgFactor: 2,
    isMpiIngredient: false,
  },
  {
    id: "product-sonho",
    code: "PR-74072",
    name: "Sonho",
    lineId: "line-confeitaria",
    active: true,
    weight: "0.12 Kg",
    validityDays: 3,
    minimumProductionKg: 95,
    economicProductionKg: 140,
    productionUnit: "Dz",
    salesUnit: "Dz",
    salesToKgFactor: 1.44,
    expeditionUnit: "Bandeja",
    expeditionToKgFactor: 0.72,
    isMpiIngredient: false,
  },
  {
    id: "product-brownie",
    code: "PR-74090",
    name: "Brownie Tradicional",
    lineId: "line-confeitaria",
    active: true,
    weight: "1.2 Kg",
    validityDays: 6,
    minimumProductionKg: 70,
    economicProductionKg: 110,
    productionUnit: "Forma",
    salesUnit: "Forma",
    salesToKgFactor: 1.2,
    expeditionUnit: "Forma",
    expeditionToKgFactor: 1.2,
    isMpiIngredient: false,
  },
  {
    id: "product-frango-assado",
    code: "PR-44810",
    name: "Frango Assado",
    lineId: "line-rotisseria",
    active: true,
    weight: "1.6 Kg",
    validityDays: 2,
    minimumProductionKg: 180,
    economicProductionKg: 260,
    productionUnit: "Un",
    salesUnit: "Un",
    salesToKgFactor: 1.6,
    expeditionUnit: "Caixa",
    expeditionToKgFactor: 8,
    isMpiIngredient: false,
  },
  {
    id: "product-lasanha",
    code: "PR-44811",
    name: "Lasanha Bolonhesa",
    lineId: "line-rotisseria",
    active: true,
    weight: "3.8 Kg",
    validityDays: 5,
    minimumProductionKg: 140,
    economicProductionKg: 210,
    productionUnit: "Travessa",
    salesUnit: "Travessa",
    salesToKgFactor: 3.8,
    expeditionUnit: "Travessa",
    expeditionToKgFactor: 3.8,
    isMpiIngredient: false,
  },
  {
    id: "product-mistura-pao",
    code: "PR-22456",
    name: "Mistura Base de Pães",
    lineId: "line-biscoitos",
    active: false,
    weight: "0.5 Kg",
    validityDays: 30,
    minimumProductionKg: 40,
    economicProductionKg: 60,
    productionUnit: "Kg",
    salesUnit: "Kg",
    salesToKgFactor: 1,
    expeditionUnit: "Saco",
    expeditionToKgFactor: 25,
    isMpiIngredient: true,
  },
  {
    id: "product-coxinha",
    code: "PR-33991",
    name: "Coxinha",
    lineId: "line-salgados",
    active: true,
    weight: "0.11 Kg",
    validityDays: 2,
    minimumProductionKg: 110,
    economicProductionKg: 145,
    productionUnit: "Un",
    salesUnit: "Un",
    salesToKgFactor: 0.11,
    expeditionUnit: "Pacote",
    expeditionToKgFactor: 1.1,
    isMpiIngredient: false,
  },
  {
    id: "product-empada-frango",
    code: "PR-33992",
    name: "Empada de Frango",
    lineId: "line-salgados",
    active: true,
    weight: "0.13 Kg",
    validityDays: 3,
    minimumProductionKg: 95,
    economicProductionKg: 130,
    productionUnit: "Un",
    salesUnit: "Un",
    salesToKgFactor: 0.13,
    expeditionUnit: "Pacote",
    expeditionToKgFactor: 1.3,
    isMpiIngredient: false,
  },
];

export const weeklySchedules: WeeklyProductionSchedule[] = [
  {
    id: "schedule-paes",
    code: "SL-8401",
    name: "Sublinha Pães Tradicionais",
    lineId: "line-paes",
    status: "ativo",
    createdAt: "2026-02-10",
    createdBy: "Fernanda Engenharia",
    auditedAt: "2026-02-11",
    auditedBy: "Marcos Fábrica",
    auditNotes: "Sublinha liberada para execução contínua.",
    items: [
      {
        id: "item-1",
        productId: "product-pao-frances",
        minimumProduction: 2200,
        productionDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
      },
      {
        id: "item-2",
        productId: "product-pao-forma",
        minimumProduction: 520,
        productionDays: ["segunda", "quarta", "sexta"],
      },
      {
        id: "item-6",
        productId: "product-pao-doce",
        minimumProduction: 860,
        productionDays: ["terca", "quinta", "sabado"],
      },
    ],
  },
  {
    id: "schedule-confeitaria",
    code: "SL-8402",
    name: "Sublinha Confeitaria Padrão",
    lineId: "line-confeitaria",
    status: "ativo",
    createdAt: "2026-02-12",
    createdBy: "Fernanda Engenharia",
    auditedAt: "2026-02-13",
    auditedBy: "Marcos Fábrica",
    auditNotes: "Sublinha validada com mix de bolos e confeitaria fina.",
    items: [
      {
        id: "item-3",
        productId: "product-bolo-tapioca",
        minimumProduction: 90,
        productionDays: ["terca", "quinta", "sabado"],
      },
      {
        id: "item-4",
        productId: "product-sonho",
        minimumProduction: 240,
        productionDays: ["segunda", "terca", "quarta", "quinta", "sexta"],
      },
      {
        id: "item-7",
        productId: "product-brownie",
        minimumProduction: 80,
        productionDays: ["quarta", "sexta", "sabado"],
      },
    ],
  },
  {
    id: "schedule-rotisseria",
    code: "SL-8403",
    name: "Sublinha Rotisseria Quentes",
    lineId: "line-rotisseria",
    status: "ativo",
    createdAt: "2026-02-14",
    createdBy: "Fernanda Engenharia",
    auditedAt: "2026-02-15",
    auditedBy: "Marcos Fábrica",
    auditNotes: "Sublinha preparada para assados e travessas.",
    items: [
      {
        id: "item-8",
        productId: "product-frango-assado",
        minimumProduction: 150,
        productionDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
      },
      {
        id: "item-9",
        productId: "product-lasanha",
        minimumProduction: 70,
        productionDays: ["segunda", "quarta", "sexta"],
      },
    ],
  },
  {
    id: "schedule-salgados",
    code: "SL-8404",
    name: "Sublinha Salgados Forno e Frito",
    lineId: "line-salgados",
    status: "ativo",
    createdAt: "2026-02-14",
    createdBy: "Fernanda Engenharia",
    auditedAt: "2026-02-15",
    auditedBy: "Marcos Fábrica",
    auditNotes: "Sublinha ativa para abastecimento diário de salgado.",
    items: [
      {
        id: "item-10",
        productId: "product-coxinha",
        minimumProduction: 1300,
        productionDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
      },
      {
        id: "item-11",
        productId: "product-empada-frango",
        minimumProduction: 950,
        productionDays: ["segunda", "terca", "quarta", "quinta", "sexta"],
      },
    ],
  },
  {
    id: "schedule-biscoitos",
    code: "SL-8405",
    name: "Sublinha Biscoitos Secos",
    lineId: "line-biscoitos",
    status: "inativo",
    createdAt: "2026-02-12",
    createdBy: "Fernanda Engenharia",
    auditedAt: "2026-02-13",
    auditedBy: "Marcos Fábrica",
    auditNotes: "Linha desativada até ajuste de capacidade.",
    deactivatedAt: "2026-02-13",
    deactivatedBy: "Marcos Fábrica",
    items: [
      {
        id: "item-5",
        productId: "product-mistura-pao",
        minimumProduction: 65,
        productionDays: ["quarta"],
      },
    ],
  },
];

export const sectorsById = new Map(productionSectors.map((sector) => [sector.id, sector]));
export const linesById = new Map(productionLines.map((line) => [line.id, line]));
export const productsById = new Map(productionProducts.map((product) => [product.id, product]));

export function getLinesBySector(sectorId: string) {
  return productionLines.filter((line) => line.sectorId === sectorId);
}

export function getProductsByLine(lineId: string) {
  return productionProducts.filter((product) => product.lineId === lineId);
}

export function getSchedulesByLine(lineId: string, schedules: WeeklyProductionSchedule[]) {
  return schedules.filter((schedule) => schedule.lineId === lineId);
}

export function getMinimumProductionTotal(schedule: WeeklyProductionSchedule) {
  return schedule.items.reduce((sum, item) => sum + item.minimumProduction, 0);
}

export function getPlannedDaysCount(schedule: WeeklyProductionSchedule) {
  return schedule.items.reduce((sum, item) => sum + item.productionDays.length, 0);
}

export function formatDateBr(dateIso: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${dateIso}T00:00:00`));
}
