export type UnitKind = "continuous" | "discrete";

export type UnitCode =
  | "Kg"
  | "g"
  | "L"
  | "ml"
  | "Un"
  | "Dz"
  | "Forma"
  | "Travessa"
  | "Pacote"
  | "Caixa"
  | "Bandeja"
  | "Saco"
  | "Carrinho"
  | "Assadeira"
  | "Tela";

export interface UnitDefinition {
  code: UnitCode;
  label: string;
  kind: UnitKind;
}

export const unitDefinitions: UnitDefinition[] = [
  { code: "Kg", label: "Kg", kind: "continuous" },
  { code: "g", label: "g", kind: "continuous" },
  { code: "L", label: "L", kind: "continuous" },
  { code: "ml", label: "ml", kind: "continuous" },
  { code: "Un", label: "Un", kind: "discrete" },
  { code: "Dz", label: "Dz", kind: "discrete" },
  { code: "Forma", label: "Forma", kind: "discrete" },
  { code: "Travessa", label: "Travessa", kind: "discrete" },
  { code: "Pacote", label: "Pacote", kind: "discrete" },
  { code: "Caixa", label: "Caixa", kind: "discrete" },
  { code: "Bandeja", label: "Bandeja", kind: "discrete" },
  { code: "Saco", label: "Saco", kind: "discrete" },
  { code: "Carrinho", label: "Carrinho", kind: "discrete" },
  { code: "Assadeira", label: "Assadeira", kind: "discrete" },
  { code: "Tela", label: "Tela", kind: "discrete" },
];

const unitByCode = new Map<UnitCode, UnitDefinition>(unitDefinitions.map((definition) => [definition.code, definition]));

export function getUnitDefinition(code: UnitCode): UnitDefinition {
  return unitByCode.get(code) ?? { code, label: code, kind: "continuous" };
}

export function isDiscreteUnit(code: UnitCode): boolean {
  return getUnitDefinition(code).kind === "discrete";
}

export function round2(value: number): number {
  return Number(value.toFixed(2));
}

export function roundQuantityForUnit(value: number, unit: UnitCode): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (isDiscreteUnit(unit)) {
    return Math.ceil(value);
  }
  return round2(value);
}
