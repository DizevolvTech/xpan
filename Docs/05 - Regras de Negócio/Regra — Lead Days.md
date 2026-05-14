# Lead days — `sale_lead_days` × `expedition_lead_days`

Há **três** lead days no sistema. Esse é o ponto mais confuso do motor.

| Campo | Onde mora | O que mede | Migration |
|---|---|---|---|
| `operational_settings.expedition_lead_days` | global (fábrica) | dias entre `baseDate` (loja pede) e `deliveryDate` (loja recebe). É o "D+X" | `20260309130000_initial_schema.sql:122` |
| `operational_settings.sale_lead_days` | global (fábrica) | dias entre `deliveryDate` e `saleDate` (início da venda). É o "D+Y" | `20260505180000_xpan_operational_sale_lead_days.sql:2` |
| `products.expedition_lead_days` | por produto | dias entre `productionDate` e `deliveryDate` (gap individual). Ex.: bolo = 1 (esfria 1 dia), pão = 0 (mesmo dia) | `20260505190000_xpan_product_expedition_lead_days.sql:6` |

> Atenção ao nome colidente: o campo do produto se chama IGUAL ao global, mas mede coisa diferente. No código, ambos viram `expeditionLeadDays`. Veja `production-planning.ts:88` (settings) vs `production-planning.ts:152` (produto).

## Ordem de precedência (quem aplica onde)

Nada se sobrepõe — cada um manda em seu próprio segmento da linha do tempo. Mas é fácil confundir.

```
pedido ──[cutoff]──> baseDate ──[D+X global]──> deliveryDate ──[D+Y global]──> saleDate
                                     ▲                          ▲
                                     │ (regressão)              │
                              productionDate                 (vender)
                                     ▲
                                     │ [D+G produto = expeditionLeadDays do produto]
                                     │
                                  busca regressiva: productionDate + G = deliveryDate
```

### Fórmula efetiva

- `deliveryDate = baseDate + settings.expeditionLeadDays` (depois ajustado pra dia de recebimento) — `engine.ts:152`
- `productionDate` resolvido por **busca regressiva** de tal modo que `productionDate + product.expeditionLeadDays = deliveryDate` (`engine.ts:328-363`).
  - Cursor parte de `deliveryDate` e vai recuando dia-a-dia até `baseDate`.
  - Para cada dia da ficha (`productionDays`) intersectado com `scheduleItem.productionDays`, calcula a entrega candidata.
  - Se nenhum casar, busca delayed no futuro até 14 dias.
- `saleDate = deliveryDate + normalizeSaleLeadDays(settings.saleLeadDays)` — `engine.ts:322,574`.

### Caso paradigma (do test file)

`engine.test.ts:156-205` — pedido em quarta (29/04), entrega sexta (01/05), D+X=2:
- **Bolo 4** (produz quarta, G=1): bloqueado — `quarta + 1 = quinta ≠ sexta`.
- **Bolo 5** (produz quinta, G=1): OK — `quinta + 1 = sexta = deliveryDate`. ✓
- **Bolo 6** (produz sexta, G=1): bloqueado — `sexta + 1 = sábado > sexta` (`delayed = true`).
- **Pão fresco** (produz sexta, G=0): OK — produz e entrega no mesmo dia (`engine.test.ts:232-256`).

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
