# Regra D+2 / D+3 — entrega e venda

## Onde a regra mora

- **D+X de entrega (entre base e recebimento)**: `operational_settings.expedition_lead_days` (global da fábrica).
  - Default em código: `expeditionLeadDays: 2` (`src/lib/production-planning.ts:234`).
  - Default em DB: definido pelo tenant via `PATCH /api/master-data/operational-settings`. Validação: `>= 0 && <= 30` (`src/app/gestor-fabrica/page.tsx:73-77`).
- **D+Y de venda (entre entrega e início da venda)**: `operational_settings.sale_lead_days` (global, **migration `20260505180000`**).
  - Default em DB: `1` (migration `20260505180000_xpan_operational_sale_lead_days.sql:2`).
  - Default em código: `saleLeadDays: 1` (`src/lib/production-planning.ts:235`).

## Pipeline de cálculo

```
orderedAt (timestamp)
  → getBaseDateByCutoff (engine.ts:114)              # +1 dia se passou do cutoff
  → moveToNextAllowedWeekday (engine.ts:131)         # pula para dia em getEnabledOrderingDays(store)
  = baseDate

baseDate
  → addDays(baseDate, settings.expeditionLeadDays)   # engine.ts:152 (D+X global)
  → moveToNextAllowedWeekday em getEnabledReceivingDays(store)
  = deliveryDate

deliveryDate
  → addDays(deliveryDate, normalizeSaleLeadDays(settings.saleLeadDays))
  = saleDate                                          # engine.ts:322, engine.ts:574
```

Trecho-chave (`engine.ts:147-154`):

```ts
export function getDeliveryDateByStoreRule(baseDate, store, settings) {
  const calculatedDate = addDays(baseDate, settings.expeditionLeadDays);
  return moveToNextAllowedWeekday(calculatedDate, getEnabledReceivingDays(store));
}
```

## Exemplos de cálculo (do `engine.test.ts`)

### Exemplo 1 — cutoff + bloqueio
- Pedido: terça 17/03/2026 às 19:30 (após cutoff 18:00)
- Loja: pode pedir seg-sex, com `orderingBlockedDays = ["quarta"]`; recebe seg-sab com `receivingBlockedDays = ["sexta"]`
- `baseDate = 2026-03-19` (cutoff → 18/03 quarta; quarta bloqueada → 19/03 quinta)
- `deliveryDate = 2026-03-21` (quinta + D+2 = sábado; sábado liberado).
- Fonte: `engine.test.ts:40-47`.

### Exemplo 2 — entrega esbarra em dia bloqueado
- Se a entrega calculada cair em "sexta" (bloqueada para recebimento), `moveToNextAllowedWeekday` empurra para sábado.
- Isso significa que **D+2 efetivo pode virar D+3 silenciosamente** quando há bloqueio de recebimento. Não há aviso ao operador.
- > Implícito: a UI mostra `D+{expeditionLeadDays}` cru (ex.: `src/app/loja/pedidos/page.tsx:475`, `857`), mesmo quando o efetivo foi maior por causa de bloqueio.

### Exemplo 3 — saleDate (D+3 do paradigma)
- `deliveryDate = sábado` + `saleLeadDays = 1` → `saleDate = domingo`
- Em `src/app/loja/pedidos/page.tsx:865`: rótulo final mostra `D+${expeditionLeadDays + saleLeadDays}` (ex.: `D+3`).
- > Frágil: esse rótulo é puramente "matemático" — `expeditionLeadDays + saleLeadDays` —, mas o `deliveryDate` real pode ter sido empurrado por bloqueio. Resultado: o "D+3" do label pode não bater com a diferença de dias real entre `orderedAt` e `saleDate`.

## Interação com snapshot do pedido

Quando o pedido é criado (`src/lib/supabase-data/store-orders.ts:382-397`):
- `base_date` ← `orderWindow.baseDate`
- `delivery_date` ← `orderWindow.deliveryDate`
- `expedition_lead_days_snapshot` ← `snapshot.operationalSettings.expeditionLeadDays` (valor global no momento)

> Frágil: `sale_lead_days` **não** é capturado no snapshot do pedido (`store_orders` não tem essa coluna). Se o ajuste global mudar de 1 para 2 depois da criação, o `saleDate` exibido em telas que reconstroem pelo motor mudará retroativamente.

> Implícito: o snapshot pega só `expeditionLeadDays` global — não pega o `expeditionLeadDays` do produto (ver `22-lead-days.md`). Drift retroativo: ver `23-drift.md`.

## Onde o D+X aparece visualmente

| Tela | Linha | Rótulo |
|---|---|---|
| Lojas (cadastro) | `src/app/gestor-dados/lojas/page.tsx:319` | `D+{expeditionLeadDays}` |
| Loja → Novo pedido | `src/app/loja/pedidos/page.tsx:475` | `Prazo global da fábrica: D+{X}` |
| Loja → Confirmação | `src/app/loja/pedidos/page.tsx:857` | `(D+{X})` ao lado da data de entrega |
| Loja → Confirmação | `src/app/loja/pedidos/page.tsx:865` | `(D+{X+Y})` ao lado da data de venda |
| Produto (cadastro) | `src/components/production/product-form-dialog.tsx:1753-1767` | `expeditionLeadDays do produto`, `D+X global`, `Entrega + Y` |
| Detalhe do pedido | `src/app/api/store-orders/[orderId]/route.ts:186` | `dPlusLabel: D+{expedition_lead_days_snapshot}` |
| Gestor de fábrica | `src/app/gestor-fabrica/page.tsx:113-114, 149-151` | `D+{X} da base` |
