import type { UnitCode } from "@/lib/factory-planning/units";

export type RecordStatus = "ativo" | "inativo";
export type LineType = "Seco" | "Úmido";
export type ScheduleStatus = "pendente" | "ativo" | "inativo";
export type IngredientType = "puro" | "misturado";
export type RecipeSourceType = "ingrediente" | "produto";
export type BreakStage =
  | "antes_divisao"
  | "depois_divisao"
  | "antes_forno"
  | "depois_forno";
export type ProductionWeekDay =
  | "segunda"
  | "terca"
  | "quarta"
  | "quinta"
  | "sexta"
  | "sabado"
  | "domingo";

export interface ProductUnitProfile {
  unit: UnitCode;
  description: string;
  weightKg: number;
}

export interface PackagingProfile {
  unit: UnitCode;
  description: string;
  weightKg: number;
  quantityPerPackage: number;
}

export interface IngredientCompositionItem {
  id: string;
  ingredientId?: string;
  productId?: string;
  name: string;
  quantity: number;
  unit: UnitCode;
  observation: string;
}

export interface IngredientProfileMirror {
  unit: UnitCode;
  weightKg: number;
  metadata: string;
  observation: string;
}

export interface RecipeIngredientReference {
  id: string;
  sourceType: RecipeSourceType;
  sourceId: string;
  label: string;
  quantity: number;
  unit: UnitCode;
}

export interface ProductionIngredient {
  id: string;
  code: string;
  externalCode?: string;
  createdAt?: string;
  updatedAt?: string;
  name: string;
  type: IngredientType;
  unit: UnitCode;
  metadata: string;
  observation: string;
  composition: IngredientCompositionItem[];
  status: RecordStatus;
}

export interface OperationalSettings {
  orderCutoffTime: string;
  expeditionLeadDays: number;
}

export interface StoreMasterData {
  id: string;
  code: string;
  createdAt?: string;
  updatedAt?: string;
  name: string;
  responsible: string;
  email: string;
  phone: string;
  status: RecordStatus;
  receiveWindow: string;
  orderingDays: ProductionWeekDay[];
  receivingDays: ProductionWeekDay[];
  orderingBlockedDays: ProductionWeekDay[];
  receivingBlockedDays: ProductionWeekDay[];
}

export interface ProductionSector {
  id: string;
  code: string;
  createdAt?: string;
  updatedAt?: string;
  name: string;
  responsible: string;
  status: RecordStatus;
}

export interface ProductionLine {
  id: string;
  code: string;
  createdAt?: string;
  updatedAt?: string;
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
  externalCode?: string;
  createdAt?: string;
  updatedAt?: string;
  name: string;
  description: string;
  lineId: string;
  masterLineId?: string;
  operationalLineId?: string;
  active: boolean;
  availableForOrdering: boolean;
  validityDays: number;
  minimumProductionKg: number;
  economicProductionKg: number;
  allowsStorage: boolean;
  productionDays: ProductionWeekDay[];
  unitProfiles: {
    sales: ProductUnitProfile;
    production: ProductUnitProfile;
    expedition: ProductUnitProfile;
  };
  packagingProfile?: PackagingProfile;
  isSoldLoose: boolean;
  recipe: RecipeIngredientReference[];
  preparationMode: string;
  breakPercent: number;
  breakStage: BreakStage;
  breakComment: string;
  canBeIngredient: boolean;
  ingredientProfile?: IngredientProfileMirror;
  weight: string;
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

export const hierarchyLabels = {
  sector: "Categoria",
  line: "Subcategoria",
  schedule: "Linha",
} as const;

export const productionWeekDays: { key: ProductionWeekDay; label: string; shortLabel: string }[] = [
  { key: "segunda", label: "Segunda-feira", shortLabel: "Seg" },
  { key: "terca", label: "Terça-feira", shortLabel: "Ter" },
  { key: "quarta", label: "Quarta-feira", shortLabel: "Qua" },
  { key: "quinta", label: "Quinta-feira", shortLabel: "Qui" },
  { key: "sexta", label: "Sexta-feira", shortLabel: "Sex" },
  { key: "sabado", label: "Sábado", shortLabel: "Sab" },
  { key: "domingo", label: "Domingo", shortLabel: "Dom" },
];

export const operationalSettings: OperationalSettings = {
  orderCutoffTime: "18:00",
  expeditionLeadDays: 2,
};

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
    id: "line-salgados",
    code: "LP-004",
    name: "Linha de Salgados",
    sectorId: "sector-rotisseria",
    type: "Úmido",
    operatingHours: "07:00 - 16:30",
    capacityPerDayKg: 850,
    status: "ativo",
  },
];

export const productionIngredients: ProductionIngredient[] = [
  {
    id: "ing-farinha",
    code: "IN-572015",
    name: "Farinha de Trigo",
    type: "puro",
    unit: "Kg",
    metadata: "Matéria-prima base de panificação.",
    observation: "",
    composition: [],
    status: "ativo",
    externalCode: undefined,
  },
  {
    id: "ing-acucar",
    code: "IN-572016",
    name: "Açúcar",
    type: "puro",
    unit: "Kg",
    metadata: "Açúcar refinado padrão.",
    observation: "",
    composition: [],
    status: "ativo",
  },
  {
    id: "ing-fermento",
    code: "IN-572017",
    name: "Fermento",
    type: "puro",
    unit: "Kg",
    metadata: "Fermentação panificação.",
    observation: "",
    composition: [],
    status: "ativo",
  },
  {
    id: "ing-leite-condensado",
    code: "IN-572018",
    name: "Leite Condensado",
    type: "puro",
    unit: "Kg",
    metadata: "Base de confeitaria.",
    observation: "",
    composition: [],
    status: "ativo",
  },
  {
    id: "ing-leite",
    code: "IN-572019",
    name: "Leite Tipo C",
    type: "puro",
    unit: "L",
    metadata: "Leite integral.",
    observation: "",
    composition: [],
    status: "ativo",
  },
  {
    id: "ing-ovo",
    code: "IN-572020",
    name: "Ovo Pasteurizado",
    type: "puro",
    unit: "Kg",
    metadata: "Ovos líquidos para produção.",
    observation: "",
    composition: [],
    status: "ativo",
  },
  {
    id: "ing-calda-pudim",
    code: "IN-572021",
    name: "Calda para Pudim",
    type: "puro",
    unit: "Kg",
    metadata: "Cobertura final de pudim.",
    observation: "",
    composition: [],
    status: "ativo",
  },
  {
    id: "ing-mistura-neutra",
    code: "IN-572022",
    name: "Mistura Neutra de Bolo",
    type: "misturado",
    unit: "Kg",
    metadata: "MPI de confeitaria usada como base.",
    observation: "Usar como base para bolos especiais e receitas padronizadas.",
    composition: [
      {
        id: "mix-1",
        ingredientId: "ing-farinha",
        name: "Farinha de Trigo",
        quantity: 0.68,
        unit: "Kg",
        observation: "",
      },
      {
        id: "mix-2",
        ingredientId: "ing-acucar",
        name: "Açúcar",
        quantity: 0.18,
        unit: "Kg",
        observation: "",
      },
      {
        id: "mix-3",
        ingredientId: "ing-fermento",
        name: "Fermento",
        quantity: 0.14,
        unit: "Kg",
        observation: "",
      },
    ],
    status: "ativo",
  },
];

export const storesMasterData: StoreMasterData[] = [
  {
    id: "store-01",
    code: "LJ-001",
    name: "Empório do Pão",
    responsible: "Rommel Filho",
    email: "loja1@casaexpress.com",
    phone: "(85) 98888-1101",
    status: "ativo",
    receiveWindow: "07:00 - 10:00",
    orderingDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
    receivingDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
    orderingBlockedDays: [],
    receivingBlockedDays: [],
  },
  {
    id: "store-02",
    code: "LJ-002",
    name: "Padaria Central",
    responsible: "Carlos Silva",
    email: "loja2@casaexpress.com",
    phone: "(85) 98888-1102",
    status: "ativo",
    receiveWindow: "08:00 - 11:00",
    orderingDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"],
    receivingDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"],
    orderingBlockedDays: [],
    receivingBlockedDays: [],
  },
  {
    id: "store-03",
    code: "LJ-003",
    name: "Casa Express Pinheiros",
    responsible: "Michele Nunes",
    email: "loja3@casaexpress.com",
    phone: "(85) 98888-1103",
    status: "ativo",
    receiveWindow: "06:30 - 09:00",
    orderingDays: ["segunda", "terca", "quarta", "quinta", "sexta"],
    receivingDays: ["segunda", "terca", "quarta", "quinta", "sexta"],
    orderingBlockedDays: [],
    receivingBlockedDays: [],
  },
];

function createUnitProfile(unit: UnitCode, description: string, weightKg: number): ProductUnitProfile {
  return {
    unit,
    description,
    weightKg: unit === "Kg" ? 1 : weightKg,
  };
}

function createLegacyWeight(value: number): string {
  return `${value.toFixed(3)} Kg`;
}

export const productionProducts: ProductionProduct[] = [
  {
    id: "product-pao-frances",
    code: "PR-83374",
    name: "Pão Francês",
    description: "Pão francês tradicional para venda unitária.",
    lineId: "line-paes",
    active: true,
    availableForOrdering: true,
    validityDays: 5,
    minimumProductionKg: 220,
    economicProductionKg: 280,
    allowsStorage: false,
    productionDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
    unitProfiles: {
      sales: createUnitProfile("Un", "Unidade de venda", 0.05),
      production: createUnitProfile("Kg", "Massa padrão", 1),
      expedition: createUnitProfile("Pacote", "Pacote para separação", 0.5),
    },
    packagingProfile: {
      unit: "Pacote",
      description: "Pacote de balcão",
      weightKg: 0.5,
      quantityPerPackage: 10,
    },
    isSoldLoose: false,
    recipe: [
      {
        id: "recipe-pf-1",
        sourceType: "ingrediente",
        sourceId: "ing-farinha",
        label: "Farinha de Trigo",
        quantity: 0.88,
        unit: "Kg",
      },
      {
        id: "recipe-pf-2",
        sourceType: "ingrediente",
        sourceId: "ing-fermento",
        label: "Fermento",
        quantity: 0.03,
        unit: "Kg",
      },
    ],
    preparationMode: "Fermentar, dividir, modelar e assar.",
    breakPercent: 4,
    breakStage: "depois_divisao",
    breakComment: "Perda usual depois da divisão e modelagem.",
    canBeIngredient: false,
    ingredientProfile: undefined,
    weight: createLegacyWeight(0.05),
    productionUnit: "Kg",
    salesUnit: "Un",
    salesToKgFactor: 0.05,
    expeditionUnit: "Pacote",
    expeditionToKgFactor: 0.5,
    isMpiIngredient: false,
  },
  {
    id: "product-pao-forma",
    code: "PR-83375",
    name: "Pão de Forma",
    description: "Pão de forma fatiado.",
    lineId: "line-paes",
    active: true,
    availableForOrdering: true,
    validityDays: 6,
    minimumProductionKg: 150,
    economicProductionKg: 190,
    allowsStorage: true,
    productionDays: ["segunda", "quarta", "sexta"],
    unitProfiles: {
      sales: createUnitProfile("Un", "Unidade de venda", 0.45),
      production: createUnitProfile("Forma", "Forma de produção", 0.9),
      expedition: createUnitProfile("Caixa", "Caixa de expedição", 5.4),
    },
    packagingProfile: {
      unit: "Pacote",
      description: "Pacote fatiado",
      weightKg: 0.45,
      quantityPerPackage: 1,
    },
    isSoldLoose: false,
    recipe: [
      {
        id: "recipe-pfoma-1",
        sourceType: "ingrediente",
        sourceId: "ing-farinha",
        label: "Farinha de Trigo",
        quantity: 0.82,
        unit: "Kg",
      },
      {
        id: "recipe-pfoma-2",
        sourceType: "ingrediente",
        sourceId: "ing-acucar",
        label: "Açúcar",
        quantity: 0.05,
        unit: "Kg",
      },
    ],
    preparationMode: "Misturar, cilindrar e assar em forma fechada.",
    breakPercent: 5,
    breakStage: "antes_forno",
    breakComment: "Compensar perda antes do forno para manter peso final.",
    canBeIngredient: true,
    ingredientProfile: {
      unit: "Un",
      weightKg: 0.45,
      metadata: "Produto pode ser consumido como base de sanduíches.",
      observation: "Usar somente após resfriamento.",
    },
    weight: createLegacyWeight(0.45),
    productionUnit: "Forma",
    salesUnit: "Un",
    salesToKgFactor: 0.45,
    expeditionUnit: "Caixa",
    expeditionToKgFactor: 5.4,
    isMpiIngredient: true,
  },
  {
    id: "product-pao-doce",
    code: "PR-83376",
    name: "Pão Doce",
    description: "Pão doce individual.",
    lineId: "line-paes",
    active: true,
    availableForOrdering: true,
    validityDays: 4,
    minimumProductionKg: 120,
    economicProductionKg: 180,
    allowsStorage: false,
    productionDays: ["terca", "quinta", "sabado"],
    unitProfiles: {
      sales: createUnitProfile("Un", "Unidade de venda", 0.08),
      production: createUnitProfile("Assadeira", "Assadeira de produção", 1.6),
      expedition: createUnitProfile("Bandeja", "Bandeja para loja", 0.96),
    },
    packagingProfile: {
      unit: "Bandeja",
      description: "Bandeja padrão",
      weightKg: 0.96,
      quantityPerPackage: 12,
    },
    isSoldLoose: false,
    recipe: [
      {
        id: "recipe-pd-1",
        sourceType: "ingrediente",
        sourceId: "ing-farinha",
        label: "Farinha de Trigo",
        quantity: 0.78,
        unit: "Kg",
      },
      {
        id: "recipe-pd-2",
        sourceType: "ingrediente",
        sourceId: "ing-acucar",
        label: "Açúcar",
        quantity: 0.11,
        unit: "Kg",
      },
      {
        id: "recipe-pd-3",
        sourceType: "ingrediente",
        sourceId: "ing-fermento",
        label: "Fermento",
        quantity: 0.025,
        unit: "Kg",
      },
    ],
    preparationMode: "Modelar, fermentar e finalizar com cobertura.",
    breakPercent: 6,
    breakStage: "depois_divisao",
    breakComment: "Quebra calculada após divisão e acabamento.",
    canBeIngredient: false,
    ingredientProfile: undefined,
    weight: createLegacyWeight(0.08),
    productionUnit: "Assadeira",
    salesUnit: "Un",
    salesToKgFactor: 0.08,
    expeditionUnit: "Bandeja",
    expeditionToKgFactor: 0.96,
    isMpiIngredient: false,
  },
  {
    id: "product-mpi-base-pudim",
    code: "MPI-001",
    name: "MPI Base para Pudim",
    description: "Base industrializada produzida internamente para família de pudins.",
    lineId: "line-confeitaria",
    active: true,
    availableForOrdering: false,
    validityDays: 2,
    minimumProductionKg: 8,
    economicProductionKg: 15,
    allowsStorage: false,
    productionDays: ["segunda", "quarta", "sexta"],
    unitProfiles: {
      sales: createUnitProfile("Kg", "Unidade interna de engenharia", 1),
      production: createUnitProfile("Kg", "Batida de base", 1),
      expedition: createUnitProfile("Kg", "Consumo interno", 1),
    },
    isSoldLoose: true,
    recipe: [
      {
        id: "recipe-mpi-pudim-1",
        sourceType: "ingrediente",
        sourceId: "ing-leite-condensado",
        label: "Leite Condensado",
        quantity: 5.651,
        unit: "Kg",
      },
      {
        id: "recipe-mpi-pudim-2",
        sourceType: "ingrediente",
        sourceId: "ing-leite",
        label: "Leite Tipo C",
        quantity: 2.129,
        unit: "L",
      },
      {
        id: "recipe-mpi-pudim-3",
        sourceType: "ingrediente",
        sourceId: "ing-ovo",
        label: "Ovo Pasteurizado",
        quantity: 0.398,
        unit: "Kg",
      },
    ],
    preparationMode: "Bater até homogeneizar e reservar para montagem dos pudins.",
    breakPercent: 0,
    breakStage: "antes_divisao",
    breakComment: "Sem quebra planejada na base.",
    canBeIngredient: true,
    ingredientProfile: {
      unit: "Kg",
      weightKg: 1,
      metadata: "MPI produzido na própria fábrica.",
      observation: "Consumir no mesmo dia da produção.",
    },
    weight: createLegacyWeight(1),
    productionUnit: "Kg",
    salesUnit: "Kg",
    salesToKgFactor: 1,
    expeditionUnit: "Kg",
    expeditionToKgFactor: 1,
    isMpiIngredient: true,
  },
  {
    id: "product-pudim-mini",
    code: "PR-02197",
    name: "Pudim Leite Condensado Mini",
    description: "Pudim mini moldado individualmente.",
    lineId: "line-confeitaria",
    active: true,
    availableForOrdering: true,
    validityDays: 4,
    minimumProductionKg: 12,
    economicProductionKg: 18,
    allowsStorage: true,
    productionDays: ["segunda", "quarta", "sexta"],
    unitProfiles: {
      sales: createUnitProfile("Un", "Unidade de venda", 0.098),
      production: createUnitProfile("Forma", "Forma mini", 4.218),
      expedition: createUnitProfile("Caixa", "Caixa térmica", 4.218),
    },
    packagingProfile: {
      unit: "Caixa",
      description: "Caixa com 43 unidades",
      weightKg: 4.218,
      quantityPerPackage: 43,
    },
    isSoldLoose: false,
    recipe: [
      {
        id: "recipe-pudim-mini-1",
        sourceType: "produto",
        sourceId: "product-mpi-base-pudim",
        label: "MPI Base para Pudim",
        quantity: 4.218,
        unit: "Kg",
      },
      {
        id: "recipe-pudim-mini-2",
        sourceType: "ingrediente",
        sourceId: "ing-calda-pudim",
        label: "Calda para Pudim",
        quantity: 0.398,
        unit: "Kg",
      },
    ],
    preparationMode: "Porcionar a base, finalizar com calda e assar em banho-maria.",
    breakPercent: 1.5,
    breakStage: "depois_forno",
    breakComment: "Pequena perda após desenformar.",
    canBeIngredient: false,
    ingredientProfile: undefined,
    weight: createLegacyWeight(0.098),
    productionUnit: "Forma",
    salesUnit: "Un",
    salesToKgFactor: 0.098,
    expeditionUnit: "Caixa",
    expeditionToKgFactor: 4.218,
    isMpiIngredient: false,
  },
  {
    id: "product-pudim-medio",
    code: "PR-02205",
    name: "Pudim Leite Condensado Médio",
    description: "Pudim médio para exposição e encomenda.",
    lineId: "line-confeitaria",
    active: true,
    availableForOrdering: true,
    validityDays: 4,
    minimumProductionKg: 10,
    economicProductionKg: 16,
    allowsStorage: true,
    productionDays: ["segunda", "quarta", "sexta"],
    unitProfiles: {
      sales: createUnitProfile("Un", "Unidade de venda", 0.311),
      production: createUnitProfile("Forma", "Forma média", 8.698),
      expedition: createUnitProfile("Caixa", "Caixa média", 8.698),
    },
    packagingProfile: {
      unit: "Caixa",
      description: "Caixa com 28 unidades",
      weightKg: 8.698,
      quantityPerPackage: 28,
    },
    isSoldLoose: false,
    recipe: [
      {
        id: "recipe-pudim-medio-1",
        sourceType: "produto",
        sourceId: "product-mpi-base-pudim",
        label: "MPI Base para Pudim",
        quantity: 8.697,
        unit: "Kg",
      },
      {
        id: "recipe-pudim-medio-2",
        sourceType: "ingrediente",
        sourceId: "ing-calda-pudim",
        label: "Calda para Pudim",
        quantity: 0.571,
        unit: "Kg",
      },
    ],
    preparationMode: "Dosar a base, cobrir com calda e finalizar no forno.",
    breakPercent: 1.2,
    breakStage: "depois_forno",
    breakComment: "Ajuste de rendimento após resfriamento.",
    canBeIngredient: false,
    ingredientProfile: undefined,
    weight: createLegacyWeight(0.311),
    productionUnit: "Forma",
    salesUnit: "Un",
    salesToKgFactor: 0.311,
    expeditionUnit: "Caixa",
    expeditionToKgFactor: 8.698,
    isMpiIngredient: false,
  },
  {
    id: "product-pudim-grande",
    code: "PR-00378",
    name: "Pudim Leite Condensado Grande",
    description: "Pudim grande para confeitaria.",
    lineId: "line-confeitaria",
    active: true,
    availableForOrdering: true,
    validityDays: 4,
    minimumProductionKg: 8,
    economicProductionKg: 12,
    allowsStorage: true,
    productionDays: ["segunda", "quarta", "sexta"],
    unitProfiles: {
      sales: createUnitProfile("Un", "Unidade de venda", 1.065),
      production: createUnitProfile("Forma", "Forma grande", 2.13),
      expedition: createUnitProfile("Caixa", "Caixa grande", 2.13),
    },
    packagingProfile: {
      unit: "Caixa",
      description: "Caixa com 2 unidades",
      weightKg: 2.13,
      quantityPerPackage: 2,
    },
    isSoldLoose: false,
    recipe: [
      {
        id: "recipe-pudim-grande-1",
        sourceType: "produto",
        sourceId: "product-mpi-base-pudim",
        label: "MPI Base para Pudim",
        quantity: 2.13,
        unit: "Kg",
      },
      {
        id: "recipe-pudim-grande-2",
        sourceType: "ingrediente",
        sourceId: "ing-calda-pudim",
        label: "Calda para Pudim",
        quantity: 0.089,
        unit: "Kg",
      },
    ],
    preparationMode: "Montagem em forma grande com calda e cocção lenta.",
    breakPercent: 0.8,
    breakStage: "depois_forno",
    breakComment: "Perda mínima após desenformar.",
    canBeIngredient: false,
    ingredientProfile: undefined,
    weight: createLegacyWeight(1.065),
    productionUnit: "Forma",
    salesUnit: "Un",
    salesToKgFactor: 1.065,
    expeditionUnit: "Caixa",
    expeditionToKgFactor: 2.13,
    isMpiIngredient: false,
  },
  {
    id: "product-brownie",
    code: "PR-74090",
    name: "Brownie Tradicional",
    description: "Brownie embalado individualmente, vendido em kg.",
    lineId: "line-confeitaria",
    active: true,
    availableForOrdering: true,
    validityDays: 6,
    minimumProductionKg: 70,
    economicProductionKg: 110,
    allowsStorage: true,
    productionDays: ["terca", "quinta", "sabado"],
    unitProfiles: {
      sales: createUnitProfile("Kg", "Venda a granel", 1),
      production: createUnitProfile("Assadeira", "Assadeira padrão", 1.2),
      expedition: createUnitProfile("Caixa", "Caixa fechada", 2.4),
    },
    packagingProfile: {
      unit: "Un",
      description: "Brownie embalado individualmente",
      weightKg: 0.12,
      quantityPerPackage: 20,
    },
    isSoldLoose: true,
    recipe: [
      {
        id: "recipe-brownie-1",
        sourceType: "ingrediente",
        sourceId: "ing-mistura-neutra",
        label: "Mistura Neutra de Bolo",
        quantity: 0.82,
        unit: "Kg",
      },
      {
        id: "recipe-brownie-2",
        sourceType: "ingrediente",
        sourceId: "ing-ovo",
        label: "Ovo Pasteurizado",
        quantity: 0.18,
        unit: "Kg",
      },
    ],
    preparationMode: "Misturar, assar e porcionar individualmente.",
    breakPercent: 8,
    breakStage: "depois_divisao",
    breakComment: "Considerar rebarbas no porcionamento individual.",
    canBeIngredient: false,
    ingredientProfile: undefined,
    weight: createLegacyWeight(1),
    productionUnit: "Assadeira",
    salesUnit: "Kg",
    salesToKgFactor: 1,
    expeditionUnit: "Caixa",
    expeditionToKgFactor: 2.4,
    isMpiIngredient: false,
  },
  {
    id: "product-frango-assado",
    code: "PR-44810",
    name: "Frango Assado",
    description: "Frango inteiro assado para rotisseria.",
    lineId: "line-rotisseria",
    active: true,
    availableForOrdering: true,
    validityDays: 2,
    minimumProductionKg: 180,
    economicProductionKg: 260,
    allowsStorage: false,
    productionDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
    unitProfiles: {
      sales: createUnitProfile("Un", "Unidade de venda", 1.6),
      production: createUnitProfile("Assadeira", "Assadeira do forno", 8),
      expedition: createUnitProfile("Caixa", "Caixa térmica", 8),
    },
    packagingProfile: {
      unit: "Caixa",
      description: "Caixa térmica com 5 unidades",
      weightKg: 8,
      quantityPerPackage: 5,
    },
    isSoldLoose: false,
    recipe: [
      {
        id: "recipe-frango-1",
        sourceType: "ingrediente",
        sourceId: "ing-acucar",
        label: "Tempero Base",
        quantity: 0.04,
        unit: "Kg",
      },
    ],
    preparationMode: "Temperar, assar e embalar em caixa térmica.",
    breakPercent: 3,
    breakStage: "antes_forno",
    breakComment: "Ajuste de perda de cocção antes do forno.",
    canBeIngredient: false,
    ingredientProfile: undefined,
    weight: createLegacyWeight(1.6),
    productionUnit: "Assadeira",
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
    description: "Travessa de lasanha para rotisseria.",
    lineId: "line-rotisseria",
    active: true,
    availableForOrdering: true,
    validityDays: 5,
    minimumProductionKg: 140,
    economicProductionKg: 210,
    allowsStorage: true,
    productionDays: ["segunda", "quarta", "sexta"],
    unitProfiles: {
      sales: createUnitProfile("Travessa", "Travessa de venda", 3.8),
      production: createUnitProfile("Travessa", "Travessa de produção", 3.8),
      expedition: createUnitProfile("Caixa", "Caixa de transporte", 7.6),
    },
    packagingProfile: {
      unit: "Caixa",
      description: "Caixa com 2 travessas",
      weightKg: 7.6,
      quantityPerPackage: 2,
    },
    isSoldLoose: false,
    recipe: [
      {
        id: "recipe-lasanha-1",
        sourceType: "ingrediente",
        sourceId: "ing-mistura-neutra",
        label: "Base Molho",
        quantity: 0.72,
        unit: "Kg",
      },
    ],
    preparationMode: "Montar em camadas, assar e resfriar antes da expedição.",
    breakPercent: 2.5,
    breakStage: "depois_forno",
    breakComment: "Quebra após assar e resfriar.",
    canBeIngredient: false,
    ingredientProfile: undefined,
    weight: createLegacyWeight(3.8),
    productionUnit: "Travessa",
    salesUnit: "Travessa",
    salesToKgFactor: 3.8,
    expeditionUnit: "Caixa",
    expeditionToKgFactor: 7.6,
    isMpiIngredient: false,
  },
  {
    id: "product-coxinha",
    code: "PR-33991",
    name: "Coxinha",
    description: "Salgado unitário de vitrine.",
    lineId: "line-salgados",
    active: true,
    availableForOrdering: true,
    validityDays: 2,
    minimumProductionKg: 110,
    economicProductionKg: 145,
    allowsStorage: false,
    productionDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
    unitProfiles: {
      sales: createUnitProfile("Un", "Unidade de venda", 0.11),
      production: createUnitProfile("Bandeja", "Bandeja de fritura", 2.2),
      expedition: createUnitProfile("Caixa", "Caixa de expedição", 2.2),
    },
    packagingProfile: {
      unit: "Caixa",
      description: "Caixa com 20 unidades",
      weightKg: 2.2,
      quantityPerPackage: 20,
    },
    isSoldLoose: false,
    recipe: [
      {
        id: "recipe-coxinha-1",
        sourceType: "ingrediente",
        sourceId: "ing-farinha",
        label: "Farinha de Trigo",
        quantity: 0.4,
        unit: "Kg",
      },
    ],
    preparationMode: "Modelar, empanar e fritar.",
    breakPercent: 3,
    breakStage: "depois_divisao",
    breakComment: "Ajuste por empanamento e fritura.",
    canBeIngredient: false,
    ingredientProfile: undefined,
    weight: createLegacyWeight(0.11),
    productionUnit: "Bandeja",
    salesUnit: "Un",
    salesToKgFactor: 0.11,
    expeditionUnit: "Caixa",
    expeditionToKgFactor: 2.2,
    isMpiIngredient: false,
  },
  {
    id: "product-empada-frango",
    code: "PR-33992",
    name: "Empada de Frango",
    description: "Empada unitária de balcão.",
    lineId: "line-salgados",
    active: true,
    availableForOrdering: true,
    validityDays: 3,
    minimumProductionKg: 95,
    economicProductionKg: 130,
    allowsStorage: false,
    productionDays: ["segunda", "terca", "quarta", "quinta", "sexta"],
    unitProfiles: {
      sales: createUnitProfile("Un", "Unidade de venda", 0.13),
      production: createUnitProfile("Bandeja", "Bandeja de forno", 2.6),
      expedition: createUnitProfile("Caixa", "Caixa padrão", 2.6),
    },
    packagingProfile: {
      unit: "Caixa",
      description: "Caixa com 20 unidades",
      weightKg: 2.6,
      quantityPerPackage: 20,
    },
    isSoldLoose: false,
    recipe: [
      {
        id: "recipe-empada-1",
        sourceType: "ingrediente",
        sourceId: "ing-farinha",
        label: "Farinha de Trigo",
        quantity: 0.46,
        unit: "Kg",
      },
    ],
    preparationMode: "Forrar, rechear e assar.",
    breakPercent: 2.8,
    breakStage: "depois_forno",
    breakComment: "Pequenas perdas na saída do forno.",
    canBeIngredient: false,
    ingredientProfile: undefined,
    weight: createLegacyWeight(0.13),
    productionUnit: "Bandeja",
    salesUnit: "Un",
    salesToKgFactor: 0.13,
    expeditionUnit: "Caixa",
    expeditionToKgFactor: 2.6,
    isMpiIngredient: false,
  },
];

const weeklyScheduleMetadata: Omit<WeeklyProductionSchedule, "items">[] = [
  {
    id: "schedule-paes",
    code: "SL-8401",
    name: "Linha Pães Tradicionais",
    lineId: "line-paes",
    status: "ativo",
    createdAt: "2026-02-10",
    createdBy: "Fernanda Engenharia",
    auditedAt: "2026-02-11",
    auditedBy: "Marcos Fábrica",
    auditNotes: "Linha liberada para execução contínua.",
  },
  {
    id: "schedule-confeitaria",
    code: "SL-8402",
    name: "Linha Confeitaria Base",
    lineId: "line-confeitaria",
    status: "ativo",
    createdAt: "2026-02-12",
    createdBy: "Fernanda Engenharia",
    auditedAt: "2026-02-13",
    auditedBy: "Marcos Fábrica",
    auditNotes: "Linha validada com foco em pudins e confeitaria fina.",
  },
  {
    id: "schedule-rotisseria",
    code: "SL-8403",
    name: "Linha Rotisseria Quentes",
    lineId: "line-rotisseria",
    status: "ativo",
    createdAt: "2026-02-14",
    createdBy: "Fernanda Engenharia",
    auditedAt: "2026-02-15",
    auditedBy: "Marcos Fábrica",
    auditNotes: "Linha preparada para assados e travessas.",
  },
  {
    id: "schedule-salgados",
    code: "SL-8404",
    name: "Linha Salgados Forno e Frito",
    lineId: "line-salgados",
    status: "ativo",
    createdAt: "2026-02-14",
    createdBy: "Fernanda Engenharia",
    auditedAt: "2026-02-15",
    auditedBy: "Marcos Fábrica",
    auditNotes: "Linha ativa para abastecimento diário de salgado.",
  },
];

export const sectorsById = new Map(productionSectors.map((sector) => [sector.id, sector]));
export const linesById = new Map(productionLines.map((line) => [line.id, line]));
export const productsById = new Map(productionProducts.map((product) => [product.id, product]));
export const ingredientsById = new Map(productionIngredients.map((ingredient) => [ingredient.id, ingredient]));
export const storesById = new Map(storesMasterData.map((store) => [store.id, store]));

function sortProductionDays(days: ProductionWeekDay[]) {
  const indexByDay = new Map(productionWeekDays.map((day, index) => [day.key, index]));
  return [...days].sort((a, b) => (indexByDay.get(a) ?? 0) - (indexByDay.get(b) ?? 0));
}

function buildDerivedScheduleItems(lineId: string, products = productionProducts): WeeklyScheduleItem[] {
  return products
    .filter((product) => (product.operationalLineId ?? product.lineId) === lineId && product.active)
    .map((product) => ({
      id: `item-${lineId}-${product.id}`,
      productId: product.id,
      minimumProduction: product.minimumProductionKg,
      productionDays: sortProductionDays(product.productionDays),
    }));
}

export const weeklySchedules: WeeklyProductionSchedule[] = weeklyScheduleMetadata.map((schedule) => ({
  ...schedule,
  items: buildDerivedScheduleItems(schedule.lineId),
}));

export function getLinesBySector(sectorId: string) {
  return productionLines.filter((line) => line.sectorId === sectorId);
}

export function getProductsByLine(lineId: string) {
  return productionProducts.filter((product) => (product.operationalLineId ?? product.lineId) === lineId);
}

export function getOrderableProductsByLine(lineId: string) {
  return productionProducts.filter(
    (product) =>
      (product.operationalLineId ?? product.lineId) === lineId &&
      product.active &&
      product.availableForOrdering,
  );
}

export function getSchedulesByLine(lineId: string, schedules: WeeklyProductionSchedule[]) {
  return schedules
    .filter((schedule) => schedule.lineId === lineId)
    .map((schedule) => ({
      ...schedule,
      items: buildDerivedScheduleItems(lineId),
    }));
}

export function getMinimumProductionTotal(schedule: WeeklyProductionSchedule) {
  return schedule.items.reduce((sum, item) => sum + item.minimumProduction, 0);
}

export function getPlannedDaysCount(schedule: WeeklyProductionSchedule) {
  return new Set(schedule.items.flatMap((item) => item.productionDays)).size;
}

export function getStoreReceivesSunday(store: Pick<StoreMasterData, "receivingDays">) {
  return (store.receivingDays ?? []).includes("domingo");
}

export function getStoreCanOrderSunday(store: Pick<StoreMasterData, "orderingDays">) {
  return (store.orderingDays ?? []).includes("domingo");
}

export function getEnabledOrderingDays(
  store: Pick<StoreMasterData, "orderingDays" | "orderingBlockedDays">,
) {
  const orderingDays = store.orderingDays ?? [];
  const blockedDays = store.orderingBlockedDays ?? [];

  return orderingDays.filter((day) => !blockedDays.includes(day));
}

export function getEnabledReceivingDays(
  store: Pick<StoreMasterData, "receivingDays" | "receivingBlockedDays">,
) {
  const receivingDays = store.receivingDays ?? [];
  const blockedDays = store.receivingBlockedDays ?? [];

  return receivingDays.filter((day) => !blockedDays.includes(day));
}

function convertKnownUnitToKg(quantity: number, unit: UnitCode): number {
  switch (unit) {
    case "Kg":
      return quantity;
    case "g":
      return quantity / 1000;
    case "L":
      return quantity;
    case "ml":
      return quantity / 1000;
    default:
      return quantity;
  }
}

function getRecipeReferenceWeightKg(item: RecipeIngredientReference) {
  if (item.sourceType === "ingrediente") {
    const ingredient = ingredientsById.get(item.sourceId);
    if (!ingredient) {
      return convertKnownUnitToKg(item.quantity, item.unit);
    }
    if (ingredient.unit === "Kg" || ingredient.unit === "L") {
      return convertKnownUnitToKg(item.quantity, item.unit);
    }
    return convertKnownUnitToKg(item.quantity, ingredient.unit);
  }

  const product = productsById.get(item.sourceId);
  if (!product) {
    return convertKnownUnitToKg(item.quantity, item.unit);
  }
  return item.unit === "Kg"
    ? item.quantity
    : item.quantity * (product.ingredientProfile?.weightKg ?? product.unitProfiles.sales.weightKg);
}

export function getRecipeTotalKg(recipe: RecipeIngredientReference[]) {
  return Number(recipe.reduce((sum, item) => sum + getRecipeReferenceWeightKg(item), 0).toFixed(3));
}

export function getProductRecipeTotals(product: ProductionProduct) {
  const totalIngredientsKg = getRecipeTotalKg(product.recipe);
  const outputAfterBreakKg = Number((totalIngredientsKg * (1 - product.breakPercent / 100)).toFixed(3));

  return {
    totalIngredientsKg,
    outputAfterBreakKg,
  };
}

export function getLinePlannedKgPerDay(lineId: string) {
  return getProductsByLine(lineId).reduce<Record<ProductionWeekDay, number>>((acc, product) => {
    product.productionDays.forEach((day) => {
      acc[day] = Number(((acc[day] ?? 0) + product.minimumProductionKg).toFixed(2));
    });
    return acc;
  }, {} as Record<ProductionWeekDay, number>);
}

export function formatDateBr(dateIso: string) {
  const [year, month, day] = dateIso.split("-");
  if (!year || !month || !day) {
    return dateIso;
  }
  return `${day}/${month}/${year}`;
}
