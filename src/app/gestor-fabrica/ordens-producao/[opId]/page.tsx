"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Factory, Printer, ShoppingCart, Truck } from "lucide-react";

import { FactoryFlow } from "@/components/shared/factory-flow";
import { PageLayout } from "@/components/shared/page-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { applyFactoryOrderStatus, useFactoryOrderStatus } from "@/lib/factory-order-status";
import { printProductionOrder } from "@/lib/factory-print";
import { buildFactoryPlanningData, getTodayDateKey } from "@/lib/order-planning";
import { productionLines } from "@/lib/production-planning";

function sanitizeDateKey(raw: string | null) {
  if (!raw) {
    return getTodayDateKey();
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getTodayDateKey();
}

export default function OrdemProducaoDetailsPage() {
  const params = useParams<{ opId: string }>();
  const searchParams = useSearchParams();
  const opId = typeof params.opId === "string" ? params.opId : "";
  const [referenceDate, setReferenceDate] = useState(() => sanitizeDateKey(searchParams.get("ref")));
  const statusState = useFactoryOrderStatus(referenceDate);

  const basePlanningData = useMemo(() => buildFactoryPlanningData(referenceDate), [referenceDate]);
  const planningData = useMemo(
    () => applyFactoryOrderStatus(basePlanningData, statusState.resolveStatus),
    [basePlanningData, statusState.resolveStatus],
  );
  const op = useMemo(
    () => planningData.productionOrders.find((item) => item.id === opId) ?? null,
    [opId, planningData.productionOrders],
  );

  const lineCapacity = useMemo(() => {
    if (!op) {
      return 0;
    }
    const line = productionLines.find((item) => item.id === op.lineId);
    return line?.capacityPerDayKg ?? 0;
  }, [op]);

  const utilization = useMemo(() => {
    if (!op || lineCapacity <= 0) {
      return 0;
    }
    return Number(((op.totalKg / lineCapacity) * 100).toFixed(1));
  }, [lineCapacity, op]);

  const flowSteps = [
    {
      key: "pedidos",
      title: "Pedidos",
      helper: "Itens vendidos",
      value: planningData.orderItems.length,
      href: "/gestor-fabrica/pedidos",
      icon: ShoppingCart,
    },
    {
      key: "producao",
      title: "Produção",
      helper: "OPs consolidadas",
      value: planningData.productionOrders.length,
      href: "/gestor-fabrica/ordens-producao",
      icon: Factory,
    },
    {
      key: "expedicao",
      title: "Expedição",
      helper: "Itens para separar",
      value: planningData.expeditionItems.length,
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
      title={`${op.code} · ${op.lineName}`}
      description="Detalhe da OP consolidada por setor e linha, com foco em execução da produção em Kg."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
        { label: "Ordens de Produção", href: "/gestor-fabrica/ordens-producao" },
        { label: op.code },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => printProductionOrder(op, referenceDate)}>
            <Printer className="size-4" />
            Imprimir OP
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
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">OP</p>
            <p className="mt-1 text-sm font-semibold">{op.code}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Produção</p>
            <p className="mt-1 text-sm font-semibold">{op.productionDateLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Setor</p>
            <p className="mt-1 text-sm font-semibold">{op.sectorName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Linha</p>
            <p className="mt-1 text-sm font-semibold">{op.lineName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Sublinha</p>
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
        subtitle="A produção consolida necessidade total por dia, setor e linha. A separação por pedido fica na expedição."
      />

      <Card>
        <CardHeader>
          <CardTitle>Capacidade e Carga</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border/80 bg-panel p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Carga da OP</p>
            <p className="mt-1 text-lg font-semibold">{op.totalKg} Kg</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-panel p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Capacidade da Linha</p>
            <p className="mt-1 text-lg font-semibold">{lineCapacity} Kg</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-panel p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Utilização</p>
            <p className="mt-1 text-lg font-semibold">{utilization.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-panel p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Produtos na OP</p>
            <p className="mt-1 text-lg font-semibold">{op.items.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Itens Consolidados da OP (Kg)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border/80">
            <table className="w-full border-collapse">
              <thead className="bg-panel">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Total (Kg)</th>
                </tr>
              </thead>
              <tbody>
                {op.items.map((item) => (
                  <tr key={`${op.id}-${item.productCode}`}>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {item.productCode} · {item.productName}
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.totalKg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observação Operacional</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="rounded-md border border-border/70 bg-panel/45 px-3 py-2 text-sm text-muted-foreground">
            Esta etapa é exclusivamente de produção consolidada. A distribuição por pedido e por loja é executada na
            etapa de expedição.
          </p>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
