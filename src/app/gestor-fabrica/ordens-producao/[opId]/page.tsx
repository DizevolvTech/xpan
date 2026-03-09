"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Factory, Printer, ShoppingCart, Truck } from "lucide-react";

import { FactoryFlow } from "@/components/shared/factory-flow";
import { PageLayout } from "@/components/shared/page-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTodayDateKey } from "@/lib/order-planning";
import { PRODUCTION_ITEM_STATUS_OPTIONS } from "@/lib/production-item-status-options";
import { hierarchyLabels } from "@/lib/production-planning";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";

function sanitizeDateKey(raw: string | null) {
  if (!raw) {
    return getTodayDateKey();
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getTodayDateKey();
}

function openPrintPage(pathname: string) {
  window.open(pathname, "_blank", "noopener,noreferrer");
}

export default function OrdemProducaoDetailsPage() {
  const params = useParams<{ opId: string }>();
  const searchParams = useSearchParams();
  const opId = typeof params.opId === "string" ? params.opId : "";
  const [referenceDate, setReferenceDate] = useState(() => sanitizeDateKey(searchParams.get("ref")));
  const { planningData, updateProductionItemStatus } = useFactoryPlanningSnapshot(referenceDate);
  const { snapshot } = useMasterDataSnapshot();

  const op = useMemo(
    () => planningData.productionOrders.find((item) => item.id === opId) ?? null,
    [opId, planningData.productionOrders],
  );

  const lineCapacity = useMemo(() => {
    if (!op) {
      return 0;
    }
    return snapshot.lines.find((item) => item.id === op.lineId)?.capacityPerDayKg ?? 0;
  }, [op, snapshot.lines]);

  const flowSteps = [
    {
      key: "pedidos",
      title: "Pedidos",
      helper: "Entradas auditadas",
      value: planningData.orders.length,
      href: "/gestor-fabrica/pedidos",
      icon: ShoppingCart,
    },
    {
      key: "producao",
      title: "Produção",
      helper: "OPs liberadas",
      value: planningData.productionOrders.length,
      href: "/gestor-fabrica/ordens-producao",
      icon: Factory,
    },
    {
      key: "expedicao",
      title: "Expedição",
      helper: "Checklists",
      value: planningData.expedition.length,
      href: "/gestor-fabrica/expedicao",
      icon: Truck,
    },
  ];

  if (!op) {
    return (
      <PageLayout
        title="OP não encontrada"
        description="A OP solicitada não existe para a referência atual."
        badge="Fábrica"
        breadcrumbs={[
          { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
          { label: "Ordens de Produção", href: "/gestor-fabrica/ordens-producao" },
          { label: "Detalhe" },
        ]}
        actions={
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-fabrica/ordens-producao">
              <ArrowLeft className="size-4" />
              Voltar para OPs
            </Link>
          </Button>
        }
      >
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Ajuste a data de referência na lista de OPs e tente novamente.
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`${op.code} · ${op.scheduleName}`}
      description="Acompanhe o avanço real dos produtos dentro da OP e emita as folhas dedicadas de pré-pesagem e produção."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
        { label: "Ordens de Produção", href: "/gestor-fabrica/ordens-producao" },
        { label: op.code },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => openPrintPage(`/impressao/pre-pesagem/${op.id}?ref=${referenceDate}`)}>
            <Printer className="size-4" />
            Pré-pesagem
          </Button>
          <Button type="button" variant="outline" onClick={() => openPrintPage(`/impressao/producao/${op.id}?ref=${referenceDate}`)}>
            <Printer className="size-4" />
            Produção
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-fabrica/ordens-producao">
              <ArrowLeft className="size-4" />
              Voltar para OPs
            </Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-fabrica/expedicao">
              <Truck className="size-4" />
              Ver expedição
            </Link>
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Resumo da OP</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Referência da fábrica</span>
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
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">OP</p>
            <p className="mt-1 text-sm font-semibold">{op.code}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Produção</p>
            <p className="mt-1 text-sm font-semibold">{op.productionDateLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{hierarchyLabels.sector}</p>
            <p className="mt-1 text-sm font-semibold">{op.sectorName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{hierarchyLabels.line}</p>
            <p className="mt-1 text-sm font-semibold">{op.lineName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{hierarchyLabels.schedule}</p>
            <p className="mt-1 text-sm font-semibold">{op.scheduleName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Status</p>
            <div className="mt-1">
              <StatusBadge status={op.status} />
            </div>
          </div>
        </CardContent>
      </Card>

      <FactoryFlow
        currentKey="producao"
        steps={flowSteps}
        subtitle="O progresso da OP é calculado pela média simples dos produtos da própria OP."
      />

      <Card>
        <CardHeader>
          <CardTitle>Carga e conclusão</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border/80 bg-panel p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Carga da OP</p>
            <p className="mt-1 text-lg font-semibold">{op.totalKg} Kg</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-panel p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">% conclusão</p>
            <p className="mt-1 text-lg font-semibold">{op.progress.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-panel p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Capacidade da subcategoria</p>
            <p className="mt-1 text-lg font-semibold">{lineCapacity} Kg/dia</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-panel p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Produtos na OP</p>
            <p className="mt-1 text-lg font-semibold">{op.items.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Avanço por produto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border/80">
            <table className="w-full border-collapse">
              <thead className="bg-panel">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Carga (Kg)</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Progresso</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status operacional</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Itens origem</th>
                </tr>
              </thead>
              <tbody>
                {op.items.map((item) => (
                  <tr key={item.productId}>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {item.productCode} · {item.productName}
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.totalKg}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.progress.toFixed(1)}%</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      <div className="space-y-2">
                        <StatusBadge status={item.status} />
                        <Select
                          value={item.status}
                          onValueChange={(value) => void updateProductionItemStatus(item.productionItemKey, value as (typeof PRODUCTION_ITEM_STATUS_OPTIONS)[number]["value"])}
                        >
                          <SelectTrigger className="h-9 w-[220px] bg-background">
                            <SelectValue placeholder="Atualizar estágio" />
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUCTION_ITEM_STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.sourceItemsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos atendidos por esta OP</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border/80">
            <table className="w-full border-collapse">
              <thead className="bg-panel">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Pedido</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Loja</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Qtd loja</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Kg</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Entrega</th>
                </tr>
              </thead>
              <tbody>
                {op.sourceItems.map((item) => (
                  <tr key={item.id}>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.orderCode}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.storeName}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {item.productCode} · {item.productName}
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {item.requestedQuantity} {item.requestedUnit}
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.internalKg}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.deliveryDateLabel}</td>
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
