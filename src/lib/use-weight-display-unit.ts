"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { resolveWeightDisplayUnit, type WeightDisplayUnit } from "@/lib/weight-display";

/**
 * Unidade de peso da OP nas telas de acompanhamento: a escolha feita na própria tela (se houver)
 * ganha da configuração geral do cliente. A escolha vale só enquanto a tela está aberta e é
 * repassada às impressões (`?unit=`), para tela e folha mostrarem o mesmo número.
 */
export function useWeightDisplayUnit() {
  const { snapshot } = useMasterDataSnapshot();
  const [override, setOverride] = useState<WeightDisplayUnit | null>(null);
  const unit = resolveWeightDisplayUnit(override, snapshot.operationalSettings.opWeightUnit);
  const setUnit = useCallback((next: WeightDisplayUnit) => setOverride(next), []);

  return { unit, setUnit };
}

/** Acrescenta `unit=g` à URL de impressão só quando a escolha da tela é g; kg é o padrão e não vai na URL. */
export function appendWeightUnitParam(href: string, unit: WeightDisplayUnit): string {
  if (unit !== "g") {
    return href;
  }

  return `${href}${href.includes("?") ? "&" : "?"}unit=g`;
}

/**
 * Unidade de peso nas páginas de IMPRESSÃO. Ordem: `?unit=` da URL (escolha na emissão) > configuração
 * geral do cliente > kg. O seletor da folha reescreve o `?unit=` na própria URL, então o que está na
 * tela é o que vai para o papel e o link continua reproduzível.
 */
export function usePrintWeightUnit() {
  const { snapshot } = useMasterDataSnapshot();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const unit = resolveWeightDisplayUnit(searchParams.get("unit"), snapshot.operationalSettings.opWeightUnit);

  const setUnit = useCallback(
    (next: WeightDisplayUnit) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("unit", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return { unit, setUnit };
}
