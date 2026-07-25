# Ajustes da call com o cliente — 24/07/2026

**Origem:** call Xpan de 24/07/2026 (Daniel Abreu, Adriano Santos, Leonora Renck, Giuseppe).
**Contexto de prazo:** Daniel testa e implanta nas semanas de 27–31/07 e 10–14/08; start no cliente
de São Paulo em 17/08. A prioridade declarada pelo Adriano é **"pedido e OP funcionando"**.

## Escopo

Seis itens. Fora de escopo (V2, decidido na própria call): OP sem pedido / produção para estoque,
impressora térmica, gráfico de consumo, API de pedido, opção "ignorar/cancelar" no gargalo do Kanban.

Também **não** é pendência o Kanban com status fracionado dentro da OP: a regra do gargalo (o item
mais atrasado segura a coluna) já é o comportamento vigente e foi aprovada ao vivo na call.

---

## 1 · Cronograma — item aparecendo no dia errado

### Relato
Daniel (44:40): *"o item que está sendo pedido hoje não deveria ser hoje, deveria ser amanhã, e
vice-versa"*. Cenário: loja com D+2, produto com produção só num dia da semana.

### Causa raiz
O plano semanal de lotes deriva a data de entrega do slot aplicando o **lead global** sobre uma data
de **produção** (`store-order-weekly-release-plan.ts:152` → `getDeliveryDateByStoreRule`, que é
`base + settings.expeditionLeadDays`, `engine.ts:167-174`).

Mas o catálogo ancorado — o caminho principal desde que `FACTORY_OPENS_ORDERS` virou default ON —
aceita o produto apenas quando `produção + gap DO PRODUTO === entrega`
(`resolveProductionDateInWindow`, `engine.ts:378-413`).

Deslocamento resultante = `lead global − gap do produto`. Simulado com o motor real (lead 2, gap 1):
a produção de terça vira slot de entrega de quinta; ao preencher esse slot, o produto de terça é
**bloqueado** e o de quarta aparece. É literalmente o relato.

### Segunda fonte: fuso horário
`getBaseDateByCutoff` (`engine.ts:134-149`) usa `new Date(orderedAt).getHours()` no fuso **do
processo**. O servidor roda em UTC (nenhum `TZ` em `vercel.json`/`next.config.ts`) e `orderedAt` vem
do browser em UTC. Provado: o mesmo instante (segunda 16:00 BRT) resolve produção 27/07 com TZ local
e 03/08 com TZ=UTC. Além disso, dezenas de `new Date().toISOString().slice(0,10)` usam "hoje" em UTC
enquanto `workflow-date-guard.ts:38-42` usa corretamente `America/Sao_Paulo` — duas definições de
"hoje" convivem.

### Decisão
1. **O slot deixa de ser derivado de uma data de produção.** Passa a ser ancorado nos dias de
   recebimento da loja dentro do horizonte; o catálogo resolve, por produto, o que é alcançável
   naquela entrega. Elimina o descasamento em vez de remendá-lo.
2. **Fuso fixado em `America/Sao_Paulo`** no cálculo de corte e nos "hoje" dos caminhos de
   planejamento, via helper único.

### Riscos aceitos
- O fix de fuso **muda o corte efetivo para todos os tenants** (hoje 18:00 se comporta como 15:00
  BRT). Vai no changelog e precisa de aviso.
- ~10 testes fixam o comportamento atual (`engine.test.ts:267-345,382-408,689-800`,
  `store-order-catalog.test.ts:130-177`) e serão re-baselinados junto com
  `Docs/05 - Regras de Negócio/Regra — Lead Days.md`.
- **Não tocar em `planningKey`/`productionItemKey`** — mudar a data de produção orfana OP liberada e
  zera status persistido (gotcha conhecido do repo).
- Não re-escopar o catálogo pela janela D+X: recria a regressão F1 documentada em `ec17c9e`.

### Verificação obrigatória antes de mexer
A direção acima vem da leitura do código; o **bug** foi simulado, a **correção** não. A primeira
tarefa é escrever o teste que cruza *slot do lote × catálogo* (buraco de cobertura confirmado em
`store-order-weekly-release-plan.test.ts`) e provar o fix. Se o modelo ancorado em dia de recebimento
não fechar, reabrir a decisão antes de seguir.

---

## 2 · Snapshot de receita na liberação

### Estado
Parcialmente resolvido. O sintoma principal da call está fechado no caminho feliz: edição só de
receita não reconstrói a revisão do cronograma (`master-data-admin.ts:1429-1434`), então `planningKey`
e `canPlan` não mudam. As bordas continuam abertas.

### Lacunas confirmadas (banco de produção `daniel_augusto`)
- **16 pedidos liberados, apenas 2 com snapshot.** Não existe migration de backfill; os outros 14
  seguem expandindo a receita **ao vivo**, e não há caminho de re-liberar (o botão some após liberado
  e `updateStoreOrder` bloqueia pedido liberado).
- `release-recipe-snapshot.ts:60` retorna cedo quando o produto tem receita vazia → "sem linha" é
  indistinguível de "receita vazia" e cai no fallback vivo (`frozenRecipe ?? liveProduct.recipe`).
- O congelamento cobre **só a expansão MPI**. Pré-pesagem e folha de produção
  (`printing-documents.ts:171`) imprimem a receita nova para OP já liberada — a OP diz "massa antiga"
  e a folha lista "massa nova".

### Decisão
1. Migration de **backfill** congelando a receita **atual** dos pedidos liberados sem snapshot.
   É aproximação — não é a receita do momento da liberação — e está registrada como tal.
2. Distinguir "produto sem linha no snapshot" de "receita vazia", eliminando o fallback silencioso.
3. Pré-pesagem e folha de produção passam a ler a receita congelada quando a OP vem de pedido
   liberado.

---

## 3 · Etapa/função do ingrediente na receita

### Relato
Adriano (22:44, 26:07): cada ingrediente precisa dizer **qual a função dele** no produto, e o **mesmo
ingrediente pode entrar duas vezes com pesos diferentes** — farinha na esponja + farinha complementar
na massa; chantilly no recheio + chantilly na cobertura. O padeiro precisa ver quanto vai em cada
etapa, não só o total. Ele foi categórico: *"senão não dá nem para usar essa primeira etapa"*.

### Estado real (menor do que parecia)
Ingrediente repetido 2× na mesma receita **já funciona**: o banco não tem unique além da pkey e do
parcial de `is_main`; a UI não bloqueia; e as duas impressões já emitem duas linhas com pesos
separados (`buildScaledRecipeRowsForProduct` mapeia 1:1 com `product.recipe`). Já existe dado real
assim (`PR-28739` com "Agua molhada" 2×). **Falta o campo de etapa e o agrupamento visual.**

### Decisão
Coluna `stage` em `product_recipe_items`, enum com ordem canônica:

| valor | rótulo |
|---|---|
| `esponja` | Esponja / Pré-fermento |
| `massa` | Massa |
| `recheio` | Recheio |
| `cobertura` | Cobertura |
| `acabamento` | Decoração / Acabamento |
| `montagem` | Montagem |

Default `massa` para as linhas existentes. **Sem coluna de ordem separada** — o enum já define a
ordem, e o `sort_order` atual ordena dentro da etapa.

Três consequências decididas:
- **Pré-pesagem:** a chave de agregação de MPI passa de `sourceProduct.id` para
  `(sourceProduct.id, stage)` (`printing-documents.ts:294-313`). Chantilly no recheio e na cobertura
  viram duas seções com pesos próprios em vez de uma soma. Como tudo nasce em `massa`, nada muda até
  alguém preencher etapas.
- **Folha de produção:** agrupa por etapa. A heurística por palavra-chave `isAdditionalIngredient`
  (`printing-documents.ts:116-154`) continua valendo **apenas** para produto que ainda não tem etapa
  preenchida — a folha de quem não migrou sai idêntica.
- **`is_main` × ingrediente em duas etapas:** o índice único de 1-principal-por-produto **fica**.
  Mas `deriveCapacityFromProductRecipe` (`production-batches.ts:146`) passa a **somar todas as linhas
  do mesmo ingrediente principal**, senão a capacidade por batida sai subestimada (conta só a farinha
  de uma etapa).

**O motor não é tocado.** Etapa é atributo de pesagem/exibição; a OP continua agregando por produto
(`engine.ts:910`). Separar por etapa ali mexeria em `planningKey` e quebraria progresso e batidas já
persistidos.

### Dívidas adjacentes que entram junto
- `addRecipeItem` usa `id: recipe-${Date.now()}` (`product-form-dialog.tsx:483`): dois cliques no
  mesmo milissegundo geram ids iguais e editar uma linha edita as duas. Com duplicata agora
  incentivada, o risco cresce → `crypto.randomUUID()`.
- O clone de produto (`master-data-admin.ts:1534-1546`) enumera colunas na mão e **hoje já perde
  `observation`**; precisa incluir `stage` e recuperar `observation`.
- Drift conhecido: a coluna `observation` existe no banco mas não tem migration no repo. A migration
  nova precisa conviver com isso.

---

## 4 · Sobras e desvios — registro interno + falta real

### Relato
Adriano (38:27), enfático: *"não dá; o pedido foi feito, se foi entregue ou não, morreu; não tenho
como levar de volta para vender lá atrás"*. A ocorrência tem de ser **só registro interno**, nunca
compensar pedido futuro.

### Achado: a compensação não existe
Rastreado nos três caminhos possíveis:
- `production_leftovers` tem exatamente dois consumidores: o write em `workflow.ts:239` e o read do
  relatório em `production-leftovers.ts:126`. Nenhum leitor no planejamento.
- `FactoryPlanningInput` (`engine.ts:36-58`) não recebe sobra nem ocorrência — não há canal físico
  para isso entrar no plano. `grep -rn "leftover|occurrence"` em `src/lib/factory-planning/` = zero.
- `store_occurrences` só escreve em si mesma e nos eventos; `store_order_items` é apenas lido.

Não existe sequer ação de "aprovar" sobra: `/gestor-fabrica/sobras` é 100% leitura e a copy já diz
*"Apenas observação — não altera pedidos ou planejamento futuros"*.

**O que sustenta a crença do cliente é texto:** a migration abre com *"Registro de sobras e ajustes
para futuros pedidos"* (`20260602130000_production_leftovers.sql:1`) e `workflow.ts:224` fala em
*"insumo para ajustes em pedidos futuros"*, contradizendo o comentário 16 linhas acima. A demo ao
vivo na call descreveu o comportamento dessa forma.

### O gap real embaixo
`produzido` é **estimado**, não medido: `batchSizes[0] × nº batidas` contra
`planejado = soma(batchSizes)` (`workflow.ts:230-238`). Logo `leftover >= 0` sempre e o KPI "Total de
faltas" (`sobras/page.tsx:252-257`) nunca sai de zero. Não existe campo de quantidade
produzida/conferida em lugar nenhum (`grep received_quantity|delivered_quantity` = 0 hits).

O caso concreto do Adriano (40:33) — *"a OP dizia 100 pães, saíram 98 porque pesaram a massa crua
errado"* — **não tem onde ser registrado hoje**.

### Decisão
1. Corrigir a copy nos três pontos que sustentam a crença de compensação: cabeçalho da migration,
   comentário em `workflow.ts:224`, label/descrição da tela.
2. No fechamento do item no chão, o operador informa a **quantidade efetivamente produzida**
   (pré-preenchida com a estimativa atual). `leftover = produzido − planejado` passa a poder ser
   negativo e o KPI de faltas passa a funcionar.

---

## 5 · Trava do pedido depois de liberado

### Relato
Daniel (50:53): a loja conseguia voltar e zerar item de pedido já em produção.

### Estado
**O servidor já bloqueia.** `ensureOrderIsMutable` é a primeira linha de `updateStoreOrder`
(`store-orders.ts:829`) e rejeita pedido cancelado ou com row em `workflow_order_releases`
(`store-orders.ts:115-137`). `cancelOrder` tem o gate equivalente (`workflow.ts:942-954`). Confirmado
no banco: zero pedidos com evento de edição posterior ao `released_at`.

A brecha é de **afordância**: `loja/pedidos/page.tsx:782-799` registra "Editar pedido" para toda
linha, o dialog abre 100% editável, a loja zera os itens e só toma erro no submit — e o erro chega
como o texto cru em inglês *"Orders already released to production cannot be edited"*.

A tela de **detalhe** já respeita: a API devolve `canEdit`/`canCancel` via
`buildStoreOrderCapabilities` e a página esconde os botões.

### Decisão
`StoreOrderSummary` ganha `canEdit`/`releasedToProduction` (a GET já tem
`planning.orders[].releasedToProduction` em mãos), a ação some/desabilita na linha liberada, e a
mensagem vira português.

**Não trocar o gate de "liberado" para "produção iniciada"** — isso *afrouxaria* a regra e quebraria
dois invariantes: a receita é congelada no release e a OP já foi derivada do pedido liberado. Além
disso `workflow_production_starts` é hoje sinal órfão na prática (sem caller de UI).

⚠️ Ao traduzir a mensagem, adicionar a string nova em `isClientValidationError`
(`route.ts:28-39`), que casa por substring em `"cannot"` — senão a rejeição vira HTTP 500.

---

## 6 · Alerta de atraso na tela da loja

### Relato
Daniel (5:50): *"se o pedido para entregar no dia 26 já está atrasado, pode aparecer um alerta ali
para avisar"*.

### Estado
Não existe indicador de atraso por pedido em nenhuma tela. A única noção de "atrasado" é agregada e
server-only: o OTIF em `factory-metrics.ts:357-383`, inline dentro do loop, operando sobre linhas
cruas de `delivery_executions` e devolvendo só contagens.

Nenhum dado novo é necessário na loja: `deliveryDateKey` e `status` já chegam no `StoreOrderSummary`.

### Decisão
Função pura `isStoreOrderOverdue` em `store-order-window.ts`, badge na célula "Recebimento previsto"
e contador na fita de KPIs.

Detalhes que não são opcionais:
- Usar `getTodayDateKey()`, **não** o `anchorDate` — este vem do escopo operacional e o usuário pode
  escolher data passada/futura, o que faria o alerta aparecer e sumir errado ao filtrar.
- "Não entregue" exclui `entregue` **e** `cancelado`, mas **inclui** `tentativa_falha`. Não reusar
  `IN_PROGRESS_STORE_ORDER_STATUSES` cru, que exclui `tentativa_falha`.
- Cuidado com hidratação: `getTodayDateKey()` calculado durante render SSR pode divergir
  server × client perto da meia-noite.
- Falso positivo esperado em dado de demonstração: pedidos antigos nunca entregues vão exibir
  "Atrasado" em massa, já que a lista não filtra por data. Validar visualmente antes de commitar.

---

## Fora de escopo, registrado

| Item | Origem | Destino |
|---|---|---|
| OP sem pedido / produção para estoque de MPI | Adriano 17:00, Daniel 18:05 | V2 |
| Impressão térmica (sair do A4) | Adriano 53:29 | V2 |
| Gráfico de consumo de ingrediente por semana/mês | Daniel 37:00 | V2 |
| Lançamento de pedido via API | Adriano 57:00 | V2 |
| "Ignorar/cancelar" no gargalo do Kanban | Daniel 16:25 | V2 |
| Boletim de ocorrência interno desvinculado de pedido | Adriano 38:27 | V2 (hoje `order_id` é NOT NULL) |
