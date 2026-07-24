"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Clock3,
  ListChecks,
  PencilLine,
  Printer,
  Save,
  Store,
  Trash2,
  Truck,
  X,
} from "lucide-react";

import { InfoHint } from "@/components/shared/info-hint";
import { PaginatedSection } from "@/components/shared/paginated-section";
import { PageLayout } from "@/components/shared/page-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { useToast } from "@/components/shared/toast";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isDiscreteUnit, type UnitCode } from "@/lib/factory-planning/units";
import { getTodayDateKey } from "@/lib/order-planning";
import { isStoreOrderOverdue } from "@/lib/store-order-window";
import {
  useCancelStoreOrder,
  useStoreOrderCatalog,
  useStoreOrderDetail,
  useUpdateStoreOrder,
} from "@/lib/use-store-orders";
import { cn } from "@/lib/utils";

type DraftAddedOrderItem = {
  id: string;
  productId: string;
  code: string;
  name: string;
  category: string;
  unit: UnitCode;
  operationalUnit: UnitCode;
  quantity: number;
};

function sanitizeDateKey(raw: string | null) {
  if (!raw) {
    return getTodayDateKey();
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getTodayDateKey();
}

function openPrintPage(pathname: string) {
  window.open(pathname, "_blank", "noopener,noreferrer");
}

// XPAN item 6 — hidratação: `getTodayDateKey()` usa `new Date()` no fuso local; calculado
// durante o render de SERVIDOR pode divergir do cliente perto da meia-noite. Snapshot de
// servidor vazio (alerta desligado) e o valor real só no cliente, como em
// `useOperationalDateScope`. A string é estável entre chamadas → sem re-render em loop.
const subscribeToNothing = () => () => undefined;
const getServerTodayDateKey = () => "";

function useTodayDateKey() {
  return useSyncExternalStore(subscribeToNothing, getTodayDateKey, getServerTodayDateKey);
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const orderId = typeof params.orderId === "string" ? params.orderId : "";
  const referenceDate = sanitizeDateKey(searchParams.get("ref"));
  const { order, isLoading: isLoadingOrder, refresh } = useStoreOrderDetail(orderId, referenceDate);
  const { catalog } = useStoreOrderCatalog(order?.storeId ?? "", order?.orderedAtIso ?? "");
  const { updateOrder, isSubmitting: isUpdating } = useUpdateStoreOrder(() => {
    void refresh();
  });
  const { cancelOrder, isSubmitting: isCancelling } = useCancelStoreOrder(() => {
    router.push("/loja/pedidos");
  });
  const [isEditing, setIsEditing] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [draftItems, setDraftItems] = useState<Record<string, number>>({});
  const [draftAddedItems, setDraftAddedItems] = useState<DraftAddedOrderItem[]>([]);
  const [selectedCatalogProductId, setSelectedCatalogProductId] = useState("");

  const visibleItems = useMemo(
    () => (order ? (isEditing ? [...order.items, ...draftAddedItems] : order.items) : []),
    [draftAddedItems, isEditing, order],
  );
  const availableCatalogProducts = useMemo(() => {
    if (!order) {
      return [];
    }

    const existingProductIds = new Set(order.items.map((item) => item.productId));
    const addedProductIds = new Set(draftAddedItems.map((item) => item.productId));

    return catalog.filter(
      (product) =>
        product.available &&
        !existingProductIds.has(product.productId) &&
        !addedProductIds.has(product.productId),
    );
  }, [catalog, draftAddedItems, order]);
  const selectedCatalogProduct = useMemo(
    () => availableCatalogProducts.find((product) => product.productId === selectedCatalogProductId) ?? null,
    [availableCatalogProducts, selectedCatalogProductId],
  );
  const itemsCount = useMemo(() => visibleItems.length, [visibleItems]);
  const totalRequested = useMemo(
    () => {
      if (!order) {
        return 0;
      }

      if (!isEditing) {
        return order.items.reduce((sum, item) => sum + item.quantity, 0);
      }

      return (
        order.items.reduce((sum, item) => sum + Number(draftItems[item.id] ?? item.quantity), 0) +
        draftAddedItems.reduce((sum, item) => sum + item.quantity, 0)
      );
    },
    [draftAddedItems, draftItems, isEditing, order],
  );
  const deliveryDate = useMemo(() => (order ? parseBrDate(order.deliveryDate) : null), [order]);
  const deliveryOnSunday = deliveryDate ? deliveryDate.getDay() === 0 : false;
  // XPAN item 6: atraso medido contra HOJE (nunca contra o `ref` da URL, que é só o
  // recorte operacional escolhido na lista).
  const todayDateKey = useTodayDateKey();
  const isOverdue = order ? isStoreOrderOverdue(order, todayDateKey) : false;

  async function handleSave() {
    if (!order) {
      return;
    }

    const items = [
      ...order.items.map((item) => ({
        productId: item.productId,
        quantity: Number(draftItems[item.id] ?? item.quantity),
        unit: item.unit,
      })),
      ...draftAddedItems.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        unit: item.unit,
      })),
    ]
      .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);

    if (items.length === 0) {
      toast.warning("O pedido precisa manter pelo menos um item com quantidade positiva.");
      return;
    }

    await updateOrder(order.id, {
      note: draftNote,
      items,
    });
    setIsEditing(false);
  }

  function handleAddCatalogProduct() {
    const product = availableCatalogProducts.find((entry) => entry.productId === selectedCatalogProductId);
    if (!product) {
      return;
    }

    setDraftAddedItems((current) => [
      ...current,
      {
        id: `draft-${product.productId}`,
        productId: product.productId,
        code: product.code,
        name: product.name,
        category: product.category,
        unit: product.unit,
        operationalUnit: product.unit,
        quantity: product.unitKind === "discrete" ? 1 : 0.1,
      },
    ]);
    setSelectedCatalogProductId("");
  }

  function handleAddedItemQuantityChange(itemId: string, rawValue: number) {
    setDraftAddedItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const sanitized = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 0;
        return {
          ...item,
          quantity: isDiscreteUnit(item.unit) ? Math.round(sanitized) : Number(sanitized.toFixed(3)),
        };
      }),
    );
  }

  function handleRemoveAddedItem(itemId: string) {
    setDraftAddedItems((current) => current.filter((item) => item.id !== itemId));
  }

  async function handleCancelOrder() {
    if (!order) {
      return;
    }

    const confirmed = await confirm({
      title: `Cancelar o pedido ${order.code}?`,
      tone: "destructive",
      confirmLabel: "Cancelar pedido",
      cancelLabel: "Voltar",
    });
    if (!confirmed) {
      return;
    }

    await cancelOrder(order.id);
  }

  if (!order) {
    return (
      <PageLayout
        title={isLoadingOrder ? "Carregando pedido…" : "Pedido não encontrado"}
        description={isLoadingOrder ? "" : "Não foi possível localizar o pedido solicitado."}
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
            {isLoadingOrder
              ? "Buscando dados do pedido…"
              : "Verifique se o pedido ainda existe na lista e tente novamente."}
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => openPrintPage(`/impressao/pedido-loja/${order.id}?ref=${referenceDate}`)}
          >
            <Printer className="size-4" />
            Imprimir pedido
          </Button>

          {order.canEdit ? (
            isEditing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDraftNote(order.note ?? "");
                    setDraftItems(
                      order.items.reduce<Record<string, number>>((acc, item) => {
                        acc[item.id] = item.quantity;
                        return acc;
                      }, {}),
                    );
                    setDraftAddedItems([]);
                    setSelectedCatalogProductId("");
                    setIsEditing(false);
                  }}
                >
                  <X className="size-4" />
                  Cancelar edição
                </Button>
                <Button type="button" onClick={() => void handleSave()} disabled={isUpdating}>
                  <Save className="size-4" />
                  {isUpdating ? "Salvando..." : "Salvar pedido"}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => router.push(`/loja/pedidos?editOrder=${order.id}`)}>
                <PencilLine className="size-4" />
                Editar pedido
              </Button>
            )
          ) : null}

          {order.canCancel ? (
            <Button type="button" variant="outline" onClick={() => void handleCancelOrder()} disabled={isCancelling}>
              <Trash2 className="size-4" />
              {isCancelling ? "Cancelando..." : "Cancelar pedido"}
            </Button>
          ) : null}

          <Button asChild type="button" variant="outline">
            <Link href="/loja/pedidos">
              <ArrowLeft className="size-4" />
              Voltar para pedidos
            </Link>
          </Button>

          {order.canOpenOccurrence ? (
            <Button asChild type="button" variant="outline">
              <Link href={`/loja/ocorrencias?orderId=${order.id}`}>
                <AlertCircle className="size-4" />
                Abrir ocorrência
              </Link>
            </Button>
          ) : (
            <Button type="button" variant="outline" disabled>
              <AlertCircle className="size-4" />
              Ocorrência disponível após sair para entrega
            </Button>
          )}
        </div>
      }
    >
      {/* XPAN item 6: o recebimento previsto venceu e o pedido continua sem ser entregue
          (tentativa de entrega falha também conta — a loja segue sem a mercadoria). */}
      {isOverdue ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-danger/45 bg-danger/15 px-4 py-3 text-sm text-danger-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <strong className="font-semibold">Entrega atrasada.</strong> O recebimento estava
            previsto para <strong className="font-semibold">{order.deliveryDate}</strong> e o pedido
            ainda não foi entregue.
          </p>
        </div>
      ) : null}

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
            <p
              className={cn(
                "mt-1 text-sm font-semibold",
                isOverdue ? "text-danger-foreground" : "text-warning-foreground",
              )}
            >
              {order.deliveryDate}
            </p>
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
        <CardContent className="space-y-4">
          {isEditing ? (
            <div className="rounded-lg border border-border/70 bg-panel/30 p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <div className="grid gap-2">
                  <div className="flex items-center gap-1.5">
                    <Label>Adicionar item da mesma janela operacional</Label>
                    <InfoHint
                      size="sm"
                      content="O catálogo usado aqui respeita a mesma data/hora original do pedido, sem recalcular a janela de entrega."
                    />
                  </div>
                  <Select value={selectedCatalogProductId} onValueChange={setSelectedCatalogProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um produto para adicionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCatalogProducts.map((product) => (
                        <SelectItem key={product.productId} value={product.productId}>
                          {product.code} - {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCatalogProduct ? (
                    <p className="text-xs text-muted-foreground">
                      Dias válidos: {selectedCatalogProduct.productionDays.join(" · ")}.
                    </p>
                  ) : null}
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="outline" onClick={handleAddCatalogProduct} disabled={!selectedCatalogProductId}>
                    <PencilLine className="size-4" />
                    Adicionar item
                  </Button>
                </div>
              </div>
              {availableCatalogProducts.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Não há mais produtos elegíveis para adicionar dentro da janela original deste pedido.
                </p>
              ) : null}
            </div>
          ) : null}

          <PaginatedSection items={visibleItems} label="itens do pedido" initialPageSize={8}>
            {(paginatedItems) => (
              <div className="overflow-x-auto rounded-xl border border-border/80">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead className="bg-panel">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Código</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Categoria</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Un.</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Quantidade</th>
                      {isEditing ? (
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Ações</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item) => {
                      const isAddedItem = item.id.startsWith("draft-");

                      return (
                      <tr key={item.id}>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm font-mono">{item.code}</td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                          <div>{item.name}</div>
                          {isAddedItem ? (
                            <div className="text-xs text-muted-foreground">Novo item adicionado nesta edição.</div>
                          ) : null}
                        </td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.category}</td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.unit}</td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm font-semibold">
                          {isEditing ? (
                            <div className="space-y-1">
                              <Input
                                type="number"
                                min="0"
                                step={isDiscreteUnit(item.unit) ? "1" : "0.1"}
                                value={isAddedItem ? item.quantity : draftItems[item.id] ?? item.quantity}
                                onChange={(event) => {
                                  const nextValue = Number(event.target.value);
                                  if (isAddedItem) {
                                    handleAddedItemQuantityChange(item.id, nextValue);
                                    return;
                                  }

                                  setDraftItems((current) => ({
                                    ...current,
                                    [item.id]: nextValue,
                                  }));
                                }}
                              />
                            </div>
                          ) : (
                            item.quantity
                          )}
                        </td>
                        {isEditing ? (
                          <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                            {isAddedItem ? (
                              <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveAddedItem(item.id)}>
                                <X className="size-4" />
                                Remover
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">Zere a quantidade para remover.</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}
          </PaginatedSection>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observações do Pedido</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Textarea
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              placeholder="Observações operacionais do pedido"
              className="min-h-[120px]"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{order.note?.trim() || "Sem observações registradas."}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linha do Tempo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado até o momento.</p>
          ) : (
            order.events.map((event) => (
              <article key={event.id} className="rounded-lg border border-border/70 bg-panel/35 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{event.title}</p>
                  <span className="text-xs text-muted-foreground">{event.createdAt}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                {event.actorName ? (
                  <p className="mt-2 text-xs text-muted-foreground">Responsável: {event.actorName}</p>
                ) : null}
              </article>
            ))
          )}
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
            {order.canOpenOccurrence
              ? "Ocorrência habilitada: pedido já entrou na etapa de entrega."
              : "Ocorrência será habilitada quando o pedido entrar em rota ou for entregue."}
          </p>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
