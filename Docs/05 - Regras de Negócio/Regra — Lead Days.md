# Lead days — `sale_lead_days` × `expedition_lead_days`

Há **três** lead days no sistema. Esse é o ponto mais confuso do motor.

| Campo | Onde mora | O que mede | Migration |
|---|---|---|---|
| `operational_settings.expedition_lead_days` | global (fábrica) | dias entre `baseDate` (loja pede) e `deliveryDate` (loja recebe). É o "D+X" | `20260309130000_initial_schema.sql:122` |
| `operational_settings.sale_lead_days` | global (fábrica) | dias entre `deliveryDate` e `saleDate` (início da venda). É o "D+Y" | `20260505180000_xpan_operational_sale_lead_days.sql:2` |
| `products.expedition_lead_days` | por produto | dias entre `productionDate` e `deliveryDate` (gap individual). Ex.: bolo = 1 (esfria 1 dia), pão = 0 (mesmo dia) | `20260505190000_xpan_product_expedition_lead_days.sql:6` |

> Atenção ao nome colidente: o campo do produto se chama IGUAL ao global, mas mede coisa diferente. No código, ambos viram `expeditionLeadDays`. Veja `production-planning.ts:88` (settings) vs `production-planning.ts:152` (produto).

## Ordem de precedência (quem aplica onde)

> **XPAN-2/3 (2026-07): regra INVERTIDA.** Até então o global (D+X) determinava a
> entrega e o produto tinha que "caber" nela (quem não cabia era bloqueado — ver testes
> dos bolos PD-260429-0001). A partir do XPAN-2/3 o modelo é **production-driven**: o
> dia de produção do produto é a fonte de verdade; a entrega = produção + gap do produto.
> O D+X global deixa de agendar a entrega (fica só como "janela" do pedido — escopo
> operacional/display, calculado em `getOperationalOrderWindow`). Exceção: a **âncora
> AJ-A10** (fábrica abriu pedido para entrega X) mantém a busca regressiva a partir de X.

```
pedido ──[cutoff]──> baseDate ──[D+X global]──> deliveryDate (JANELA do pedido, só escopo)
                                      ▲
                                      │
                               productionDate  ◄── fonte de verdade (production-driven)
                                      │ [D+G produto = expeditionLeadDays do produto]
                                      ▼
                            deliveryDate efetiva = produção + D+G (ajustada ao recebimento)
```

### Fórmula efetiva (XPAN-2/3)

- **Caminho normal (production-driven)** — `resolveScheduledProductAvailability`, `engine.ts`:
  - `productionDate` = primeiro dia de produção compatível (`product.productionDays ∩ scheduleItem.productionDays`) em `[baseDate, baseDate+14)`.
  - `deliveryDate` = `moveToNextAllowedWeekday(productionDate + product.expeditionLeadDays, receivingDays)`.
  - `saleDate` = `deliveryDate + normalizeSaleLeadDays(settings.saleLeadDays)` (`engine.ts`).
  - Caso "mesmo dia" (gap 0, ex.: arroz/pão): `productionDate = deliveryDate`.
- **Caminho âncora (AJ-A10)** — `targetDeliveryDate` informado (fábrica abriu p/ X):
  - `deliveryDate = X`; `productionDate` por **busca regressiva** (`resolveProductionDateInWindow`): `productionDate + gap = X`. Se nenhuma produzir para X → bloqueado (delayed), **sem** agendar +7 (AJ-0024).
- `baseDate`/`deliveryDate` da **janela do pedido** (`getOperationalOrderWindow`) seguem usando o global D+X — só para escopo operacional, `store-order-window` (1 pedido por janela) e display.

> **Discriminador do gate (XPAN-2/3, 2026-07):** o que decide âncora × production-driven é o
> `opened_at` do `store_order` (→ `StoreOrder.committedDeliveryDate`), **não** a `delivery_date`
> persistida. `createStoreOrder` grava `delivery_date` = janela global mas **nunca** seta
> `opened_at` → `committedDeliveryDate = null` → production-driven. Só as aberturas pela FÁBRICA
> (pedido p/ data futura / esqueleto da semana) setam `opened_at` → âncora. O gate vale nos TRÊS
> pontos: planejamento (`buildPlannedItems`), validação de criação (`createStoreOrder` passa
> `targetDeliveryDate: null`) e validação de edição (`updateStoreOrder` gateia por `opened_at`).
> Sem esse gate, a `delivery_date` global re-ancorava pedidos da loja e travava a liberação
> (regressão F1: item aceito no catálogo, pedido nunca liberável).

### Caso paradigma (depois do XPAN-2/3)

Pedido em quarta (29/04), 3 bolos com gap=1, **independente do D+2 global**:
- **Bolo 4** (produz quarta): produção 29/04 → entrega **qui 30/04**. ✓ (antes: bloqueado)
- **Bolo 5** (produz quinta): produção 30/04 → entrega **sex 01/05**. ✓
- **Bolo 6** (produz sexta): produção 01/05 → entrega **sáb 02/05**. ✓ (antes: bloqueado)
- **Pão fresco / arroz** (produz sexta, gap 0): produção 01/05 = entrega 01/05 (mesmo dia).

> Consequência: um pedido pode ter ITENS com datas de entrega distintas (cada produto no
> seu cronograma). A OP/expedição já trabalham com `deliveryDate` por item; o
> `deliveryDate` do pedido = o mais tardio dos itens (`getLatestDate`, `buildOrders`).

## `normalizeSaleLeadDays` — armadilha

`engine.ts:188-190`:
```ts
function normalizeSaleLeadDays(saleLeadDays: number | undefined) {
  return Number.isFinite(saleLeadDays) && Number(saleLeadDays) > 0 ? Number(saleLeadDays) : 1;
}
```

> ⚠️ Frágil: o motor **força saleLeadDays ≥ 1**. Mesmo que o tenant cadastre `0`, o cálculo vira 1. Mas o constraint do DB aceita `>= 0` (migration `20260505180000`:9). Resultado: gestor cadastra 0 (esperando "venda no mesmo dia da entrega"), mas o motor entrega `saleDate = deliveryDate + 1`. Não há aviso.

## Validação na UI

`src/app/gestor-fabrica/page.tsx:72-77`:
```ts
const isValid =
  Number.isInteger(expeditionLeadDaysValue) &&
  expeditionLeadDaysValue >= 0 &&
  expeditionLeadDaysValue <= 30 &&
  Number.isInteger(saleLeadDaysValue) &&
  saleLeadDaysValue >= 0 &&
  saleLeadDaysValue <= 30;
```

Mas no produto (`src/lib/product-form-logic.ts:65-67`):
```ts
expeditionLeadDays:
  Number.isFinite(product.expeditionLeadDays) && Number(product.expeditionLeadDays) >= 0
    ? Number(product.expeditionLeadDays)
    : 1,
```

Defaults divergentes:
- Produto via form: `expeditionLeadDays: 1` (`product-form-logic.ts:98`).
- Settings via `useMasterData`: `expeditionLeadDays: 0, saleLeadDays: 1` (`src/lib/use-master-data.ts:11-12`).
- Settings via mock: `expeditionLeadDays: 2, saleLeadDays: 1` (`production-planning.ts:234`).

> ⚠️ Implícito: três defaults diferentes para a mesma coisa. Se um tenant for criado sem inicialização correta de `operational_settings`, ele pode rodar com `expeditionLeadDays = 0` (do hook) — o que faz `deliveryDate = baseDate` (entrega no mesmo dia da base) sem nenhum alerta.

## Cenário "produto não cabe na janela"

Se a janela `[baseDate, deliveryDate]` for muito curta para o gap do produto:
- `resolveProductionDateInWindow` retorna `delayed: true` com data futura.
- `resolveScheduledProductAvailability` (`engine.ts:275-287`) marca `available: false` com mensagem:
  > "Produção em DD/MM + N dia(s) cai após a entrega prevista."

`buildStoreOrderCatalog` (`store-order-catalog.ts:142-144`) bloqueia o produto no catálogo da loja.

`validateStoreOrderItems` (`store-orders.ts:200-206`) recusa a criação se o produto não está `available` no catálogo.
