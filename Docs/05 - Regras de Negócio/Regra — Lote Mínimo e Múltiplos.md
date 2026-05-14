# Lote mínimo, múltiplos e disponibilidade de produto

## Lote mínimo (`minimumProductionKg`)

Campo do produto (`products.minimum_production_kg`, `production-planning.ts:148`). Sempre em **kg internos**.

### Como é checado

`getMinimumProductionAlert` (`src/app/loja/pedidos/page.tsx:118-140`):

```ts
const thisStoreKg = Number((quantity * product.salesToKgFactor).toFixed(3));
const consolidatedKg = (aggregatedKgAllStores ?? 0) + thisStoreKg;

if (consolidatedKg >= product.minimumProductionKg) {
  return null;
}
...
return `Abaixo do mínimo produtivo: ${formatKgLabel(thisStoreKg)} informados para mínimo de ${formatKgLabel(product.minimumProductionKg)}${consolidatedNote}.`;
```

> ⚠️ Implícito: a regra é **soft warning, não bloqueio**. O alerta é mostrado, e antes de enviar o pedido o sistema pede um `window.confirm` listando os produtos abaixo do mínimo (`src/app/loja/pedidos/page.tsx:633-639`):
> ```
> "Os seguintes itens estão abaixo do lote mínimo de produção:
> ...
> A fábrica pode não produzir itens abaixo do mínimo. Deseja continuar mesmo assim?"
> ```
> Se o usuário confirmar, o pedido entra. Não há validação server-side para esse mínimo — `validateStoreOrderItems` (`store-orders.ts:188-221`) não confere lote mínimo.

### Consolidação entre lojas

A loja consulta `/api/store-orders/aggregated-quantities?deliveryDate=...` (`page.tsx:257`) e soma com o que ela própria está pedindo. Lojas que pedem o mesmo produto para a mesma `deliveryDate` se somam para atingir o mínimo.

> ⚠️ Frágil: a soma é "best effort" no front. Se duas lojas atingirem o mínimo simultaneamente (race), cada uma vê o alerta acionado/desativado em momentos diferentes — não há lock pessimista, é só uma busca HTTP.

## Múltiplos (arredondamento)

Não existe campo "múltiplo de lote". Mas existe **arredondamento por tipo de unidade**.

`roundQuantityForUnit` (`src/lib/factory-planning/units.ts:58-66`):

```ts
export function roundQuantityForUnit(value: number, unit: UnitCode): number {
  if (!Number.isFinite(value)) return 0;
  if (isDiscreteUnit(unit)) return Math.ceil(value);  // ← sempre arredonda PRA CIMA
  return round2(value);
}
```

Unidades discretas (`units.ts:26-42`): `Un, Dz, Forma, Travessa, Pacote, Caixa, Bandeja, Saco, Carrinho, Assadeira, Tela`.
Unidades contínuas: `Kg, g, L, ml`.

### Onde é aplicado

No motor (`engine.ts:541-548`):

```ts
const internalKg = round2(orderItem.quantity * salesFactor);
const expeditionQuantityRaw =
  product.expeditionUnit === "Kg" ? internalKg : round2(internalKg / expeditionFactor);
const expeditionQuantity =
  product.expeditionUnit === "Kg"
    ? round2(internalKg)
    : roundQuantityForUnit(expeditionQuantityRaw, product.expeditionUnit);
```

> ⚠️ Implícito: a `expeditionQuantity` em unidade discreta sempre **arredonda PRA CIMA** (`Math.ceil`). Pedindo 10 pães que somam 1.1 caixas de expedição, o sistema embarca 2 caixas. Já o `expeditionQuantityRaw` mantém o valor fracionado, e ambos coexistem no `PlannedOrderItem` (`types.ts:73-74`). Isso pode causar "pedi 10, recebi 20" se a fábrica seguir cegamente a `expeditionQuantity`.

### Front (loja)

Quantidade discreta é tratada como inteiro (`src/app/loja/pedidos/page.tsx:570-573`):
```ts
const sanitizedValue =
  product.unitKind === "discrete"
    ? Math.max(0, Math.round(numericValue))
    : Number(numericValue.toFixed(3));
```
E na validação do pedido (`src/lib/supabase-data/store-orders.ts:216-218`):
```ts
if (isDiscreteUnit(catalogEntry.unit) && !Number.isInteger(item.quantity)) {
  throw new Error(`Discrete units only accept whole numbers: ${product.code}`);
}
```

## Disponibilidade de produto (`available_for_ordering` + dia + cronograma)

A disponibilidade é um **AND** de várias condições (`src/lib/store-order-catalog.ts:75-145`):

| Condição | Onde | Falha → |
|---|---|---|
| `product.active` | `store-order-catalog.ts:76` | não aparece no catálogo |
| `product.availableForOrdering` | `store-order-catalog.ts:76` | não aparece no catálogo |
| `product.operationalLineId` existe | `store-order-catalog.ts:76` | não aparece (fora da carteira operacional) |
| `line.status === "ativo"` | `store-order-catalog.ts:81` | não aparece |
| `sector.status === "ativo"` | `store-order-catalog.ts:86` | não aparece |
| `schedule` ativo na linha existe | `store-order-catalog.ts:90` | aparece bloqueado: "Linha de produção sem cronograma ativo." |
| produto está em `schedule.items` | `engine.ts:524` → `engine.ts:219-231` | aparece bloqueado: "Produto fora da linha de produção ativa." |
| intersecção `product.productionDays ∩ scheduleItem.productionDays` ≠ ∅ | `engine.ts:233-250` | bloqueado: "Dias da ficha do produto não coincidem com a linha de produção ativa." |
| existe dia de produção que entrega na data | `engine.ts:328-363` | bloqueado: "Sem data de produção compatível..." |
| produção não cai depois da entrega | `engine.ts:275-287` | bloqueado: "Produção em X + N dia(s) cai após a entrega prevista." |

> ⚠️ Frágil: a checagem usa **somente `operational_subcategory_id`** para resolver linha (`engine.ts:519`). Produtos cadastrados em uma linha mestre mas sem `operational_subcategory_id` desaparecem do catálogo sem mensagem clara. Em `store-order-catalog.ts:76` o filtro é silencioso (`return;`).

## Disponibilidade por dia da semana

Dois campos diferentes governam:
- `product.productionDays` — dias que o produto **pode** ser produzido (ficha do produto).
- `scheduleItem.productionDays` — dias que a fábrica vai produzi-lo neste ciclo.

A intersecção dá os `matchingDays` (`engine.ts:192-204`). A busca regressiva de `productionDate` percorre só esses dias.

> ⚠️ Implícito: se o gestor editar `productionDays` do produto, o cronograma **não atualiza automaticamente** — o `scheduleItem.productionDays` é um snapshot. É preciso rodar `rebuildPendingScheduleRevisionForSubcategoryDbId` (que `updateProduct` chama só se mudou `operational_subcategory_id`, não se mudou `productionDays`). Ver `23-drift.md`.

## Disponibilidade por loja

Loja tem `orderingDays`, `receivingDays`, `orderingBlockedDays`, `receivingBlockedDays` (`production-planning.ts:104-107`).

`getEnabledOrderingDays` (`production-planning.ts:1311`) e `getEnabledReceivingDays` (`production-planning.ts:1320`) calculam `dias - bloqueados`.

> ⚠️ Frágil: se `orderingDays - orderingBlockedDays = ∅`, `moveToNextAllowedWeekday` (`engine.ts:131-145`) retorna o `dateKey` original sem aviso. O pedido vai entrar com `baseDate = orderedAt`, podendo virar um dia que a loja "não opera" — o engine aceita.

## Disponibilidade por período

Não existe campo de "produto válido só nesta janela" — `validityDays` no produto (`production-planning.ts:147`) é validade pós-produção (shelf life), não janela de venda.

> ⚠️ Implícito: produtos sazonais não têm controle nativo — depende de `availableForOrdering` ser ligado/desligado manualmente.
