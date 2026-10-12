"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageLayout } from "@/components/shared/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canConfirmReview, gridToEntryRows, type ExistingOrderConflict, type OrderEntryCatalog, type OrderEntryError, type OrderEntryRow, type OrderEntryWarning, type ReviewedOrderRow } from "@/lib/centralized-orders";
import { downloadOrderTemplate, readOrderExcel } from "@/lib/order-excel";
import { selectStoresForProduct } from "@/lib/store-product-mix";

export default function CentralizedOrdersPage() {
  const [catalog, setCatalog] = useState<OrderEntryCatalog>({ stores: [], products: [] });
  const [productId, setProductId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, Record<string, string>>>({});
  const [deliveryDate, setDeliveryDate] = useState("");
  const [imported, setImported] = useState<OrderEntryRow[] | null>(null);
  const [review, setReview] = useState<{ rows: ReviewedOrderRow[]; errors: OrderEntryError[]; warnings?: OrderEntryWarning[]; conflicts?: ExistingOrderConflict[] } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  // "produto": preenche um produto para várias lojas. "grade": todas as lojas × todos os produtos de uma vez.
  const [mode, setMode] = useState<"produto" | "grade">("produto");
  const [gridFilter, setGridFilter] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Mix da loja (cliente, 07/10): por padrão só as lojas que têm o produto no mix; marcar mostra todas.
  const [showAllStores, setShowAllStores] = useState(false);
  const [created, setCreated] = useState<Array<{ orderId: string; code: string }>>([]);
  const requestId = useRef("");
  const product = catalog.products.find(p => p.id === productId);
  const visibleStores = selectStoresForProduct(catalog.stores, productId, {
    showAll: showAllStores,
    hasQuantity: storeId => (quantities[productId]?.[storeId] ?? "").trim() !== "",
  });
  const hiddenStoreCount = catalog.stores.length - visibleStores.length;
  const storesHaveMix = catalog.stores.some(store => store.productMix);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/store-orders/centralized").then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      if (!cancelled) { setCatalog(data); setProductId(data.products[0]?.id ?? ""); }
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  function invalidateReview() { setReview(null); setAcknowledged(false); setError(""); requestId.current = ""; }
  function entryRows(): OrderEntryRow[] {
    return imported ?? gridToEntryRows(quantities);
  }
  async function submit(confirm: boolean) {
    setBusy(true); setError("");
    try {
      if (!requestId.current) requestId.current = crypto.randomUUID();
      const response = await fetch("/api/store-orders/centralized", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: entryRows(), deliveryDate, confirm, requestId: requestId.current, source: imported ? "excel" : "centralizado" }) });
      const data = await response.json();
      if (data.errors) setReview(data);
      if (!response.ok) throw new Error(data.message ?? "Corrija os registros indicados antes de confirmar.");
      if (confirm) { setCreated(data.created); setReview(null); }
      else { setReview(data); setAcknowledged(false); }
    } catch (e) { setError(e instanceof Error ? e.message : "Falha no lançamento."); }
    finally { setBusy(false); }
  }

  return <PageLayout title="Pedido centralizado e importação" description="Distribua produtos entre lojas e revise todos os destinos antes de confirmar." badge="Fábrica">
    <Link href="/gestor-fabrica/pedidos" className="underline">Voltar aos pedidos</Link>
    {error && <p role="alert" className="rounded border border-red-400 p-3 text-red-600">{error}</p>}
    {created.length > 0 ? <section className="space-y-3"><h2 className="font-semibold">{created.length} pedidos registrados para revisão e liberação à produção.</h2>{created.map(order => <p key={order.orderId}><Link className="underline" href={`/gestor-fabrica/pedidos/${encodeURIComponent(order.orderId)}`}>{order.code}</Link></p>)}<Button onClick={() => { setCreated([]); setImported(null); setQuantities({}); invalidateReview(); }}>Novo lançamento</Button></section> : <>
      <fieldset disabled={busy} className="min-w-0 space-y-5 rounded-xl border p-4">
        <div className="max-w-xs space-y-2"><Label htmlFor="delivery-date">Data de entrega *</Label><Input id="delivery-date" type="date" required value={deliveryDate} onChange={e => { setDeliveryDate(e.target.value); invalidateReview(); }} /></div>
        <section className="space-y-3 border-b pb-5">
          <h2 className="font-semibold">Importar pedidos Excel</h2>
          <p className="text-sm text-muted-foreground">Arquivo .xlsx, até 5 MB e 5.000 linhas, com uma aba. Reconhecemos colunas comuns de ERP (loja ou filial; produto, código ou descrição; quantidade ou qtd), em qualquer ordem e mesmo com título acima da tabela. Identifique lojas e produtos pelo código ou nome. Quantidade aceita 12, 1,5 e 1.000 (mil); itens por peso com ponto de milhar pedem sua conferência. Não cria cadastros.</p>
          <Button variant="outline" onClick={() => void downloadOrderTemplate().catch(e => setError(e.message))}>Baixar modelo Excel</Button>
          <Label htmlFor="order-excel">Selecionar arquivo</Label><Input id="order-excel" type="file" accept=".xlsx" onChange={async e => {
            const file = e.target.files?.[0]; e.target.value = "";
            if (!file) return;
            invalidateReview(); setBusy(true);
            try {
              if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 5 * 1024 * 1024) throw new Error("Selecione um arquivo .xlsx de até 5 MB.");
              setImported(await readOrderExcel(await file.arrayBuffer()));
            } catch (e) { setImported(null); setError(e instanceof Error ? e.message : "Arquivo inválido."); }
            finally { setBusy(false); }
          }} />
          {imported && <p>{imported.length} linhas carregadas. <Button variant="ghost" onClick={() => { setImported(null); invalidateReview(); }}>Voltar ao preenchimento manual</Button></p>}
        </section>
        {!imported && <div role="tablist" aria-label="Modo de preenchimento" className="flex gap-2">
          <Button role="tab" aria-selected={mode === "produto"} variant={mode === "produto" ? "default" : "outline"} onClick={() => setMode("produto")}>Por produto</Button>
          <Button role="tab" aria-selected={mode === "grade"} variant={mode === "grade" ? "default" : "outline"} onClick={() => setMode("grade")}>Grade lojas × produtos</Button>
        </div>}
        {!imported && mode === "grade" && <section className="space-y-3">
          <h2 className="font-semibold">Grade lojas × produtos</h2>
          <p className="text-sm text-muted-foreground">Cada linha é um produto e cada coluna uma loja. Vazio ou zero não gera pedido. Aceita 12, 1,5 e 1.000 (mil).</p>
          <Label htmlFor="grid-filter">Filtrar produtos</Label>
          <Input id="grid-filter" placeholder="Código ou nome" value={gridFilter} onChange={e => setGridFilter(e.target.value)} />
          <div className="max-h-[60vh] overflow-auto rounded border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-background"><tr><th className="min-w-44 p-2 align-bottom">Produto</th>{catalog.stores.map(store => <th key={store.id} className="min-w-28 p-2 align-bottom" title={`${store.code} · ${store.name}`}><span className="block">{store.code}</span><span className="block max-w-28 truncate text-xs font-normal text-muted-foreground">{store.name}</span></th>)}</tr></thead>
              <tbody>{catalog.products.filter(p => !gridFilter.trim() || `${p.externalCode ?? ""} ${p.code} ${p.name}`.toLocaleLowerCase("pt-BR").includes(gridFilter.trim().toLocaleLowerCase("pt-BR"))).map(p => <tr key={p.id} className="border-t">
                <th scope="row" className="min-w-44 p-2 font-normal">{p.externalCode || p.code} · {p.name} <span className="text-muted-foreground">({p.unit})</span></th>
                {catalog.stores.map(store => <td key={store.id} className="p-1"><Input inputMode="decimal" aria-label={`${p.name}, ${store.name}`} className="w-24" value={quantities[p.id]?.[store.id] ?? ""} onChange={e => { const value = e.target.value; setQuantities(current => ({ ...current, [p.id]: { ...current[p.id], [store.id]: value } })); invalidateReview(); }} /></td>)}
              </tr>)}</tbody>
            </table>
          </div>
        </section>}
        {!imported && mode === "produto" && <section className="space-y-3">
          <h2 className="font-semibold">Preencher por produto</h2>
          <Label htmlFor="central-product">Produto *</Label>
          <select id="central-product" className="w-full rounded-md border bg-background p-2" value={productId} onChange={e => setProductId(e.target.value)}>
            {catalog.products.map(p => <option key={p.id} value={p.id}>{p.externalCode || p.code} · {p.name} ({p.unit})</option>)}
          </select>
          <p className="text-sm text-muted-foreground">Preencha as lojas que receberão este produto. Zero ou vazio não gera pedido. Você pode trocar de produto sem perder as quantidades.</p>
          {storesHaveMix && <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showAllStores} onChange={e => setShowAllStores(e.target.checked)} />Mostrar todas as lojas{!showAllStores && hiddenStoreCount > 0 ? ` (${hiddenStoreCount} sem este produto no mix estão escondidas)` : ""}</label>}
          <div className="grid gap-3 sm:grid-cols-2">{visibleStores.map(store => <div key={store.id} className="flex items-center justify-between gap-3 rounded border p-3">
            <Label htmlFor={`quantity-${store.id}`}>{store.code} · {store.name}</Label>
            <Input id={`quantity-${store.id}`} aria-label={`${store.name}, quantidade em ${product?.unit ?? "unidades"}`} inputMode="decimal" className="w-28" value={quantities[productId]?.[store.id] ?? ""} onChange={e => { const value = e.target.value; setQuantities(current => ({ ...current, [productId]: { ...current[productId], [store.id]: value } })); invalidateReview(); }} />
          </div>)}</div>
          <Button variant="outline" disabled={catalog.products.findIndex(p => p.id === productId) >= catalog.products.length - 1} onClick={() => setProductId(catalog.products[catalog.products.findIndex(p => p.id === productId) + 1]?.id ?? productId)}>Próximo produto</Button>
        </section>}
        <Button disabled={!deliveryDate || !entryRows().length} onClick={() => void submit(false)}>{busy ? "Validando…" : "Revisar todos os pedidos"}</Button>
      </fieldset>
      {review && <section className="space-y-4 rounded-xl border p-4" aria-live="polite">
        <h2 className="font-semibold">Revisão antes da confirmação</h2>
        {review.errors.length > 0 && <div role="alert" className="text-red-600"><p>Nenhum pedido foi importado. Corrija os registros e revise novamente.</p><ul>{review.errors.map((e, i) => <li key={i}>Linha {e.row}: {e.message}</li>)}</ul></div>}
        {(review.conflicts?.length ?? 0) > 0 && <div role="alert" className="rounded border border-amber-400 p-3 text-amber-700"><p className="font-medium">Lojas que já têm pedido ativo nesta data:</p><ul>{review.conflicts!.map(c => <li key={c.storeId}>{c.storeName}: pedido <strong>{c.orderCode}</strong> (busque este código em <Link className="underline" href="/gestor-fabrica/pedidos">Pedidos</Link>)</li>)}</ul></div>}
        {(review.warnings?.length ?? 0) > 0 && <div role="status" className="rounded border border-amber-400 p-3 text-amber-700"><p className="font-medium">Confira antes de confirmar:</p><ul>{review.warnings!.map((w, i) => <li key={i}>Linha {w.row}: {w.message}</li>)}</ul><label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />Conferi estas quantidades</label></div>}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Linha</th><th>Loja</th><th>Produto</th><th>Quantidade</th></tr></thead><tbody>{review.rows.map(row => <tr className="border-t" key={row.row}><td className="p-2">{row.row}</td><td>{row.storeName}</td><td>{row.productName}</td><td>{row.quantity} {row.unit}</td></tr>)}</tbody></table></div>
        <p>{new Set(review.rows.map(r => r.storeId)).size} lojas · {review.rows.length} itens · Entrega {deliveryDate.split("-").reverse().join("/")}</p>
        <Button disabled={busy || !canConfirmReview(review, acknowledged).allowed} title={canConfirmReview(review, acknowledged).reason ?? undefined} onClick={() => void submit(true)}>{busy ? "Registrando…" : "Confirmar e registrar pedidos"}</Button>
      </section>}
    </>}
  </PageLayout>;
}
