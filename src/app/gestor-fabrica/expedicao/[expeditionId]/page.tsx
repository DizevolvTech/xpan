"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Factory, Printer, ShoppingCart, Truck } from "lucide-react";

import { FactoryFlow } from "@/components/shared/factory-flow";
import { OrderStatusControl } from "@/components/shared/order-status-control";
import { PageLayout } from "@/components/shared/page-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { aggregateExpeditionItems } from "@/lib/expedition-aggregation";
import { applyFactoryOrderStatus, useFactoryOrderStatus } from "@/lib/factory-order-status";
import { printExpeditionSeparation } from "@/lib/factory-print";
import {
  buildFactoryPlanningData,
  getTodayDateKey,
} from "@/lib/order-planning";

function sanitizeDateKey(raw: string | null) {
  if (!raw) {
    return getTodayDateKey();
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getTodayDateKey();
}

export default function ExpedicaoDetailsPage() {
  const params = useParams<{ expeditionId: string }>();
  const searchParams = useSearchParams();
  const expeditionId = typeof params.expeditionId === "string" ? params.expeditionId : "";
  const [referenceDate, setReferenceDate] = useState(() => sanitizeDateKey(searchParams.get("ref")));
  const statusState = useFactoryOrderStatus(referenceDate);

  const basePlanningData = useMemo(() => buildFactoryPlanningData(referenceDate), [referenceDate]);
  const planningData = useMemo(
    () => applyFactoryOrderStatus(basePlanningData, statusState.resolveStatus),
    [basePlanningData, statusState.resolveStatus],
  );

  const expedition = useMemo(
    () => planningData.expedition.find((item) => item.id === expeditionId) ?? null,
    [expeditionId, planningData.expedition],
  );
  const canSeparate = expedition ? expedition.status === "em_producao" || expedition.status === "rota_entrega" : false;
  const aggregatedItems = useMemo(() => aggregateExpeditionItems(expedition?.items ?? []), [expedition?.items]);

  const flowSteps = [
    {
      key: "pedidos",
      title: "Pedidos",
      helper: "Pedidos cadastrados",
      value: planningData.orders.length,
      href: "/gestor-fabrica/pedidos",
      icon: ShoppingCart,
    },
    {
      key: "producao",
      title: "Produção",
      helper: "OPs programadas",
      value: planningData.productionOrders.length,
      href: "/gestor-fabrica/ordens-producao",
      icon: Factory,
    },
    {
      key: "expedicao",
      title: "Expedição",
      helper: "Pedidos para separar",
      value: planningData.expedition.length,
      href: "/gestor-fabrica/expedicao",
      icon: Truck,
    },
  ];

  if (!expedition) {
    return (
      <PageLayout
        title="Separação não encontrada"
        description="O pedido de expedição solicitado não existe para a referência atual."
        badge="Fábrica"
        breadcrumbs={[
          { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
          { label: "Expedição", href: "/gestor-fabrica/expedicao" },
          { label: "Detalhe" },
        ]}
        actions={
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-fabrica/expedicao">
              <ArrowLeft className="size-4" />
              Voltar para expedição
            </Link>
          </Button>
        }
      >
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Ajuste a data de referência na lista de expedição e tente novamente.
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`Separação · ${expedition.orderCode}`}
      description="Tela dedicada da separação com reconversão de Kg interno para unidade logística de expedição."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
        { label: "Expedição", href: "/gestor-fabrica/expedicao" },
        { label: expedition.orderCode },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => printExpeditionSeparation(expedition, referenceDate)}>
            <Printer className="size-4" />
            Imprimir separação
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-fabrica/expedicao">
              <ArrowLeft className="size-4" />
              Voltar para expedição
            </Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-fabrica/pedidos">
              <ShoppingCart className="size-4" />
              Ver pedidos
            </Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-fabrica/ordens-producao">
              <Factory className="size-4" />
              Ver OPs
            </Link>
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Resumo do Pedido Selecionado</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Referência da fábrica
            </span>
            <input
              type="date"
              value={referenceDate}
              onChange={(event) => setReferenceDate(event.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground"
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Pedido</p>
            <p className="mt-1 text-sm font-semibold">{expedition.orderCode}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Loja</p>
            <p className="mt-1 text-sm font-semibold">{expedition.storeName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Entrega</p>
            <p className="mt-1 text-sm font-semibold">{expedition.deliveryDateLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Produtos</p>
            <p className="mt-1 text-sm font-semibold">{aggregatedItems.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Total</p>
            <p className="mt-1 text-sm font-semibold">{expedition.totalKg} Kg</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Status</p>
            <div className="mt-1">
              <StatusBadge status={expedition.status} />
            </div>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Atualizar Status</p>
            <div className="mt-1">
              <OrderStatusControl
                orderId={expedition.orderId}
                status={expedition.status}
                onStatusChange={statusState.updateOrderStatus}
              />
            </div>
          </div>
          <div className="md:col-span-6">
            <p className="rounded-md border border-border/70 bg-panel/45 px-3 py-2 text-xs text-muted-foreground">
              Use esta página para executar a separação final: quantidade pedida, reconversão em Kg e quantidade de
              expedição ficam no mesmo contexto do pedido selecionado.
            </p>
          </div>
          {!canSeparate ? (
            <div className="md:col-span-6">
              <p className="rounded-md border border-warning/45 bg-warning/20 px-3 py-2 text-xs text-warning-foreground">
                Separação bloqueada para o status atual. Avance o pedido para <strong>Em Produção</strong> ou{" "}
                <strong>Rota de Entrega</strong>.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <FactoryFlow
        currentKey="expedicao"
        steps={flowSteps}
        subtitle="Você está na etapa final: separação e preparação de entrega."
      />

      <Card>
        <CardHeader>
          <CardTitle>Produtos Consolidados para Separação</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 rounded-md border border-border/70 bg-panel/45 px-3 py-2 text-xs text-muted-foreground">
            Visualização consolidada por produto para evitar repetição dentro do mesmo pedido.
          </p>
          <div className="overflow-hidden rounded-xl border border-border/80">
            <table className="w-full border-collapse">
              <thead className="bg-panel">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Qtd Pedida</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Kg Interno</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Qtd Expedição</th>
                </tr>
              </thead>
              <tbody>
                {aggregatedItems.map((item) => (
                  <tr key={`${item.productId}-${item.requestedUnit}-${item.expeditionUnit}`}>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {item.productCode} · {item.productName}
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {item.requestedQuantity} {item.requestedUnit}
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.internalKg}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {item.expeditionQuantity} {item.expeditionUnit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
