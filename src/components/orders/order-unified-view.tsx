"use client";

import { useState } from "react";

import { useCanSeeModule } from "@/components/layout/navigation-modules";
import { ExpeditionChecklistView, type FactoryArea } from "@/components/orders/expedition-checklist-view";
import { OrderSummaryView } from "@/components/orders/order-summary-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type OrderTab = "resumo" | "expedicao";

/** id do pedido a partir do id da expedição ("exp-<pedido>") ou do próprio id do pedido. */
export function resolveOrderIdFromExpeditionParam(expeditionParam: string): string {
  return expeditionParam.startsWith("exp-") ? expeditionParam.slice("exp-".length) : expeditionParam;
}

/**
 * Página única do pedido (quadro #317, 04/11): abas "Resumo" e "Expedição" (checklist).
 * Aberta por Pedidos entra no Resumo; aberta pela Expedição ou por Entregas entra direto na
 * aba Expedição. A aba de um módulo que o usuário não tem no menu não aparece; com uma aba
 * só, a barra de abas some.
 */
export function OrderUnifiedView({
  area,
  orderId,
  initialTab,
}: {
  area: FactoryArea;
  orderId: string;
  initialTab: OrderTab;
}) {
  const canSeeSummary = useCanSeeModule("gestor-fabrica.pedidos");
  const canSeeExpedition = useCanSeeModule(`${area}.expedicao`);
  const visibleTabs: OrderTab[] = [
    ...(canSeeSummary ? (["resumo"] as const) : []),
    ...(canSeeExpedition || !canSeeSummary ? (["expedicao"] as const) : []),
  ];
  const [tab, setTab] = useState<OrderTab>(visibleTabs.includes(initialTab) ? initialTab : visibleTabs[0]);
  const activeTab = visibleTabs.includes(tab) ? tab : visibleTabs[0];

  const summary = <OrderSummaryView orderId={orderId} />;
  const expedition = <ExpeditionChecklistView area={area} expeditionId={`exp-${orderId}`} />;

  if (visibleTabs.length === 1) {
    return activeTab === "resumo" ? summary : expedition;
  }

  return (
    <Tabs value={activeTab} onValueChange={(value) => setTab(value as OrderTab)} className="min-w-0 gap-3">
      <TabsList className="w-full max-w-md self-start" aria-label="Etapas do pedido">
        <TabsTrigger value="resumo" data-testid="order-tab-resumo">
          Resumo do pedido
        </TabsTrigger>
        <TabsTrigger value="expedicao" data-testid="order-tab-expedicao">
          Expedição
        </TabsTrigger>
      </TabsList>
      <TabsContent value="resumo" className="min-w-0">
        {summary}
      </TabsContent>
      <TabsContent value="expedicao" className="min-w-0">
        {expedition}
      </TabsContent>
    </Tabs>
  );
}
