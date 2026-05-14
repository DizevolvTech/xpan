# Motor de Cronograma — visão geral

Diretório: `src/lib/factory-planning/`
- `engine.ts` — algoritmo principal puro (sem I/O)
- `types.ts` — contratos
- `units.ts` — arredondamentos de unidades (discretas/contínuas)
- `engine.test.ts` — cenários de aceitação (cliente Daniel Augusto)
- `index.ts` — apenas reexporta os três

> Alias paralelo: `src/lib/order-planning.ts:1` faz `export * from "@/lib/factory-planning"`. Os dois caminhos coexistem no código — qualquer mudança no `engine.ts` precisa lembrar que callers entram por `@/lib/order-planning` e por `@/lib/factory-planning`.

## Contrato (entrada/saída)

`buildFactoryPlanningData(referenceDate, FactoryPlanningInput): FactoryPlanningData`
(`src/lib/factory-planning/engine.ts:944`)

Input (`FactoryPlanningInput`, `engine.ts:33`):
- `stores`, `storeOrders`, `settings` (operacional), `sectors`, `lines`, `products`, `schedules`.

Output (`FactoryPlanningData`, `types.ts:220`):
- `orders` (linha por pedido), `orderItems` (linha por item), `productionOrders` (OPs agregadas), `expedition`, `expeditionItems`, `productionDates`, `deliveryDates`.

## Pipeline interno (sequência)

1. `resolvePlanningSource` (`engine.ts:386`) — indexa sectors/lines/products por id.
2. `buildActiveScheduleByLine` (`engine.ts:369`) — pega o cronograma ATIVO mais recente por linha (defensivo contra duplicidade, ordena por `createdAt` desc).
   > Implícito: se duas revisões "ativo" coexistirem por race condition, o motor escolhe a mais nova silenciosamente — não há aviso.
3. `buildPlannedItems` (`engine.ts:501`) — para cada item de pedido:
   - resolve produto → linha → setor → cronograma → `scheduleItem`
   - chama `resolveScheduledProductAvailability` (cálculo de D+X, ver `21-regra-d2-d3.md`)
   - calcula `internalKg`, `expeditionQuantity` (com arredondamento por tipo de unidade)
   - calcula `canPlan` = produto está na linha + cronograma + tem data de produção válida
   - calcula `saleDate = deliveryDate + normalizeSaleLeadDays(settings.saleLeadDays)`
   - status inicial vindo de `getPotentialItemStatus` (`engine.ts:396`)
4. `buildProductionOrdersFromPlannedItems` (`engine.ts:611`) — agrega itens em OPs por `planningKey = productionDate|sectorId|lineId|scheduleId`.
   - código `OP-YYMMDD-NNN` (`engine.ts:736`)
   - status agregado: progresso 100 → `aguardando_expedicao`; >0 → `em_producao`; ≥ referência → `agendado`; senão → `em_espera`.
5. `buildOrders` (`engine.ts:806`) — agrega `PlannedOrderItem` por pedido. `dPlusLabel` vem direto de `settings.expeditionLeadDays` (`engine.ts:832`).
6. `buildExpeditionRows`/`buildExpeditionItems` — apenas remapeia.

## Chaves de identidade (joins implícitos)

- `productionItemKey` = `productionDate|lineId|scheduleId|productId` (`engine.ts:406`). Usado para persistir status (`workflow_production_items.production_item_key`).
- `planningKey` = `productionDate|sectorId|lineId|scheduleId` (`engine.ts:413`). Usado para agregar OPs.

> Frágil: se o motor mudar a forma da chave (ordem ou separador), todos os status persistidos em `workflow_production_items` se desconectam silenciosamente. Não há migration de re-chaveamento.

## Callers do motor

| Caller | Arquivo:linha | O que faz |
|---|---|---|
| `getFactoryPlanningSnapshot` | `src/lib/supabase-data/planning-snapshot.ts:43` | Lê DB → roda motor → aplica workflow state (release/cancel/status). Cache de 10s. |
| `appendOrderEventsForProductionItem` | `src/lib/supabase-data/workflow.ts:85` | Reconstrói o planejamento para descobrir quais pedidos compartilham um `productionItemKey` e gerar eventos. |
| `buildStoreOrderCatalog` | `src/lib/store-order-catalog.ts:95-108` | Usa `getOperationalOrderWindow`, `resolveScheduledProductAvailability`, `getOperationalTimeline` para catálogo da loja. |
| `getOperationalOrderWindow` (validação) | `src/lib/supabase-data/store-orders.ts:166` | Valida janela na criação do pedido. |
| `getDeliveryDateByStoreRule` (UI loja) | `src/app/loja/pedidos/page.tsx:236` | Mostra data de recebimento estimada na tela de novo pedido. |

> Implícito: o motor é puro mas as datas ainda vivem em `new Date(...)` sem timezone explícito (`fromDateKey` em `engine.ts:77` usa `T00:00:00` local). Em servidor UTC vs cliente BRT, o mesmo `referenceDate` pode produzir resultados sutilmente diferentes.

## Estados/máquina

- **PlannedOrderItem.status** (`OrderStatus`, `types.ts:4`): `em_espera | agendado | em_producao | aguardando_expedicao | cancelado | rota_entrega`.
- **PlannedOrderItem.productionItemStatus** (`ProductionItemStatus`, `types.ts:11`): `nao_iniciado | em_preparacao | em_producao | em_forno | embalando | concluido`.
- Promoção é feita fora do motor por `applyFactoryWorkflowState` (`src/lib/factory-workflow-logic.ts`) usando o output do motor + estado persistido.

## Funções auxiliares importantes

| Função | Linha | Responsabilidade |
|---|---|---|
| `getBaseDateByCutoff` | `engine.ts:114` | Avança 1 dia se pedido foi após `orderCutoffTime`. |
| `moveToNextAllowedWeekday` | `engine.ts:131` | Pula até dia operacional permitido (loop de 7 dias). |
| `getOperationalOrderWindow` | `engine.ts:165` | `{ baseDate, deliveryDate }`. |
| `resolveProductionDateInWindow` | `engine.ts:328` | Busca regressiva de dia de produção válido; fallback delayed +14d. |
| `resolveScheduledProductAvailability` | `engine.ts:206` | Determina se um produto entra no pedido (com 4 razões de bloqueio distintas). |
| `normalizeSaleLeadDays` | `engine.ts:188` | Força `saleLeadDays >= 1` (`Number(x) > 0 ? x : 1`) — **se vier 0 vira 1 silenciosamente**. |
| `sanitizeFactor` | `engine.ts:365` | Força fator > 0 (senão 1). |
