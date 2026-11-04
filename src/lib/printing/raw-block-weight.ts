import type { ProductionProduct } from "@/lib/production-planning";

/**
 * Cartão #237 (5.7): "Pesar o bloco com ___ g". Peso do bloco CRU em gramas, ou `null` quando o
 * cadastro não tem o dado (a OP imprime a linha em branco para o padeiro preencher).
 *
 * Fonte HOJE: `labTest.rawUnitWeightKg` ("peso de um bloco/peça cru", aba Rendimento do produto).
 * Quando o cadastro ganhar "peso da unidade crua = massa crua / unidades efetivas", é só trocar
 * esta função (único ponto de leitura) — nenhuma folha lê o campo direto.
 */
export function resolveRawBlockWeightG(product: Pick<ProductionProduct, "labTest"> | undefined | null): number | null {
  const kg = product?.labTest?.rawUnitWeightKg;
  if (typeof kg !== "number" || !Number.isFinite(kg) || kg <= 0) {
    return null;
  }
  return Math.round(kg * 1000 * 10) / 10;
}
