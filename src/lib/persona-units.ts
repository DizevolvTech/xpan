import { productSalesToKgFactor } from "@/lib/production-batches";

export type FactoryPersona = "loja" | "dosimetria" | "padeiro" | "expedicao";

export const personaUnitHints: Record<FactoryPersona, string> = {
  loja: "A loja pede na unidade de venda (Un, pacote ou kg).",
  dosimetria: "A balança pesa kg de cada matéria-prima.",
  padeiro: "A OP fala em unidades (ou kg) da receita, com N cheias + 1 parcial.",
  expedicao: "A saída conta embalagem de expedição (caixa, pacote, kg).",
};

export function quantityFromKg(
  kg: number,
  unitKg: number,
): number {
  const factor = unitKg > 0 ? unitKg : 1;
  return Number((kg / factor).toFixed(6));
}

/**
 * S1.4 / S2.4 — um peso em kg; o rótulo muda por persona.
 * Loja e padeiro vêem a unidade de venda; dosimetria vê kg; expedição vê a embalagem.
 */
export function formatQuantityForPersona(input: {
  persona: FactoryPersona;
  kg: number;
  salesUnit: string;
  salesToKgFactor: number;
  salesWeightKg?: number;
  expeditionUnit: string;
  expeditionToKgFactor: number;
}): { quantity: number; unitLabel: string } {
  const { persona, kg } = input;
  if (persona === "dosimetria") {
    return { quantity: Number(kg.toFixed(6)), unitLabel: "Kg" };
  }
  if (persona === "expedicao") {
    const factor = input.expeditionToKgFactor > 0 ? input.expeditionToKgFactor : 1;
    return {
      quantity: quantityFromKg(kg, factor),
      unitLabel: input.expeditionUnit,
    };
  }
  const factor = productSalesToKgFactor({
    salesUnit: input.salesUnit,
    salesToKgFactor: input.salesToKgFactor,
    unitProfiles: { sales: { unit: input.salesUnit, weightKg: input.salesWeightKg ?? input.salesToKgFactor } },
  });
  return {
    quantity: quantityFromKg(kg, factor),
    unitLabel: input.salesUnit,
  };
}
