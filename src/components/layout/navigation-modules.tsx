"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { NavigationSectionDefinition } from "@/lib/permission-modules";

/**
 * Módulos que o usuário vê no menu (já filtrados pelas permissões no servidor). Telas que
 * juntam etapas de módulos diferentes (ex.: pedido com abas Resumo e Expedição, quadro #317)
 * escondem a parte de um módulo que o usuário não tem. É só apresentação: as APIs continuam
 * conferindo a permissão no servidor.
 */
const NavigationModulesContext = createContext<ReadonlySet<string> | null>(null);

export function NavigationModulesProvider({
  sections,
  children,
}: {
  sections: NavigationSectionDefinition[];
  children: ReactNode;
}) {
  const moduleIds = useMemo(
    () => new Set(sections.flatMap((section) => section.items.map((item) => item.id))),
    [sections],
  );
  return <NavigationModulesContext.Provider value={moduleIds}>{children}</NavigationModulesContext.Provider>;
}

/** true quando o usuário tem o módulo no menu. Fora do AppShell (sem contexto) não esconde nada. */
export function useCanSeeModule(moduleId: string): boolean {
  const moduleIds = useContext(NavigationModulesContext);
  return moduleIds ? moduleIds.has(moduleId) : true;
}
