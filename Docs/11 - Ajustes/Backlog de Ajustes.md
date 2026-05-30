# Backlog de Ajustes

> Lista única, numerada, com status. Atualizar conforme cada ajuste é trabalhado.

**Última revisão:** 2026-05-21

---

## ✅ Iniciativa A1-A8 — automação do fluxo pedido → entrega (2026-05-21)

Frente coordenada após auditoria interna do fluxo. **8 frentes entregues +
2 desdobramentos.** Documentação consolidada em
[[decisoes/ADR_iniciativa_automacao_pedido_entrega]] · operação descrita em
[[Runbook A1-A8]].

### AJ-A1 — Validação server-side em `releaseOrder` com override forçável
**Concluído em:** 2026-05-21 (commits `d289a23` + `b6212bf`)
**Status:** ✅ Concluído · **Categoria:** Bug/UX
**Área:** `src/lib/supabase-data/release-validation.ts` · `src/lib/release-order-with-confirm.ts` · `workflow.ts`

`releaseOrder` agora valida via `assertPlanningAllowsRelease` (3 razões:
`order_cancelled`, `order_not_planned`, `order_not_releasable`). Override
via `force: true` grava evento `liberacao_forcada`. UI dialog "Liberar
mesmo assim" nas duas páginas de pedido.

### AJ-A2 — Card "Demanda por produto" derivado do engine
**Concluído em:** 2026-05-21 (commit `d289a23`)
**Status:** ✅ Concluído · **Categoria:** UX
**Área:** `src/app/gestor-fabrica/pedidos/page.tsx`

Agrega (data × produto) somando demanda de todas as lojas. Derivado do
snapshot do motor — incorpora expansão de MPI (A4) corretamente. Substituiu
a rota órfã `/api/store-orders/aggregated-quantities` (deletada).

### AJ-A3 — Tabela `delivery_attempts` para histórico de tentativas
**Concluído em:** 2026-05-21 (commits `d289a23` + `b6212bf`)
**Status:** ✅ Concluído · **Categoria:** Modelo/UX
**Área:** `supabase/migrations/20260521120000_delivery_attempts.sql` · `delivery-attempt-dialog.tsx`

Append-only com enum `delivery_failure_reason` (8 valores). Dialog
estruturado (motivo + observação + reagendamento) substitui caminho legado
de "só virar `tentativa_falha`". Bugfix de auditoria: mobile passou a usar
o dialog (estava bypassando).

### AJ-A4 — Fase 2 do MPI: linha/setor nativos
**Concluído em:** 2026-05-21 (commit `d289a23`)
**Status:** ✅ Concluído · **Categoria:** Motor
**Área:** `src/lib/factory-planning/recipe-expansion.ts`

MPI passa a rodar em `operationalLineId ?? lineId` quando o cadastro define.
`scheduleId` herdado do pai é descartado quando a linha muda. Fechou a
"Limitação conhecida" da fase 1 — ver [[decisoes/ADR_expansao_mpi_em_op#Fase 2 — concluída 2026-05-21]].

### AJ-A5 — Timeline de OPs (`production_order_events`)
**Concluído em:** 2026-05-21 (commit `d289a23`)
**Status:** ✅ Concluído · **Categoria:** Auditoria
**Área:** `supabase/migrations/20260521130000_production_order_events.sql` · `production-order-timeline.tsx`

Tabela append-only indexada por `planning_key` (não `opCode` — chave estável).
`updateProductionItemStatus` emite eventos automaticamente. Endpoint +
card "Histórico da OP" no detalhe da OP.

### AJ-A6 — Auto-release: helper + endpoint batch
**Concluído em:** 2026-05-21 (commit `d289a23`)
**Status:** ✅ Concluído · **Categoria:** Automação
**Área:** `src/lib/supabase-data/workflow.ts` · `src/app/api/factory-planning/auto-release/route.ts`

`autoReleaseEligibleOrders` libera todos os pedidos elegíveis em batelada.
Mantém a trava do A1 — bloqueados caem em `failed[]` sem interromper o batch.
Botão "Auto-liberar elegíveis" no gestor.

### AJ-A6.2 — Auto-release diário via Vercel Cron
**Concluído em:** 2026-05-21 (commit `c21fe77` + `b6212bf`)
**Status:** ✅ Concluído · **Categoria:** Automação
**Área:** `vercel.json` · `src/app/api/cron/auto-release/route.ts`

Schedule `0 20 * * *` (17:00 BRT). Autenticação `Authorization: Bearer ${CRON_SECRET}`.
Iteração por tenant ativo com isolamento de falha. Bugfix de auditoria:
evento `liberacao_producao` grava `metadata.origin = "manual" | "sistema"`.

### AJ-A7 — Métricas operacionais (lead time, OTIF, ocupação, falhas)
**Concluído em:** 2026-05-21 (commit `d289a23`)
**Status:** ✅ Concluído · **Categoria:** Indicadores
**Área:** `src/lib/supabase-data/factory-metrics.ts` · `factory-metrics-card.tsx`

4 tiles no dashboard do gestor com thresholds visuais (OTIF ≥95/≥80;
Ocupação ≥90/≥70). Cálculo on-demand — Edge Function fica como caminho
de escape se latência ficar visível.

### AJ-A8 — Roteirização honesta (zona + janela)
**Concluído em:** 2026-05-21 (commit `d289a23`)
**Status:** ✅ Concluído · **Categoria:** Motor
**Área:** `src/lib/delivery-routing.ts`

Substitui `buildRouteMeta` hash-based fake por `buildDeliveryRoutes`:
agrupa por `delivery_zone` (texto livre cadastrado) com fallback por
`receive_window`. Não inventa geo que não existe no schema.

### AJ-A8.1 — Campo "Zona de Entrega" no cadastro de loja
**Concluído em:** 2026-05-21 (commit `c0e6d87`)
**Status:** ✅ Concluído · **Categoria:** UX
**Área:** `src/app/gestor-dados/lojas/page.tsx` · `master-data-admin.ts`

Form de cadastro de loja ganha campo opcional texto livre. Helper explica
o fallback para janela. Destrava efetivamente o A8 — sem UI, a coluna
`delivery_zone` ficaria sempre vazia.

### Pendências derivadas (não-bloqueantes)

#### AJ-A7.1 — Migrar métricas para Edge Function materializada
**Status:** A-fazer (otimização) · **Categoria:** Performance
**Área:** `factory-metrics.ts`

Quando: se snapshot >500ms ou dashboard travar com volume maior. Contrato
da API não muda — só a implementação.

#### AJ-A8.2 — Geocoding real em `stores`
**Status:** A-fazer se cliente pedir · **Categoria:** Modelo
**Área:** `master-data-admin.ts` · `delivery-routing.ts`

Quando: se o cliente pedir clusterização geográfica de verdade (não só
zona manual). Integrar API externa (Google Maps ou similar). `buildDeliveryRoutes`
funciona igual — `deliveryZone` continua sendo a chave de agrupamento.

#### AJ-A7.2 — OTIF com janela horária da loja
**Status:** Bloqueado por cadastro · **Categoria:** Indicador
**Área:** `factory-metrics.ts` · schema `stores`

Quando: se o schema ganhar `expected_delivery_time` (horário prometido por
loja). Hoje OTIF considera "fim do dia D" como prazo.

---

## 🔧 Ajustes do board 26/05 (Sprint 23) — em execução

Lote derivado do [[Brief Claude Code — Ajustes 26-05 + gaps 13-05]] (estudo de
origem: [[Estudo Trello — Analise 26-05 + Reuniao 13-05]]). Execução um item por
vez, na ordem ORDEM 1 → 8, com `tsc`/`npm test`/`eslint` após cada item.

### AJ-0025 — Editar receita não pode zerar o cronograma silenciosamente
**Concluído em:** 2026-05-29 (commit `fix(cronograma): AJ-0025 …`)
**Origem:** Trello 26/05 #5 (`ltvmA8RE`) + [[Dívida Técnica#D14]] · **Status:** ✅ Concluído · **Categoria:** Bug crítico (Motor/UX)
**Área:** `src/lib/supabase-data/schedule-revision-plan.ts` (novo) · `master-data-admin.ts` · `release-block-message.ts` (novo) · `release-order-with-confirm.ts` · `product-form-dialog.tsx` · `api/master-data/products/[productId]/route.ts`

**Causa-raiz confirmada:** `rebuildPendingScheduleRevisionForSubcategoryDbId`
deletava a revisão `pendente` e recriava outra com `legacy_id` novo. Como o id
da revisão entra no `planning_key` (`productionDate|sectorId|lineId|scheduleId`,
ver [[Backlog de Ajustes#AJ-A5]]), recriar mudava a chave → cronograma ativo
desativado (engine só planeja `status='ativo'`) + OPs/statuses órfãos →
`OrderReleaseValidationError` → HTTP 400 silencioso.

**O que mudou:**
1. **Motor:** reaproveita a revisão pendente existente (id estável → `planning_key`
   estável) em vez de delete+recriar; só recria quando NÃO há pendente (aí desativa
   o ativo e devolve metadados de impacto). Lógica pura em `schedule-revision-plan.ts`.
2. **UX (aviso):** banner no diálogo de commit do produto operacional avisando que
   salvar reconstrói a revisão pendente e exige reauditoria/reliberação.
3. **UX (erro 400):** `buildReleaseBlockMessage` traduz o `reason` para mensagem
   acionável ("reaudite o cronograma e tente liberar de novo").
4. **Impacto:** API devolve `scheduleRevisionImpact`; o form mostra toast orientando
   reauditoria após o save.

**a11y:** o diálogo de liberação já usava o `confirm-dialog` com `AlertDialogTitle` +
`aria-describedby` (UX-0002) — o warning de console citado no card já estava resolvido.

**Testes:** `schedule-revision-plan.test.ts` (3 casos: reaproveita pendente / recria
sem pendente + impacto / consolida múltiplas pendentes) + `release-block-message.test.ts`
(4 casos). `tsc` limpo, 148/148 testes, `eslint` sem erro novo (só o warning pré-existente [[#AJ-0023 — Dead code descoberto durante a Onda 1|AJ-0023]]).

### AJ-0024 — Cronograma escolhe variante/data errada + falha no 1º salvamento
**Concluído em:** 2026-05-30 (commit `fix(motor): AJ-0024 …`)
**Origem:** Trello 26/05 #4 (`Xc8jwCfH`) · **Status:** ✅ Concluído · **Categoria:** Bug crítico (Motor)
**Área:** `src/lib/factory-planning/engine.ts` · `src/lib/server-data-cache.ts` · `master-data.ts` · `store-orders.ts`

**Causa-raiz confirmada:** em `resolveScheduledProductAvailability`, quando a busca
regressiva (`resolveProductionDateInWindow`) não achava dia de produção que entregue
na data pedida, o branch `delayed` avançava até 14 dias e devolvia essa data futura
como `productionDate`. O item ficava `available:false` (correto), mas o catálogo/UI
exibiam a data +7 como se a variante fosse produzir lá ("variante/data errada").

**O que mudou:**
1. **Motor:** o branch `delayed` agora devolve `productionDate: null` + `blockedReason`
   acionável ("escolha a variante que produz no dia compatível"). Nunca mais agenda +7.
2. **Entrada do pedido:** a variante incompatível já era `available:false` e o
   `handleQuantityChange` já bloqueia edição de linha indisponível + `validateStoreOrderItems`
   já lança no save — confirmado, sem regressão.
3. **1º salvamento:** `getCachedServerData` ganhou `forceRefresh`; o caminho de
   escrita do pedido (`validateStoreOrderItems` → `getMasterDataSnapshot`) força dados
   frescos, eliminando o "salvou com 0 itens" causado pelo cache de 15s defasado.

**Testes (engine.test.ts):** "produz só sexta + entrega sexta + lead 1 → bloqueado, `productionDate:null`, não +7" + regressão "variante compatível (quinta) segue na quinta, não delayed". `server-data-cache.test.ts`: `forceRefresh` ignora cache fresco e reaquece. `tsc` limpo, 151/151, `eslint` 0 problemas.

### AJ-0026 — Criar categoria inline no modal "Nova Linha de produção"
**Concluído em:** 2026-05-30 (commit `feat(cadastro): AJ-0026 …`)
**Origem:** Trello 26/05 #1 (`cUKnjx9p`) · **Status:** ✅ Concluído · **Categoria:** UX
**Área:** `src/components/production/product-form-dialog.tsx` · `master-data-admin.ts` (`createCategory`) · `api/master-data/categories/route.ts`

Botão "+ Nova categoria" no dropdown Categoria do modal "Nova Linha" (aberto de
dentro do cadastro de produto). Reusa `POST /api/master-data/categories`. Ao criar,
a categoria é selecionada automaticamente no rascunho da linha e o estado do
formulário (produto + linha) é preservado — nenhum "cancelar e recomeçar".
`createCategory` passou a devolver `{id, code}` (espelha `createSubcategory`) para o
auto-select. `tsc` limpo, 151/151, `eslint` sem erro novo.

### AJ-0027 — Pedido: visualização do input numérico (só visual)
**Concluído em:** 2026-05-30 (commit `fix(pedidos): AJ-0027 …`)
**Origem:** Trello 26/05 #2 (`KiGOg0hB`) · **Status:** ✅ Concluído (parte visual) · **Categoria:** UX
**Área:** `src/app/loja/pedidos/page.tsx`
> Multi-dia (preencher outras colunas) está amarrado ao **AJ-0009** (⛔ decisão de cliente) — fora do escopo desta onda.

Célula de quantidade reescrita (`OrderQuantityCell`): alinhada à direita, `tabular-nums`,
largura maior (`min-w-[5.5rem]`), milhar pt-BR formatado ao desfocar (valor cru ao focar
para edição natural) e teto `MAX_ORDER_QUANTITY` (99.999) — clampado também em
`handleQuantityChange` — para não induzir duplicação de dígito. 1ª coluna segue editável.
`tsc` limpo, 151/151, `eslint` sem erro novo. **Validação visual recomendada antes do deploy.**

### AJ-0028 — Tooltip "Sequência Operacional" bugado (layout)
**Concluído em:** 2026-05-30 (commit `fix(pedidos): AJ-0028 …`)
**Origem:** Trello 26/05 #3 (`hQn2Z2YC`) · **Status:** ✅ Concluído · **Categoria:** Bug visual
**Área:** `src/components/shared/operational-sequence-card.tsx` · `src/app/loja/pedidos/page.tsx`

**Causa-raiz:** o `OperationalSequenceCard` usava `lg:grid-cols-4` (breakpoint de
**viewport**) dentro de um popover de 420px. No desktop (viewport ≥1024px) ele forçava
4 colunas em 420px → datas sobrepunham os rótulos das etapas.

**Fix (só CSS/layout):** o grid passou a usar **container queries** (Tailwind v4,
`@container` + `@md`/`@lg`) — responde à largura do próprio card, não do viewport.
Dentro do popover estreito quebra em 2/1 colunas; num container largo segue 4/5.
Adicionado `tabular-nums` + `break-words` no valor da etapa e `min-w-0` nas células.
Popover do "Como funciona" alargado para `w-[600px]` (cap `max-w-[calc(100vw-2rem)]`)
para caber as 4 colunas iguais no desktop. Beneficia os 3 usos do card sem tocar regra.
`tsc` limpo, 151/151, `eslint` 0 erros. **Validação visual (desktop + mobile) recomendada.**

### Gaps 13/05 (após os de 26/05)

#### AJ-0003.1 — Justificativa (motivo + campos alterados) da edição visível na auditoria
**Concluído em:** 2026-05-30 (commit `feat(auditoria): AJ-0003.1 …`)
**Origem:** Trello (`QW11M8T0`, ps2) + [[Dívida Técnica#D20]] · **Status:** ✅ Concluído · **Categoria:** Auditoria
**Área:** `src/lib/supabase-data/product-changelog-diff.ts` (novo) · `master-data-admin.ts` · `changelog/route.ts` · `gestor-fabrica/sublinhas-producao/page.tsx`

Campo "motivo da alteração" já era obrigatório no salvar produto. Agora o
`product_changelog.snapshot_data` registra também **quais campos mudaram (de/para)**
via `diffProductFields` (lógica pura, 5 testes). O endpoint de changelog passou a
devolver `snapshot_data`; a **auditoria de cronograma** (grade auditável) busca a
última edição de cada produto e mostra um bloco destacado "Última edição" com o
motivo, autor e a lista de campos alterados (de → para). `tsc` limpo, 156/156, `eslint` 0.

#### AJ-0004.1 — Decimal preciso das frações finais propagado a jusante
**Concluído em:** 2026-05-30 (commit `fix(receita): AJ-0004.1 …`)
**Origem:** Trello (`ZcZQpu9D`) · **Status:** ✅ Concluído · **Categoria:** Cálculo
**Área:** `src/lib/production-data-utils.ts` · `src/components/production/product-form-dialog.tsx`

**Auditoria:** `recipe-expansion.ts` (`scaleRecipeQuantity`, `round3`) e a pré-pesagem
(`printing-documents.ts`, `round3`) já propagam quantidades com 3 casas — sem
truncamento para inteiro/2 casas a jusante. O gap era pontual: o **rendimento preciso
das frações finais** (ex.: `8,542857` = 2,99 kg ÷ 0,35) era recomputado **só na UI**
(`recipeFinalQuantityPrecise`), enquanto o data layer só expunha o valor arredondado
para unidade inteira (`finalFractionsQuantity`, `Math.ceil`).

**Fix:** `getProductRecipeTotalsFromData` ganhou `finalFractionsQuantityPrecise` (fonte
única, sem arredondar); a UI passou a consumi-lo. `finalFractionsQuantity` (ceil) segue
para ordenar unidade inteira. Teste de propagação em `production-data-utils.test.ts`.
`tsc` limpo, 157/157, `eslint` sem erro novo.

#### AJ-0006.1 — Lote mínimo consolidado na fábrica + validação server-side
**Concluído em:** 2026-05-30 (commit `feat(fabrica): AJ-0006.1 …`)
**Origem:** Trello (`c8HOkNBG`) + [[Dívida Técnica#D09]] · **Status:** ✅ Concluído · **Categoria:** Regra/API
**Área:** `src/lib/factory-planning/engine.ts` · `types.ts` · `recipe-expansion.ts` · `gestor-fabrica/ordens-producao/page.tsx`

A noção de lote mínimo deixou de ser por loja (AJ-0006 já removeu a exposição na
loja — confirmado, sem resquícios) e passou a ser **consolidada na fábrica**: o motor
carrega `minimumProductionKg` no `PlannedOrderItem` e, ao montar a OP, compara a
**demanda somada de todas as lojas** (`totalKg` consolidado por planning_key) contra
o mínimo, marcando `belowMinimum` no `ProductionOrderItem`. A flag é **derivada
server-side no snapshot de planejamento** — não depende de `window.confirm` do front.
O gestor vê um alerta "Abaixo do lote mínimo" na "Demanda por produto (batelada)" em
`gestor-fabrica/ordens-producao`. Teste no `engine.test.ts` (consolidado < mínimo →
flag; ≥ mínimo → limpo). `tsc` limpo, 158/158, `eslint` 0.

#### Decisões de cliente (⛔ não codar)
- **AJ-0009 / AJ-0005.1 / AJ-0008.1** — ⛔ decisão de cliente, não codar.

---

## 🔴 Crítico (estrutural ou bloqueante)

### AJ-0009 — Mudar modelo: fábrica abre pedido → loja preenche
**Onda 4 preparada em:** 2026-05-19 — ADR escrito, **aguardando decisão do cliente** (sem código)
**Origem:** Call 2026-05-13 (Bloco 9) · **Status:** Aguardando decisão (ADR) · **Categoria:** Modelo

> 📄 **Documento de decisão:** [[decisoes/ADR_modelo_fabrica_abre_pedido]] — opções de modelo (A: `order_windows`; B: estado em `store_orders`; **C: híbrido faseado — recomendada**), trade-offs, mapa de impacto (DB/API/UI/docs/migração) e **8 perguntas abertas** a levar para Daniel + Adriano + Leonora antes de codar. Conforme o plano: "Não fazer no calor da hora."
**Área:** [[Jornada — Pedido da Loja]] · [[Regra — Pedido da Loja]] · `src/lib/supabase-data/store-orders.ts` · `src/app/loja/pedidos/page.tsx`

**O quê:** Loja não cria pedido — fábrica abre pedidos (1 ou mais dias) e loja vê lista de "pedidos disponíveis para preencher".

**Por quê:** Atual permite duplicidade implícita, não respeita o calendário da fábrica, e quebra a noção de "ciclo de pedido aberto pela fábrica".

**Impacto:** alto — afeta DB (nova entidade `order_window` ou similar?), API, UI loja, UI gestor-fábrica.

**Decisão pendente:**
- [ ] Definir entidade: `order_windows` (período aberto pela fábrica) vs apenas mudar UX mantendo `store_orders`?
- [ ] Definir quando a fábrica abre: manual, automático por cronograma, ou ambos?

---

### AJ-0014 — Cálculo correto de dias de cobertura (quadradinhos verdes)
**Concluído em:** 2026-05-19 (commit 9027976) — Onda 3 · regra confirmada com Giuseppe
**Origem:** Call 2026-05-13 (Bloco 14) · **Status:** Concluído · **Categoria:** Regra

> **Regra adotada (confirmada):** `coberturaDias = max(1, round(7 / nº de dias de produção do produto na semana))`. 1x/sem→7, 3x/sem→~2, todo dia→1. Helper `getCoverageDays` em `loja/pedidos/page.tsx`. Os N primeiros quadradinhos da grade ficam verdes por produto (informativo — não muda o modelo de dados do pedido; a "soma = semana completa quando a fábrica abre vários dias" continua dependendo do AJ-0009/Onda 4). **Limitação conhecida:** o caso "cardápio sáb-only → 1" não é distinguível de "1x/sem → 7" sem um tipo de produto dedicado — documentado, refinar com cliente se necessário.
**Área:** [[Regra — Disponibilidade de Produto]] · [[Engine — Visão Geral]] · `src/lib/factory-planning/engine.ts` · `src/app/loja/pedidos/page.tsx`

**O quê:** N quadradinhos = N dias de cobertura (dependente do ciclo de produção):
- 3x/semana → 2 quadradinhos.
- 1x/semana → 7 quadradinhos.
- Cardápio (sáb-only) → 1.

**Quando fábrica abre pedidos em vários dias, soma dos quadradinhos = semana completa.**

**Por quê:** Hoje 1 quadradinho = 1 dia de entrega, ignora ciclo. Cliente não sabe quanto pedir para cobrir período.

**Bonus AJ-0015 (Adriano):** mostrar a **data** no quadradinho (ex: "Sáb 17", "Dom 18"), porque venda varia por dia.

**Termo:** "dias de cobertura" — adicionar ao [[Glossário]].

---

### AJ-0011 — Sincronia de status entre OP / Expedição / Entrega
**Concluído em:** 2026-05-19 (commit 9027976) — Onda 3 · sem migração
**Origem:** Call 2026-05-13 (Bloco 11) + Dívida [[Dívida Técnica#D05]] · **Status:** Concluído · **Categoria:** Bug

> **Feito:** em `appendOrderEventsForProductionItem` (`workflow.ts`), quando a produção do pedido fecha 100% (status derivado via `applyFactoryWorkflowState` = `aguardando_expedicao`), o sistema agora: (1) persiste um **checkpoint** em `delivery_executions` (`upsert` mínimo, `onConflict: order_id, ignoreDuplicates` — não sobrescreve entrega já avançada, sem migração pois `status` default já é `aguardando_expedicao`); (2) emite **um** evento `producao_finalizada` em `store_order_events` (idempotente: só se ainda não há row de execução). `event_type` é `text` livre (sem CHECK) → sem migração.
> **Achado importante na implementação:** o gatilho precisou aplicar `applyFactoryWorkflowState` sobre o motor puro — `buildFactoryPlanningData` sozinho **não** reflete o status persistido de produção (isso só acontece no `planning-snapshot`). Sem isso o gatilho nunca dispararia. [[Dívida Técnica#D05]] pode ser marcada como mitigada (checkpoint + evento existem; status visível à loja agora tem âncora persistida).
**Área:** [[Integrações entre Jornadas]] · `src/lib/factory-planning/engine.ts:740-747` · `src/lib/factory-planning/workflow.ts` · `src/lib/factory-planning/delivery.ts`

**Sintoma:** Item aparece como "aguardando expedição" no painel mas dentro está 100% concluído; quando vai pra expedição, está "aguardando produção".

**Causa provável:** promoção para `aguardando_expedicao` é **derivada em runtime** (não persistida) — UI compõe `orderStatus + executionStatus` com cache de 10s. Sem evento de transição.

**Fix:** persistir transição em `delivery_executions.status` quando 100% das OPs do pedido estiverem concluídas. Disparar evento em `store_order_events`.

---

### AJ-0008 — MPI / Ingrediente misturado deve gerar OP separada
**Investigado em:** 2026-05-19 (Giuseppe) · **Auditado E2E em:** 2026-05-20 (Giuseppe) · **Implementado + ATIVADO em:** 2026-05-20
**Origem:** Call 2026-05-13 (Bloco 4) · **Status:** ✅ Concluído / ativado em produção · **Categoria:** Bug/Regra

> **Resolução (2026-05-20):** ADR aprovado em [[decisoes/ADR_expansao_mpi_em_op]]; expansão automática de produto-MPI em OP separada implementada em `src/lib/factory-planning/recipe-expansion.ts` e plugada em `engine.ts:buildFactoryPlanningData`. Ativada (default ON) na mesma data; escape hatch `EXPAND_MPI_INTO_OPS=false` permite rollback emergencial sem novo deploy. Pizza Margherita (PR-PIZZA01) e Massa de Pizza (MPI-002) cadastradas no banco do tenant Ecossistema Atual para o Daniel validar em produção. Cobertura: 5 testes unitários da função pura + 3 testes de integração no motor (expansão básica + agrupamento de demanda + escape hatch).
>
> Caminho B (ingrediente `type='misturado'`) **continua sem virar OP** — fica como composição interna na folha de pré-pesagem. Decisão documentada no ADR.
>
> **Auditoria E2E completa** disponível na conversa Claude do dia 2026-05-20 — confirmou que: zero edge functions / triggers / functions SQL envolvidos; toda a derivação de OP é runtime em TS; nenhuma migração de schema foi necessária. O número "110 testes" do achado original era estimativa — auditoria identificou 14 testes no engine (114 no projeto), risco de regressão muito menor.

> **Achado original (2026-05-19):** `engine.ts` → `buildProductionOrdersFromPlannedItems` (`src/lib/factory-planning/engine.ts:611`) gera OP **apenas** dos produtos finais pedidos pela loja, agrupados por planning key. **Não há nenhuma referência a `recipe`, `canBeIngredient`, `isMpiIngredient` ou `misturado` em todo o `engine.ts`.** Conclusão: o motor **nunca** gera OP separada para ingrediente `misturado`/MPI — a sub-receita só é expandida adiante na folha de produção / pré-pesagem (`printing-documents.ts`), não vira OP.
**Área:** `src/lib/factory-planning/engine.ts` · `src/lib/factory-planning/recipe-expansion.ts` (novo) · [[decisoes/ADR_expansao_mpi_em_op]] · [[Catálogo de Tabelas#ingredients]]

**O quê:** Quando uma receita consome um ingrediente do tipo `misturado` (com sub-receita), o sistema **deveria gerar OP separada** para esse ingrediente. Daniel cadastrou e não viu.

**Decisões fechadas no ADR (2026-05-20):**
- ✅ Caminho canônico: produto-MPI (`is_mpi_ingredient=true` + `can_be_ingredient=true`).
- ✅ Lead time da MPI: 0 dias (mesmo dia do produto-pai) — refinamento na onda 2.
- ✅ Agrupamento: uma OP de MPI por planning key, somando demanda de todos os produtos-pai.
- ✅ Liberação: pedido pai libera implicitamente OPs derivadas (sem novo endpoint).

**Aditivo (Adriano):** manter o modelo atual de "MPI como produto" (`is_mpi_ingredient`), com legenda/tooltip já entregue em [[#AJ-0020 — Legenda/tooltip diferenciando "ingrediente" e "produto MPI"|AJ-0020]].

---

## 🟡 Importante (UX/Bug operacional)

### AJ-0001 — Kanban acionável (substitui read-only)
**Revisado em:** 2026-05-20 — **diretriz original SUBSTITUÍDA por decisão do cliente** (Daniel, sessão 2026-05-20)
**Concluído em:** 2026-05-19 (commit 9027976) — Onda 3 *(implementação inicial read-only — superada pela nova diretriz)*
**Origem:** Call 2026-05-13 (Bloco 1) + Revisão cliente 2026-05-20 · **Status:** Ativo (re-aberto para Onda 5) · **Categoria:** UX

> [!warning] Substituição de diretriz — 2026-05-20
> A diretriz original ("Kanban é só visualização; não manipular status pelo Kanban") **foi revogada pelo cliente final** na sessão de 2026-05-20. O texto histórico abaixo (escopo Giuseppe, implementação read-only de 2026-05-19) está preservado para registro, mas **não é mais a regra vigente**.
>
> **Citação literal do cliente:** *"quero poder otimizar tudo, tipo um botão pra colocar tudo de uma vez pra produção, do dia esse tipo de coisa, tem que otimizar".*
>
> **Nova diretriz (vigente):** o Kanban dos dashboards de fábrica é o **ponto de ação primária** para otimizar fabricação — pode e deve mutar status.
>
> **Permitido:**
> - Ações **inline** em cada card (1 toque): `Liberar` (gestor), `Marcar concluída` (chão), `Abrir checklist`, `Reportar problema`.
> - Ações **em batch** no header das colunas: `Liberar tudo do dia`, `Liberar todos em espera`.
> - **Priorização visual:** badge `PRÓXIMA` na primeira OP da fila (ordenada por SLA).
>
> **Restrições mantidas:**
> - **Drag-and-drop NÃO foi adotado** — risco de toque acidental no chão-de-fábrica.
> - **Read-only continua valendo nas colunas terminais** (`Em rota` / `Entregue`).
> - Toda mutation **passa pelo endpoint existente** `PATCH /api/factory-planning/workflow` — sem novo endpoint backend.
> - **Batch = loop client-side** com toast de progresso (sem endpoint dedicado).
>
> **Implementação:** pendente — abrir UX-spec em `Docs/12 - Iniciativa UX/specs/` na próxima onda. Não regredir os deep-links do AJ-0002 (card → lista filtrada continua disponível como ação secundária).

---

> **Histórico — implementação original (2026-05-19, commit 9027976):** seção "Acompanhamento" no dashboard `gestor-fabrica/page.tsx` — 4 colunas (Aberto / Em produção / Aguardando expedição / Em rota·entregue) a partir de `planningData.orders`. Read-only; cada card navegava para `/gestor-fabrica/pedidos?status=<status>` (reaproveita o deep-link do AJ-0002). Não manipulava status. Card→lista filtrada (decisão Giuseppe); deep-link ao modal de detalhe ficava como possível refino futuro.
**Área:** `src/app/gestor-fabrica/page.tsx` · endpoint `PATCH /api/factory-planning/workflow` (reuso)

**O quê (vigente):** Cards de pedido / OP em colunas por status (Aberto → Em produção → Aguardando expedição → Em rota·entregue). **Acionável** nas colunas não-terminais via ações inline e batch; navega para detalhe respeitando a persona como ação secundária.

**Escopo original (revogado 2026-05-20):** ~~só visualização e navegação; não manipular status pelo Kanban.~~

---

### AJ-0002 — Dashboard com cards clicáveis
**Concluído em:** 2026-05-19 (commit 9cbd6ab) — Onda 2 · gestor-fábrica (ver nota)
**Origem:** Call 2026-05-13 (Bloco 2) · **Status:** Concluído (gestor-fábrica) · **Categoria:** UX

> **Feito:** `KPICard` ganhou prop opcional `href` (retrocompatível, vira `<Link>`). Os 5 cards do dashboard do gestor-fábrica agora navegam com filtro aplicado; `pedidos`, `ordens-producao` e `entregas` passaram a ler `?status` para o filtro inicial (padrão `useSearchParams` já usado no repo).
> **Escopo:** feito o dashboard primário (gestor-fábrica). "Outros dashboards de persona" (chão-de-fábrica, gestor-dados) ficam como extensão trivial agora que o `KPICard` suporta `href` — não feito nesta onda para conter escopo/risco.
**Área:** `src/app/gestor-fabrica/page.tsx` · outros dashboards de persona

**O quê:** Os cards de "Pedidos do dia / Aguardando liberação / Entregas" devem ser **clicáveis** → vão para a tela correspondente com filtro aplicado.

**Esperado:** card "8 pedidos do dia" → clique → `/gestor-fabrica/pedidos?status=ativo&date=hoje`.

---

### AJ-0003 — Auditoria do cronograma: coluna `expedition_lead_days`
**Concluído em:** 2026-05-19 (commit 06f8458) — Onda 1
**Origem:** Call 2026-05-13 (Bloco 3) · **Status:** Concluído · **Categoria:** UX
**Área:** `src/app/gestor-fabrica/sublinhas-producao/page.tsx` · [[Regra — Lead Days]]

**O quê:** Adicionar coluna na tabela de auditoria que mostra `expedition_lead_days` por produto. Hoje o dado só existe no cadastro do produto.

---

### AJ-0004 — Decimais em receita: 1 + 3 (X,XXX)
**Concluído em:** 2026-05-19 (commit 06f8458) — Onda 1
**Origem:** Call 2026-05-13 (Bloco 5) · **Status:** Concluído · **Categoria:** UX
**Área:** `src/app/gestor-dados/produtos/...` (cadastro de receita)

**O quê:** Mostrar rendimento e cálculos derivados com 3 casas decimais (ex: 9,123 em vez de 9). Importante para o cliente copiar para Excel.

---

### AJ-0005 — Pedido da Loja: indisponíveis no fim da lista
**Concluído em:** 2026-05-19 (commit 06f8458) — Onda 1
**Origem:** Call 2026-05-13 (Bloco 6) · **Status:** Concluído · **Categoria:** UX
**Área:** `src/app/loja/pedidos/[orderId]/page.tsx` (ou onde lista produtos)

**O quê:** Itens com `available_for_ordering=false` OU com regra de calendário bloqueada **vão para o fim da lista** (ou ficam ocultos com toggle "ver indisponíveis").

---

### AJ-0006 — Remover legenda "abaixo do mínimo produtivo" do lado loja
**Concluído em:** 2026-05-19 (commit 06f8458) — Onda 1
**Origem:** Call 2026-05-13 (Bloco 7) · **Status:** Concluído · **Categoria:** UX/Regra
**Área:** `src/app/loja/pedidos/...` · [[Regra — Lote Mínimo e Múltiplos]] · [[Dívida Técnica#D09]]

**O quê:** Loja não deve ver "abaixo do mínimo". A fábrica soma pedidos de todas as lojas. Lote mínimo é problema da fábrica.

**Bonus:** validação `window.confirm` também sai (era apenas frontend; sem validação na API — ver D09).

---

### AJ-0007 — Bloquear duplicidade antes de abrir o pedido
**Concluído em:** 2026-05-19 (commit 9cbd6ab) — Onda 2 · **só a parte UX** (ver nota)
**Origem:** Call 2026-05-13 (Bloco 8) · **Status:** Concluído (UX) / Bonus DB adiado · **Categoria:** Bug/UX

> **Feito:** banner proativo no diálogo "Novo Pedido" (loja) avisando, **antes de digitar**, que já existe pedido ativo para a mesma loja + data de entrega, com atalho "Abrir pedido existente" (entra no fluxo de edição). O server (`store-orders.ts:373`) já fazia o hard-block no submit; agora há aviso antecipado.
> **Adiado de propósito:** o `UNIQUE` parcial no banco (defesa contra race / D03). Ele se entrelaça com a mudança de modelo do AJ-0009 (Onda 4) — adicionar a constraint agora pode conflitar com a migração do modelo fábrica-abre-pedido. Decidir junto do AJ-0009.
**Área:** `src/app/loja/pedidos/...` · `src/lib/supabase-data/store-orders.ts:365` · [[Dívida Técnica#D03]]

**O quê:** Ao tentar abrir/criar pedido (mesma loja + mesma `delivery_date` ativos), mostrar **antes** de o usuário digitar:
- "Já existe um pedido para esta data — clique para abrir e continuar"
- ou "Pedido em andamento por <usuário> — abrir mesmo assim?"

**Bonus:** adicionar `UNIQUE` parcial no banco para hard-stop (atende AJ-0009 também).

---

### AJ-0010 — Impressão compacta (folhas de produção / OP / expedição / pedido)
**Concluído em:** 2026-05-19 (commit 06f8458) — Onda 1
**Origem:** Call 2026-05-13 (Bloco 10) + Trello · **Status:** Concluído · **Categoria:** UX
**Área:** `src/app/impressao/*`

**O quê:** Reduzir espaçamento. Estilo planilha do Google. Mais conteúdo por folha.

**Atenção:** ver [[Dívida Técnica#D17]] — `/impressao` está fora de `appAreaPath`, auditar guarda antes de adicionar features.

---

### AJ-0012 — Log de auditoria com diff visível
**Concluído em:** 2026-05-19 (commit 9cbd6ab) — Onda 2
**Origem:** Call 2026-05-13 (Bloco 12) · **Status:** Concluído · **Categoria:** UX

> **Feito:** diff por produto na seção "Revisões pendentes" comparando a revisão pendente com a versão anterior (via `revisionOfId`), usando só snapshots já no client — **não depende de `product_changelog`** (contorna [[Dívida Técnica#D20]]). Mostra produtos adicionados/removidos/alterados e, por campo, valor antigo → novo (carga base, dias de produção, lead expedição, prioridade diária).
**Área:** `src/app/gestor-fabrica/sublinhas-producao/page.tsx`

**O quê:** Na lista de "auditorias pendentes", mostrar o que foi alterado (campo + valor antigo / novo) ou destacar a linha alterada. Hoje só mostra que há 1 alteração pendente.

**Pode usar:** `product_changelog` (já existe, embora pobre — ver [[Dívida Técnica#D20]]).

---

### AJ-0013 — Visibilidade de pedido liberado para produção
**Concluído em:** 2026-05-19 (commit 9cbd6ab) — Onda 2
**Origem:** Call 2026-05-13 (Bloco 13) · **Status:** Concluído · **Categoria:** Bug/UX

> **Investigado:** não era bug — OPs com `productionDate` futura recebem `status="agendado"` (engine.ts:745) e somem da fila do dia. **Feito:** KPI "Agendadas (próximos dias)" + painel dedicado em `ordens-producao` listando cada OP agendada com a data prevista e link direto para a OP.
**Área:** `src/app/gestor-fabrica/ordens-producao/page.tsx`

**Sintoma:** Daniel liberou pedido para produção e não viu aparecer na fila. Pode estar agendado para data futura (lead days).

**Fix:** painel deve mostrar "X pedidos agendados para próximos dias" com a data prevista. Sem isso, parece bug.

---

### AJ-0016 — Mostrar data no quadradinho de cobertura
**Concluído em:** 2026-05-19 (commit 9027976) — Onda 3 (junto do AJ-0014)
**Origem:** Call 2026-05-13 (Adriano, Bloco 14) · **Status:** Concluído · **Categoria:** UX

> **Feito:** cabeçalho da grade mostra `SÁB 17` (dia da semana + data real) por coluna, via `formatCoverageColumnLabel(saleDate, index)`.
**Área:** mesma de AJ-0014

**O quê:** Quadradinho verde de cobertura mostra "Sáb 17", "Dom 18" — não só dia da semana. Porque venda varia por dia.

---

### AJ-0017 — Entregas: card "aguardando produção" navegável para OP
**Concluído em:** 2026-05-19 (commit 9cbd6ab) — Onda 2
**Origem:** Call 2026-05-13 (Daniel, 43:00) · **Status:** Concluído · **Categoria:** UX

> **Feito:** mapa `orderId → opId` computado em runtime na tela de entregas (sem mexer no motor). Quando a entrega está "aguardando produção" (`aguardando_expedicao` + `!expeditionReady`), aparece botão **"Ver OP"** que abre `/chao-fabrica/ordens-producao/{opId}` — desktop e mobile.
**Área:** `src/app/chao-fabrica/entregas/page.tsx`

**O quê:** Quando uma entrega está "aguardando produção", o card deve permitir clicar e ir para a OP correspondente — hoje o usuário tem que copiar código e procurar manualmente.

---

### AJ-0018 — Tooltips (`?` / balão) substituindo texto inline na tela do pedido
**Concluído em:** 2026-05-19 (commit 06f8458) — Onda 1
**Origem:** Call 2026-05-13 (Daniel + Giuseppe, ~45:00) e commit `c730591` · **Status:** Concluído · **Categoria:** UX
**Área:** `src/app/loja/pedidos/...` · `src/components/ui/...`

**O quê:** Replicar padrão já criado para reduzir poluição visual na tabela de pedido. Calendário/legenda viram tooltip ao hover.

**Já parcialmente feito:** commit `c730591` introduziu hint `(?)` reutilizável.

---

### AJ-0019 — Limpar banco de pedidos para testes
**Origem:** Call 2026-05-13 (1:15) · **Status:** Em-andamento (Giuseppe) · **Categoria:** Dev-ops
**Área:** Supabase

**O quê:** Truncate em `store_orders`, `store_order_items`, `store_order_events`, `workflow_*`, `delivery_executions` para o tenant de desenvolvimento. Manter catálogo (produtos, lojas, etc.).

**Atenção:** ver [[Dívida Técnica#D14]] — reconstrução de cronograma deleta pendentes sem aviso. Confirmar o que mais é afetado.

---

## 🟢 Polimento

### AJ-0020 — Legenda/tooltip diferenciando "ingrediente" e "produto MPI"
**Concluído em:** 2026-05-19 (commit 06f8458) — Onda 1
**Origem:** Call 2026-05-13 (Adriano, Bloco 4) · **Status:** Concluído · **Categoria:** UX
**Área:** `src/app/gestor-dados/ingredientes` + `src/app/gestor-dados/produtos`

**O quê:** Adicionar texto explicativo no cadastro: "Ingrediente puro = compra direta. Ingrediente misturado = receita interna. Produto MPI = item que pode ser vendido E usado em outra receita."

---

### AJ-0023 — Dead code descoberto durante a Onda 1
**Concluído em:** 2026-05-30 (commit `chore(lint): AJ-0023 …`) — removido após confirmação do Giuseppe
**Origem:** Implementação Onda 1 (2026-05-19, Giuseppe) · **Status:** ✅ Concluído · **Categoria:** Dívida Técnica
**Área:** `src/app/loja/pedidos/[orderId]/page.tsx` · `src/app/loja/pedidos/page.tsx` · `src/components/production/product-form-dialog.tsx`

> **Resolução (2026-05-30):** removidos os 3 pontos — `startEditing` (edição já inalcançável, único caller de `setIsEditing(true)`; setters reutilizados em outros lugares, sem órfãos), `selectedProductionSummary` (memo não consumido) e a diretiva `eslint-disable` (deps já completas, virou comentário simples). Rota `aggregated-quantities` **mantida** (reservada p/ consolidação da fábrica). `eslint .` sem os 3 warnings; 158/158, `tsc` limpo.

**O quê:** Três pontos de código morto detectados pelo lint (pré-existentes, não introduzidos pela Onda 1):
- `startEditing` definido e nunca usado em `loja/pedidos/[orderId]/page.tsx`.
- `selectedProductionSummary` calculado e nunca usado em `loja/pedidos/page.tsx`.
- diretiva `eslint-disable` desnecessária (`react-hooks/exhaustive-deps`) em `product-form-dialog.tsx`.

**Por quê:** Não bloqueia build (warnings), mas confunde manutenção e mascara warnings reais. Não removido na Onda 1 por estar fora do escopo dos AJs e da regra "não remover funcionalidade sem confirmar".

**Aditivo:** a rota `src/app/api/store-orders/aggregated-quantities/route.ts` ficou sem consumidores após AJ-0006. **Não deletar** — o AJ-0006 prevê que a fábrica consolide os pedidos de todas as lojas; a rota deve ser reusada nessa onda (provável Onda 2/4). Marcar para reavaliação se a consolidação da fábrica seguir outro caminho.

---

## 📦 Futuro (versão 12 / fase 2)

### AJ-0021 — Armazenamento / produção sob estoque (shelf life)
**Origem:** Call 2026-05-13 (Adriano + Daniel, Bloco 15) · **Status:** Adiado v12 · **Categoria:** Modelo
**Área:** [[Engine — Visão Geral]] · `products.allows_storage`

**O quê:** `allows_storage=true` permite produzir antecipadamente baseado em projeção. Massa de pizza produzida segunda, consumida quarta. Shelf life por produto.

---

### AJ-0022 — OP sem pedido (degustação / teste)
**Origem:** Call 2026-05-13 (Daniel, Bloco 15) · **Status:** Adiado v12 · **Categoria:** Modelo
**Área:** `src/app/gestor-fabrica/ordens-producao` · `workflow_production_items`

**O quê:** Permitir criar OP avulsa ("50 bolos para degustação amanhã") sem precisar de pedido de loja.

---

## Histórico de resoluções

### 2026-05-19 — Onda 3 (cobertura + sincronia) — fechada (4 AJs)

Onda de regra/motor — decisões confirmadas com Giuseppe antes de codar (AskUserQuestion). `tsc --noEmit` limpo, `eslint` 0 erros (segue só o warning pré-existente [[#AJ-0023 — Dead code descoberto durante a Onda 1|AJ-0023]]), 110/110 testes.

| ID | Resultado | Arquivos principais |
|---|---|---|
| AJ-0001 | ~~Kanban read-only de acompanhamento no dashboard~~ — **revogado em 2026-05-20** (ver bloco AJ-0001: cliente pediu Kanban acionável com ações inline + batch) | `src/app/gestor-fabrica/page.tsx` |
| AJ-0014 | Dias de cobertura: N quadradinhos verdes por cadência `round(7/dias)` | `src/app/loja/pedidos/page.tsx` |
| AJ-0016 | Data real em cada quadradinho (`SÁB 17`) | `src/app/loja/pedidos/page.tsx` |
| AJ-0011 | Checkpoint persistido em `delivery_executions` + evento `producao_finalizada` (sem migração) | `src/lib/supabase-data/workflow.ts` |

> **Decisões tomadas:** AJ-0014 = fórmula de cadência `round(7/nº dias)` (limitação cardápio documentada); AJ-0011 = sem migração, semear `delivery_executions` + evento. **Validação manual recomendada:** testar com Daniel o ciclo produção→100%→expedição (o gatilho do AJ-0011 roda no caminho central de `updateProductionItemStatus`); conferir visualmente os quadradinhos de cobertura por tipo de produto.

### 2026-05-19 — Onda 2 (bug fixes operacionais) — 5 feitos + 1 investigado

Sem mudança de regra de negócio. `tsc --noEmit` limpo, `eslint` 0 erros (segue só o warning pré-existente [[#AJ-0023 — Dead code descoberto durante a Onda 1|AJ-0023]]), 110/110 testes.

| ID | Resultado | Arquivos principais |
|---|---|---|
| AJ-0007 | Aviso proativo de pedido duplicado (UX). Bonus DB UNIQUE adiado p/ AJ-0009 | `src/app/loja/pedidos/page.tsx` |
| AJ-0017 | "Ver OP" na entrega aguardando produção (mapa orderId→opId em runtime) | `src/app/chao-fabrica/entregas/page.tsx` |
| AJ-0013 | KPI + painel de OPs agendadas para próximos dias | `src/app/gestor-fabrica/ordens-producao/page.tsx` |
| AJ-0012 | Diff por produto na auditoria (compara revisões, sem product_changelog) | `src/app/gestor-fabrica/sublinhas-producao/page.tsx` |
| AJ-0002 | `KPICard` com `href` + 5 cards do dashboard navegáveis + `?status` em 3 telas | `src/components/shared/kpi-card.tsx` · `gestor-fabrica/page.tsx` · `pedidos` · `ordens-producao` · `entregas` |
| AJ-0008 | ✅ **Concluído** — `EXPAND_MPI_INTO_OPS` ativado por padrão (escape hatch `=false`); Pizza Margherita + Massa de Pizza cadastradas no tenant Ecossistema Atual | `src/lib/factory-planning/recipe-expansion.ts`, `engine.ts`, `engine.test.ts`, [[decisoes/ADR_expansao_mpi_em_op]] |

> **Decisões pendentes p/ levar ao cliente:** ~~(1) AJ-0008 — manter modelo MPI-como-produto (só legenda) vs implementar OP automática de sub-receita (estrutural).~~ **Resolvido 2026-05-20**: ADR aprovado, expansão atrás de flag entregue na branch `feat/mpi-expansion-spike`, ativação em produção condicionada à validação de Daniel em dev. (2) AJ-0007 — quando adicionar o `UNIQUE` no banco (amarrado ao AJ-0009/Onda 4). Onda 2 não fez `next build` aqui (validação por `tsc`/`eslint`/testes); `useSearchParams` segue padrão já commitado no repo.

### 2026-05-19 — Onda 1 (quick wins UX) — fechada (7 AJs)

Lote entregue por Giuseppe na data-alvo da Onda 1. Sem mudança de regra de negócio. `tsc --noEmit` limpo, `eslint` sem erros novos, 110/110 testes passando.

| ID | Resumo | Arquivos principais |
|---|---|---|
| AJ-0005 | Indisponíveis vão para o fim da lista + toggle "Ocultar indisponíveis" | `src/app/loja/pedidos/page.tsx` |
| AJ-0006 | Removida toda exposição de "mínimo produtivo" do lado loja (alertas, `window.confirm`, coluna "Min.", fetch agregado) | `src/app/loja/pedidos/page.tsx` · `src/app/loja/pedidos/[orderId]/page.tsx` |
| AJ-0003 | Coluna "Lead expedição" (`expedition_lead_days`) na grade auditável | `src/app/gestor-fabrica/sublinhas-producao/page.tsx` |
| AJ-0004 | Rendimento e quantidades derivadas da receita com 3 casas decimais pt-BR (precisas, sem arredondar para unidade discreta na exibição) | `src/components/production/product-form-dialog.tsx` |
| AJ-0020 | Legenda explicativa puro / misturado / Produto MPI nos dois cadastros | `ingredient-form-dialog.tsx` · `product-form-dialog.tsx` |
| AJ-0010 | Impressão compacta centralizada no `PrintDocument` (margem `@page`, paddings, densidade de tabela, ritmo vertical) — atinge as 4 folhas | `src/components/printing/print-document.tsx` |
| AJ-0018 | Calendário/legenda da tabela de pedido movidos para `InfoHint` (padrão `c730591`); ícone fica vermelho quando bloqueado | `src/app/loja/pedidos/page.tsx` |

> **Onda 1 fechada** (commit `06f8458`), exceto AJ-0019 (limpar banco) — deixado fora a pedido do Giuseppe (dev-ops, não código). Observação de segurança: AJ-0010 não altera a guarda de `/impressao` — [[Dívida Técnica#D17]] segue aberta (páginas de impressão sem `isProtectedAppPath`).

---

## Como atualizar

1. Mudar status do AJ inline na seção apropriada.
2. Se virou Concluído, adicionar `**Concluído em:** YYYY-MM-DD (commit XXXXXX)` no topo do bloco.
3. Mover bloco concluído para "Histórico de resoluções".
4. Adicionar entrada em [[10 - Changelog Vivo/2026-05|Changelog do mês]].
