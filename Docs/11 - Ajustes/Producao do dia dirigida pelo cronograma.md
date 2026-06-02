---
título: Produção do dia dirigida pelo cronograma
status: implementado (3 fases) — aguardando validação visual + commit
data: 2026-06-02
autor: gestão + Claude Code
---

# Produção do dia dirigida pelo cronograma

## Problema / objetivo
Hoje a produção é **reativa ao pedido**: sem pedido de loja não existe Ordem de Produção (OP). O gestor quer o contrário — a **produção do dia já montada automaticamente pelo cronograma**: se o produto B é produzido na quarta na linha X (conforme o cronograma que a própria fábrica define), o slot de B na quarta **já deve existir**, mesmo sem pedido. O pedido só **soma quantidade** nesse slot. Slot sem pedido = existe com quantidade 0.

## Decisões travadas (gestão)
1. **Quantidade = soma dos pedidos.** Sem previsão/meta/estoque-alvo. Slot sem pedido fica com qtd 0.
2. **Cronograma é definido pela fábrica** em `gestor-fabrica/sublinhas-producao` ("Auditoria dos cronogramas"): arrasta produto entre dias, ajusta prioridade, aprova revisão (`pendente → ativo`). Vale a **revisão ativa**.
3. **Lead (D+N) é parâmetro do gestor**, não fixo. Vem de `OperationalSettings.expeditionLeadDays` (editável em `/api/master-data/operational-settings`). Se mudar pra D+2, tudo recalcula. **Nunca hardcodar número.**
4. **Horizonte da grade** = segue a janela configurada (do dia âncora cobrindo o lead vigente + ciclo semanal), nunca um N fixo.
5. Slot "sem demanda" aparece **só pro gestor** (chão só vê o que produz de fato).
6. Mostrar o **mínimo do cronograma** (`minimum_production`) no slot como referência.

## Fatos de arquitetura (confirmados no código)
- **A OP não é tabela** — é recalculada a cada request a partir de `store_orders` + cronograma (migration `production_order_events` diz: *"NÃO criamos uma tabela production_orders"*). "OP nascer do cronograma" = mudar o **cálculo**, não criar entidade.
- `buildPlannedItems` itera `input.storeOrders` (engine.ts:559); quantidade = `orderItem.quantity * salesToKgFactor` (engine.ts:591).
- OPs agrupadas por `planningKey = productionDate|sectorId|lineId|scheduleId` (engine.ts:462); item persistido por chave canônica `productionItemKey = productionDate|lineId|productId` (engine.ts:451).
- **Todo o fluxo de chão/liberação/entrega é por `order_id`**; a OP operacional é remontada **só dos itens liberados** (`factory-workflow-logic.ts:148`).
- O engine lê **só o cronograma ativo**: `buildActiveScheduleByLine` filtra `status === "ativo"` (engine.ts:389) e expõe `scheduleByLineId`. Dia efetivo = interseção `getMatchingProductionDays(produto, cronograma)` (engine.ts:204-216).

## O desenho — duas camadas
**Camada A · Grade de planejamento (nova, dirigida pelo cronograma):**
Semeia "slots" de OP a partir do **cronograma ativo já carregado** (`scheduleByLineId`). Para cada linha → cada item do cronograma → cada dia de produção dele no horizonte → um slot com `totalKg = 0`, marcado `demandSource: "cronograma"`.
- Dia do slot usa a **mesma lógica de hoje** (`getMatchingProductionDays`), pra cair no mesmo dia em que um pedido daquele produto cairia.
- `scheduleId`/`productionItemKey` do slot **idênticos** aos dos itens reais → dobra de pedido no slot certo, **sem duplicar**, e **sem orfanar estado** (neutraliza AJ-0025).

**Dobra dos pedidos:** itens de pedido resolvem `productionDate` como hoje (regressivo a partir da entrega). Misturam-se aos slots; o agrupamento por `planningKey` + dedup por `productId` soma a quantidade no slot (`0 + X = X`).

**Camada B · Chão / liberação / entrega (inalterada, por pedido):**
Só slots **com demanda real (qtd > 0) e pedido liberado** descem pro chão/expedição — exatamente como hoje.

## Blindagem do slot de qtd 0 (cronograma, sem pedido)
- ✅ aparece na produção do dia (visão do gestor);
- ❌ **não** desce pro chão, **não** é liberável (sem `orderId`), **não** entra em batida, **não** conta como produção/ocupação em métrica, **não** afeta a trava de entrega;
- marcado visualmente como "sem demanda / aguardando pedido"; mostra o mínimo do cronograma como referência.

## Onde mexe
- `src/lib/factory-planning/engine.ts` — `buildFactoryPlanningData`: gerar `buildScheduleSkeletonItems(scheduleByLineId, referenceDate, horizonte)` e concatenar com os itens de pedido antes de `buildProductionOrdersFromPlannedItems`. Flag `demandSource` no `PlannedOrderItem`/OP.
- `src/lib/factory-workflow-logic.ts` — garantir que o rebuild por itens liberados e o status do chão **ignoram** slots qtd 0/cronograma.
- `src/lib/supabase-data/factory-metrics.ts` — não contar slot qtd 0.
- UI `gestor-fabrica/ordens-producao` (e produção do dia): render do slot "sem demanda".
- **Migration: nenhuma** — tudo vem do cronograma ativo existente.

## Riscos e mitigação
| Risco | Mitigação |
|---|---|
| Release é por pedido; slot vazio não tem o que liberar | Slot vazio é planejamento-only; modelo de release **não muda**. |
| OP qtd 0 vira "item fantasma" no chão/métrica | Regra explícita: qtd 0/cronograma não desce pro chão nem conta em métrica. |
| Mudar derivação de chave órfã estado persistido (AJ-0025) | Itens com pedido mantêm derivação **idêntica**; esqueleto é **aditivo** e usa o mesmo `scheduleId`/chave. |
| Lead/horizonte hardcoded | Lê `OperationalSettings.expeditionLeadDays`; horizonte segue a config. |

## Fases de implementação
1. **Engine** — `buildScheduleSkeletonItems` + dobra + flag `demandSource`. Testes: dia sem pedido mostra slot 0; pedido soma no slot certo; item real preserva chave/estado; lead lido da config.
2. **Blindagem** — excluir qtd 0/cronograma do rebuild liberado, métricas, elegibilidade de release, trava de entrega. Testes.
3. **UI** — render do slot "sem demanda" (qtd 0 + mínimo de referência), só pro gestor.

Cada fase: `tsc` + `npm test` + revisão antes de seguir.
