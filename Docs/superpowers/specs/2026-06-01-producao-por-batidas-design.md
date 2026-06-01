# Produção por batidas — Design

**Data:** 2026-06-01
**Branch:** `feat/producao-por-batidas`
**Status:** Aprovado (brainstorming) — pendente plano de implementação

## Problema

Uma linha de produção tem capacidade limitada por corrida ("batida"). Ex.: a
linha que faz coxinha só aguenta ~100 coxinhas por batida. Se há 456 coxinhas a
produzir, o sistema precisa **calcular** quantas batidas são necessárias e
**gerir a execução uma de cada vez** no chão de fábrica.

Hoje não existe nenhum conceito de capacidade por batida: a linha só tem
`capacityPerDayKg` (diária, informativa) e a OP consolida toda a demanda num
único bloco de `totalKg`, sem fatiar.

## Requisitos (decididos no brainstorming)

1. **Capacidade por produto** — cada produto define sua capacidade por batida
   (o produto já pertence a uma linha via `lineId`).
2. **Na unidade de venda do produto** — coxinha em `un` (100/batida), produto a
   granel em `kg`. Internamente convertido para kg via `salesToKgFactor`.
3. **Calcular + rastrear uma a uma** — o sistema calcula as batidas E o chão
   marca cada batida concluída sequencialmente. O board do chão é somente
   leitura, então o controle interativo fica fora dele.
4. **Encher + sobra na última** — 456 un, capacidade 100 → 4×100 + 1×56 = 5
   batidas.
5. **Controle na pré-pesagem / impressão** — o operário, que já vai à
   pré-pesagem pesar os ingredientes de cada batida, marca "batida concluída"
   ali, uma de cada vez.

## Abordagem escolhida

**A — Plano de batidas derivado + contador de conclusão.** O plano (quantas
batidas, tamanho de cada) é **calculado** a partir de `totalKg` + capacidade
(não armazenado). O rastreamento é um **contador de batidas concluídas** por
produto. Estado mínimo, lida bem com mudança de demanda, não regride a máquina
de status atual. (Alternativa B — batidas materializadas com status por linha —
descartada por peso e dor de sincronização quando a demanda muda.)

## Design

### 1. Modelo de dados

- **Produto** (`products` + `ProductionProduct` em `production-planning.ts`):
  novo campo opcional **`capacity_per_batch`** (`numeric`, na unidade de venda).
  `null`/`0` → produto sem batida (1 corrida só, comportamento atual). Exige
  migration + suporte no cadastro de produto (`product-form-dialog`).
- **Rastreamento** (tabela nova **`workflow_production_batches`**, espelhando
  `workflow_production_starts`): multi-tenant, RLS de escopo de fábrica, keyed
  por `production_item_key` canônica (`date|line|product`), guardando
  **`batches_done`** (inteiro ≥ 0). Sequencial → um contador basta.

### 2. Cálculo do plano de batidas

Helper puro e testável (ex.: `src/lib/production-batches.ts`). Dado `totalKg` do
item e `capacityPerBatch` do produto (na unidade de venda) + `salesToKgFactor`:

```
se capacityPerBatch ausente/0:
  → { batchCount: 1, sizes: [totalUn], unitLabel } (sem fatiar)

capacidadeUn = capacityPerBatch
totalUn      = round(totalKg / salesToKgFactor)
batchCount   = ceil(totalUn / capacidadeUn)
sizes        = [capacidadeUn, capacidadeUn, ..., resto]  // enche + sobra na última
```

Retorna `{ batchCount, sizes (em unidade de venda), sizesKg, unitLabel }`.
Produto vendido em kg (`salesToKgFactor = 1`) cai no mesmo cálculo com a
capacidade já em kg.

### 3. Motor / tipos

- `ProductionOrderItem` (em `factory-planning/types.ts`) ganha o **plano
  derivado**: `batchCount`, `batchSizes` (unidade de venda), `batchUnitLabel`.
  Calculado no `engine.ts` ao montar o item (a partir de `totalKg` +
  `capacityPerBatch` do produto). **Não armazenado.**
- O **contador** `batchesDone` vem do workflow state (igual ao
  `productionStarted`): lido em `getPersistedWorkflowState`, aplicado em
  `applyFactoryWorkflowState`, agregado no item.

### 4. Status ↔ batidas (integra com as 4 colunas do board)

Para produto **batido**, o progresso das batidas dirige a coluna do board:

| `batchesDone` | Status efetivo do item | Coluna do chão |
|---|---|---|
| `0` | `nao_iniciado` | Não iniciado |
| `0 < done < N` | `em_producao` | Produção |
| `done = N` | `concluido` | Expedição |

Para produto batido, esse status efetivo é **derivado de `batchesDone`** em
`applyFactoryWorkflowState` (não há escrita separada em
`workflow_production_items`): a fonte da verdade é o contador de batidas. Assim,
concluir a última batida (`done = N`) faz o item resolver para `concluido`
automaticamente, mantendo board e expedição funcionando sem duplicar estado.

Produto batido pula "Em preparação". Produto **sem batida** continua governado
pelo fluxo de etapas atual via `workflow_production_items`
(`nao_iniciado → em_preparacao → … → concluido`), sem nenhuma mudança.

### 5. Backend

- `completeProductionBatch(productionItemKey)` — incrementa `batches_done` com
  teto = `batchCount` (idempotente; sem efeito se já no máximo).
- `undoProductionBatch(productionItemKey)` — decrementa (piso 0), para corrigir
  engano.
- Novas actions na rota `/api/factory-planning/workflow`:
  `complete-production-batch` e `undo-production-batch`, permissão
  `chao-fabrica.ops` (quem opera a pré-pesagem). Invalida cache de planning.

### 6. UI

- **Pré-pesagem** (`src/app/impressao/pre-pesagem/[opId]`): para cada produto
  batido, mostra **"Batida X de N"**, a quantidade da batida atual e botão
  **"Concluir batida"** (uma de cada vez). A receita é escalada pela quantidade
  da **batida atual**, não pelo total do item.
- **Board do chão** (`src/app/chao-fabrica/page.tsx`, read-only): badge
  compacto por produto batido no card — ex.: **"Coxinha · batida 3/5"**.
- **Detalhe da OP** (`ordens-producao`): exibe o plano de batidas + progresso,
  **sem ação** (o controle é na pré-pesagem, conforme requisito 5).

### 7. Bordas & testes

- Produto sem `capacity_per_batch` → 1 batida; comportamento atual intacto.
- Demanda muda entre acessos → plano recalculado; se `batchesDone > N` novo,
  trata como concluído (clamp ao novo `batchCount`).
- Produto vendido em kg → capacidade em kg, mesma matemática.
- **Testes unitários:** helper de cálculo (exato, com sobra, 1 batida só, kg,
  capacidade ausente) e mapeamento status↔batidas (0 / parcial / completo).
- Não regredir os 207 testes atuais nem o fluxo `productionStarted` recém-feito.

## Fora de escopo (YAGNI)

- Etapas (preparação/forno) por batida individual — batido usa o progresso de
  batidas como unidade. Pode evoluir para a Abordagem B depois, se preciso.
- Capacidade por linha+produto (mesmo produto em linhas diferentes com
  capacidades distintas) — fica por produto por ora.
- Histórico/auditoria por batida individual.

## Arquivos previstos

- Migration: `supabase/migrations/<ts>_workflow_production_batches.sql` (+ coluna
  `capacity_per_batch` em `products`).
- `src/lib/production-planning.ts` — `capacityPerBatch` em `ProductionProduct`.
- `src/lib/production-batches.ts` (novo) — helper de cálculo + testes.
- `src/lib/factory-planning/types.ts` — plano derivado + `batchesDone` no item.
- `src/lib/factory-planning/engine.ts` — calcular plano ao montar o item.
- `src/lib/factory-workflow-logic.ts` — aplicar `batchesDone` + status efetivo.
- `src/lib/supabase-data/workflow.ts` — ler batches + `completeProductionBatch` /
  `undoProductionBatch`.
- `src/lib/supabase-data/planning-snapshot.ts` — prover contador de batidas.
- `src/app/api/factory-planning/workflow/route.ts` — novas actions.
- `src/app/impressao/pre-pesagem/[opId]/page.tsx` — controle batida a batida.
- `src/app/chao-fabrica/page.tsx` — badge de batida no card.
- `src/app/.../ordens-producao/...` — plano de batidas no detalhe.
- `src/components/production/product-form-dialog.tsx` — campo de capacidade no
  cadastro.
