"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageLayout } from "@/components/shared/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrderEntryCatalog, OrderEntryError, OrderEntryRow, ReviewedOrderRow } from "@/lib/centralized-orders";
import { downloadOrderTemplate, readOrderExcel } from "@/lib/order-excel";

export default function CentralizedOrdersPage() {
  const [catalog, setCatalog] = useState<OrderEntryCatalog>({ stores: [], products: [] });
  const [productId, setProductId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, Record<string, string>>>({});
  const [deliveryDate, setDeliveryDate] = useState("");
  const [imported, setImported] = useState<OrderEntryRow[] | null>(null);
  const [review, setReview] = useState<{ rows: ReviewedOrderRow[]; errors: OrderEntryError[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Array<{ orderId: string; code: string }>>([]);
  const requestId = useRef("");
  const product = catalog.products.find(p => p.id === productId);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/store-orders/centralized").then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      if (!cancelled) { setCatalog(data); setProductId(data.products[0]?.id ?? ""); }
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  function invalidateReview() { setReview(null); setError(""); requestId.current = ""; }
  function entryRows(): OrderEntryRow[] {
    return imported ?? Object.entries(quantities).flatMap(([product, stores]) => Object.entries(stores)
      .filter(([, quantity]) => quantity.trim() !== "" && Number(quantity) !== 0)
      .map(([store, quantity]) => ({ row: 0, store, product, quantity }))).map((r, index) => ({ ...r, row: index + 1 }));
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
      else setReview(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha no lançamento."); }
    finally { setBusy(false); }
  }

  return <PageLayout title="Pedido centralizado e importação" description="Distribua produtos entre lojas e revise todos os destinos antes de confirmar." badge="Fábrica">
    <Link href="/gestor-fabrica/pedidos" className="underline">Voltar aos pedidos</Link>
    {error && <p role="alert" className="rounded border border-red-400 p-3 text-red-600">{error}</p>}
    {created.length > 0 ? <section className="space-y-3"><h2 className="font-semibold">{created.length} pedidos registrados para revisão e liberação à produção.</h2>{created.map(order => <p key={order.orderId}><Link className="underline" href={`/gestor-fabrica/pedidos/${encodeURIComponent(order.orderId)}`}>{order.code}</Link></p>)}<Button onClick={() => { setCreated([]); setImported(null); setQuantities({}); invalidateReview(); }}>Novo lançamento</Button></section> : <>
      <fieldset disabled={busy} className="space-y-5 rounded-xl border p-4">
        <div className="max-w-xs space-y-2"><Label htmlFor="delivery-date">Data de entrega *</Label><Input id="delivery-date" type="date" required value={deliveryDate} onChange={e => { setDeliveryDate(e.target.value); invalidateReview(); }} /></div>
        <section className="space-y-3 border-b pb-5">
          <h2 className="font-semibold">Importar pedidos Excel</h2>
          <p className="text-sm text-muted-foreground">Arquivo .xlsx, até 5 MB e 5.000 linhas. Uma aba com loja, produto e quantidade. Identifique lojas e produtos pelo código ou nome exato. Use códigos para nomes repetidos e preserve zeros à esquerda. Não cria cadastros.</p>
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
        {!imported && <section className="space-y-3">
          <h2 className="font-semibold">Preencher por produto</h2>
          <Label htmlFor="central-product">Produto *</Label>
          <select id="central-product" className="w-full rounded-md border bg-background p-2" value={productId} onChange={e => setProductId(e.target.value)}>
            {catalog.products.map(p => <option key={p.id} value={p.id}>{p.externalCode || p.code} · {p.name} ({p.unit})</option>)}
          </select>
          <p className="text-sm text-muted-foreground">Preencha as lojas que receberão este produto. Zero ou vazio não gera pedido. Você pode trocar de produto sem perder as quantidades.</p>
          <div className="grid gap-3 sm:grid-cols-2">{catalog.stores.map(store => <div key={store.id} className="flex items-center justify-between gap-3 rounded border p-3">
            <Label htmlFor={`quantity-${store.id}`}>{store.code} · {store.name}</Label>
            <Input id={`quantity-${store.id}`} aria-label={`${store.name}, quantidade em ${product?.unit ?? "unidades"}`} type="number" min="0" step="any" className="w-28" value={quantities[productId]?.[store.id] ?? ""} onChange={e => { const value = e.target.value; setQuantities(current => ({ ...current, [productId]: { ...current[productId], [store.id]: value } })); invalidateReview(); }} />
          </div>)}</div>
          <Button variant="outline" disabled={catalog.products.findIndex(p => p.id === productId) >= catalog.products.length - 1} onClick={() => setProductId(catalog.products[catalog.products.findIndex(p => p.id === productId) + 1]?.id ?? productId)}>Próximo produto</Button>
        </section>}
        <Button disabled={!deliveryDate || !entryRows().length} onClick={() => void submit(false)}>{busy ? "Validando…" : "Revisar todos os pedidos"}</Button>
      </fieldset>
      {review && <section className="space-y-4 rounded-xl border p-4" aria-live="polite">
        <h2 className="font-semibold">Revisão antes da confirmação</h2>
        {review.errors.length > 0 && <div role="alert" className="text-red-600"><p>Nenhum pedido foi importado. Corrija os registros e revise novamente.</p><ul>{review.errors.map((e, i) => <li key={i}>Linha {e.row}: {e.message}</li>)}</ul></div>}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Linha</th><th>Loja</th><th>Produto</th><th>Quantidade</th></tr></thead><tbody>{review.rows.map(row => <tr className="border-t" key={row.row}><td className="p-2">{row.row}</td><td>{row.storeName}</td><td>{row.productName}</td><td>{row.quantity} {row.unit}</td></tr>)}</tbody></table></div>
        <p>{new Set(review.rows.map(r => r.storeId)).size} lojas · {review.rows.length} itens · Entrega {deliveryDate.split("-").reverse().join("/")}</p>
        <Button disabled={busy || !!review.errors.length || !review.rows.length} onClick={() => void submit(true)}>{busy ? "Registrando…" : "Confirmar e registrar pedidos"}</Button>
      </section>}
    </>}
  </PageLayout>;
}
