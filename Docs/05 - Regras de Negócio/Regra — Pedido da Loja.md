# Pedido da loja — duplicidade, edição, agregação, drop antes/depois forno

## Duplicidade

### Como é evitada (criação)

`createStoreOrder` (`src/lib/supabase-data/store-orders.ts:364-377`):

```ts
// Check for existing active order for the same store + delivery date
const existingOrderResult = await supabase
  .from("store_orders")
  .select("id, code")
  .eq("store_id", storeDatabaseId)
  .eq("delivery_date", orderWindow.deliveryDate)
  .eq("management_status", "ativo")
  .maybeSingle();

if (existingOrderResult.data) {
  throw new Error(
    `Já existe um pedido ativo (${existingOrderResult.data.code}) para esta loja na data ${orderWindow.deliveryDate}. Use a opção Editar no pedido existente.`,
  );
}
```

**Chave de unicidade implícita**: `(store_id, delivery_date, management_status="ativo")`.

### Como pode acontecer mesmo assim

> ⚠️ Frágil: **a regra é só em código, não em DB**. Não há `UNIQUE (store_id, delivery_date) WHERE management_status='ativo'`. Em duas requisições paralelas (mesmo cliente, double-click, ou worker), as duas leituras podem retornar `null` e ambas inserir.

> ⚠️ Frágil: `delivery_date` é calculado pelo motor com base em `orderedAt` (que vem da request, default `new Date().toISOString()`). Se duas requisições chegarem em horários diferentes e atravessarem o cutoff, podem ter `delivery_date` diferente e ambas passarem — gerando dois pedidos para "datas próximas" sem violar a checagem.

> ⚠️ Frágil: pedidos `cancelado` não bloqueiam. Cliente que cancela e recria gera duas linhas no banco, então o histórico pode mostrar 3 pedidos para o mesmo dia (1 cancelado + 2 ativos por race).

Itens dentro do pedido têm dedup local em `dedupeItems` (`store-orders.ts:69-80`):

```ts
function dedupeItems(items) {
  const seen = new Set<string>();
  items.forEach((item) => {
    if (seen.has(item.productId)) {
      throw new Error(`Produto repetido no pedido: ${item.productId}`);
    }
    seen.add(item.productId);
  });
  return items;
}
```

## Edição depois de enviado — janelas e restrições

`ensureOrderIsMutable` (`store-orders.ts:97-119`):

```ts
async function ensureOrderIsMutable(orderId, supabase) {
  const orderRow = await resolveStoreOrderRow(orderId, supabase);

  if (orderRow.management_status === "cancelado") {
    throw new Error("Cancelled orders cannot be edited");
  }

  const releaseResult = await supabase
    .from("workflow_order_releases")
    .select("id")
    .eq("order_id", orderRow.id)
    .maybeSingle();
  ...
  if (releaseResult.data) {
    throw new Error("Orders already released to production cannot be edited");
  }
  return orderRow;
}
```

### Resumo das regras

| Estado | Pode editar? | Pode cancelar? |
|---|---|---|
| `management_status="ativo"` + sem release | sim | sim |
| `management_status="ativo"` + com release em `workflow_order_releases` | **não** | **não** (`workflow.ts:292-294`) |
| `management_status="cancelado"` | não | já está cancelado |

> ⚠️ Implícito: **não há janela de tempo**. A trava é só pelo estado de `workflow_order_releases`. Em teoria pode-se editar 1 segundo antes do release; depois do release, nunca mais. Não há "edição até 18h do dia D-1".

> ⚠️ Frágil: a edição troca **todos os itens** via `replaceStoreOrderItems` (`store-orders.ts:231-261`) — delete + insert. Não há diff. Se o front mandar uma lista incompleta, o resto se perde. Não há `audit log` granular do que mudou (só evento de "Pedido atualizado" em `appendStoreOrderEvent` linha 465-478).

> ⚠️ Implícito: `orderedAt` do pedido **não muda na edição** (`store-orders.ts:447`). Isso significa que a janela operacional (base/delivery date) é recalculada com a hora original. Editar à noite um pedido que estava antes do cutoff mantém a janela como se ainda estivesse antes do cutoff.

## Agregação por linha de produção (OPs)

`buildProductionOrdersFromPlannedItems` (`engine.ts:611-804`):

- Chave de agregação: `planningKey = productionDate|sectorId|lineId|scheduleId` (`engine.ts:413-418`).
- Para cada `planningKey` (uma OP), agrega itens de **múltiplos pedidos** de **múltiplas lojas**.
- Cada OP tem:
  - `items: ProductionOrderItem[]` — agregado por `productId` (somam `totalKg`)
  - `sourceItems: ProductionOrderSourceItem[]` — lista crua, preservando `orderId/storeId`
- Código da OP: `OP-YYMMDD-NNN` (`engine.ts:736`). NNN é incremental por **execução do motor**, não persistido.

> ⚠️ Frágil: o código da OP é **gerado a cada chamada do motor** e depende da ordem (ordenação por `productionDate, sectorName, lineName`, `engine.ts:722-732`). Adicionar/remover uma OP renumera tudo abaixo dela. Telas que persistirem o código da OP (impressão, exportação) ficam dessincronizadas.

Ordenação dentro da OP (`engine.ts:768-790`):
1. `productionSequence` (vem de `dayPriorities` no cronograma)
2. `productCode` alfabético

`productionSequence` agregado pega o **primeiro** que aparecer (`engine.ts:691`):
```ts
aggregated.productionSequence = aggregated.productionSequence ?? item.scheduleDayPriority;
```

> ⚠️ Implícito: se duas lojas trazem o mesmo produto mas o cronograma definiu prioridades por dia diferentes (não deveria, mas...), só a primeira pega.

## Coluna destacada (D+X "primária" no UI)

`src/app/loja/pedidos/page.tsx:88-95`:

```ts
function getDayFieldByDate(date: Date): EditableDayField {
  return FIELD_BY_JS_DAY_INDEX[date.getDay()];
}

function rotateDays(startDay: EditableDayField): EditableDayField[] {
  const startIndex = WEEK_SEQUENCE.indexOf(startDay);
  return [...WEEK_SEQUENCE.slice(startIndex), ...WEEK_SEQUENCE.slice(0, startIndex)];
}
```

E:
```ts
const highlightedDay = useMemo(() => getDayFieldByDate(saleDate), [saleDate]);
const dayColumns = useMemo(() => rotateDays(highlightedDay), [highlightedDay]);
```

> A coluna destacada é o **dia de venda**, calculado por `saleDate = deliveryDate + saleLeadDays`. As 7 colunas (seg→dom) são rotacionadas para começar pela coluna destacada.

> ⚠️ Implícito: a quantidade só pode ser editada na coluna destacada (`page.tsx:560`):
> ```ts
> if (field !== highlightedDay) return;
> ```
> As outras 6 colunas existem na UI mas são read-only/decorativas. Isso é invisível ao usuário sem o tooltip apropriado.

## Lote mínimo do pedido da loja

Não existe "lote mínimo do pedido". Existe lote mínimo **por produto** (`minimumProductionKg`, ver `24-lote-disponibilidade.md`). A loja pode pedir 1 unidade de um produto cujo mínimo de produção é 50kg — o sistema só alerta via `window.confirm`, não bloqueia.

> ⚠️ Frágil: sem validação server-side. `createStoreOrder` passa direto se o front for ignorado (ex.: cliente faz POST direto no `/api/store-orders`). A regra de mínimo é puramente UX.

## Drop antes/depois do forno

### O que é

Quebra de peso (`breakPercent`) atribuída a um estágio do processo. Campo do produto (`production-planning.ts:163-166`):
- `breakPercent: number` — % de perda esperada
- `breakStage: BreakStage` — onde a perda acontece
- `breakComment: string` — observação livre

### Estágios disponíveis

`BreakStage` (`production-planning.ts:14-16`):
```ts
export type BreakStage =
  | "antes_divisao"
  | "depois_divisao";
```

**Histórico importante**: o enum no PostgreSQL ainda tem 4 valores (`antes_divisao`, `depois_divisao`, `antes_forno`, `depois_forno`), mas a migration `20260505200000_xpan_drop_oven_break_stages.sql` migrou todos os produtos com `antes_forno` ou `depois_forno` para `depois_divisao`:

```sql
update public.products
set break_stage = 'depois_divisao'
where break_stage in ('antes_forno', 'depois_forno');
```

> ⚠️ Implícito: o enum no banco mantém os 4 valores (não dá pra dropar `enum value` em Postgres sem recriar o tipo). Se alguém inserir direto no banco com `antes_forno` ou `depois_forno`, o produto vai existir mas o front (`product-form-dialog.tsx:88-92`) só oferece as duas novas. UI mostra os antigos como dropdown vazio.

### Como é registrado/usado

- Em UI (`src/components/production/product-form-dialog.tsx:1655-1671`): dropdown com labels "Antes da divisão" / "Depois da divisão".
- Em cálculos: `getProductRecipeTotals` (`production-planning.ts:1369-1377`):

```ts
export function getProductRecipeTotals(product: ProductionProduct) {
  const totalIngredientsKg = getRecipeTotalKg(product.recipe);
  const outputAfterBreakKg = Number((totalIngredientsKg * (1 - product.breakPercent / 100)).toFixed(3));
  return { totalIngredientsKg, outputAfterBreakKg };
}
```

> ⚠️ Frágil: `breakStage` é informativo — a fórmula `outputAfterBreakKg` ignora o `breakStage` (não importa se a perda é antes ou depois). O estágio só serve para documentação/relatório. Não há matemática diferente.

> ⚠️ Frágil: o motor de cronograma **não usa `breakPercent`**. `internalKg` (`engine.ts:542`) é calculado como `quantity * salesToKgFactor` sem desconto de quebra. A capacidade da linha (`capacityPerDayKg`) é comparada com `internalKg`, mas a perda real durante produção não é descontada. Resultado: planejamento pode parecer cabido mas na prática a fábrica precisa produzir mais do que pediu.

## Outras regras escondidas do pedido

| Regra | Local | Risco |
|---|---|---|
| `legacyId` gerado por `crypto.randomUUID()` | `store-orders.ts:379` | Sem retries idempotentes — duplo POST gera dois pedidos com `legacy_id` diferente |
| Snapshot de unidade/fator no item | `store-orders.ts:244-255` (`*_snapshot` columns) | Snapshots permitem reconstrução pós-mudança de produto. Mas `expedition_lead_days` do produto **não** é snapshotado por item — drift retroativo possível |
| `receive_window_snapshot` é capturado | `store-orders.ts:392` | Bom |
| `expedition_lead_days_snapshot` é capturado | `store-orders.ts:393` | Bom — mas só o global, não o do produto |
| `sale_lead_days` **não** é snapshotado | (ausente em `store_orders`) | Ajuste global retroage no `saleDate` exibido |
