"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { AlertCircle, ArrowLeft, Clock3, ListChecks, Printer, Store, Truck } from "lucide-react";

import { PageLayout } from "@/components/shared/page-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTodayDateKey } from "@/lib/order-planning";
import { useStoreOrderDetail } from "@/lib/use-store-orders";

function sanitizeDateKey(raw: string | null) {
  if (!raw) {
    return getTodayDateKey();
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getTodayDateKey();
}

function openPrintPage(pathname: string) {
  window.open(pathname, "_blank", "noopener,noreferrer");
}

function parseBrDate(dateLabel: string): Date | null {
  const [dayRaw, monthRaw, yearRaw] = dateLabel.split("/");
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function PedidoLojaDetailsPage() {
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const orderId = typeof params.orderId === "string" ? params.orderId : "";
  const referenceDate = sanitizeDateKey(searchParams.get("ref"));
  const { order } = useStoreOrderDetail(orderId, referenceDate);

  const itemsCount = useMemo(() => (order ? order.items.length : 0), [order]);
  const totalRequested = useMemo(
    () => (order ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0),
    [order],
  );
  const deliveryDate = useMemo(
    () => (order ? parseBrDate(order.deliveryDate) : null),
    [order],
  );
  const deliveryOnSunday = deliveryDate ? deliveryDate.getDay() === 0 : false;

  if (!order) {
    return (
      <PageLayout
        title="Pedido não encontrado"
        description="Não foi possível localizar o pedido solicitado."
        badge="Loja"
        breadcrumbs={[
          { label: "Loja", href: "/loja" },
          { label: "Pedidos", href: "/loja/pedidos" },
          { label: "Detalhe" },
        ]}
        actions={
          <Button asChild type="button" variant="outline">
            <Link href="/loja/pedidos">
              <ArrowLeft className="size-4" />
              Voltar para pedidos
            </Link>
          </Button>
        }
      >
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Verifique se o pedido ainda existe na lista e tente novamente.
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`${order.code} · ${order.store}`}
      description="Visualização completa do pedido da loja."
      badge="Loja"
      breadcrumbs={[
        { label: "Loja", href: "/loja" },
        { label: "Pedidos", href: "/loja/pedidos" },
        { label: order.code },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => openPrintPage(`/impressao/pedido-loja/${order.id}?ref=${referenceDate}`)}
          >
            <Printer className="size-4" />
            Imprimir pedido
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/loja/pedidos">
              <ArrowLeft className="size-4" />
              Voltar para pedidos
            </Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/loja/ocorrencias">
              <AlertCircle className="size-4" />
              Abrir ocorrência
            </Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-border/80 bg-card p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Itens</p>
          <p className="mt-2 text-2xl font-bold leading-none">{itemsCount}</p>
        </article>
        <article className="rounded-xl border border-border/80 bg-card p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Qtd Total</p>
          <p className="mt-2 text-2xl font-bold leading-none">{totalRequested}</p>
        </article>
        <article className="rounded-xl border border-border/80 bg-card p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Prazo</p>
          <p className="mt-2 text-2xl font-bold leading-none">{order.dPlusLabel}</p>
        </article>
        <article className="rounded-xl border border-border/80 bg-card p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Status</p>
          <div className="mt-2">
            <StatusBadge status={order.status} />
          </div>
        </article>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo do Pedido</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border/70 bg-panel/40 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Pedido</p>
            <p className="mt-1 text-sm font-semibold">{order.code}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/40 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Loja</p>
            <p className="mt-1 text-sm font-semibold">{order.store}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/40 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Data do Pedido</p>
            <p className="mt-1 text-sm font-semibold">{order.date}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/40 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Entrega</p>
            <p className="mt-1 text-sm font-semibold text-warning-foreground">{order.deliveryDate}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/40 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">D+X</p>
            <p className="mt-1 text-sm font-semibold">{order.dPlusLabel}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/40 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Horário Limite</p>
            <p className="mt-1 text-sm font-semibold">{order.cutoffTime}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/40 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Janela de Recebimento</p>
            <p className="mt-1 text-sm font-semibold">{order.receiveWindow}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/40 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Recebe Domingo</p>
            <p className="mt-1 text-sm font-semibold">{order.receivesSunday ? "Sim" : "Não"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Itens do Pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="bg-panel">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Categoria</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Un.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm font-mono">{item.code}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.name}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.category}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.unit}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm font-semibold">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regras de Entrega Aplicadas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <p className="rounded-lg border border-border/70 bg-panel/40 px-3 py-2 text-sm text-muted-foreground">
            <Store className="mr-1 inline size-4 align-text-bottom" />
            Perfil da loja: <strong>{order.receivesSunday ? "recebe domingo" : "não recebe domingo"}</strong>.
          </p>
          <p className="rounded-lg border border-border/70 bg-panel/40 px-3 py-2 text-sm text-muted-foreground">
            <Truck className="mr-1 inline size-4 align-text-bottom" />
            {deliveryOnSunday && !order.receivesSunday
              ? "Entrega de domingo foi automaticamente movida para segunda-feira."
              : "Data de entrega segue regra D+X e política de recebimento da loja."}
          </p>
          <p className="rounded-lg border border-border/70 bg-panel/40 px-3 py-2 text-sm text-muted-foreground">
            <Clock3 className="mr-1 inline size-4 align-text-bottom" />
            Horário limite de pedido considerado: {order.cutoffTime}.
          </p>
          <p className="rounded-lg border border-border/70 bg-panel/40 px-3 py-2 text-sm text-muted-foreground">
            <ListChecks className="mr-1 inline size-4 align-text-bottom" />
            {order.note}
          </p>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
