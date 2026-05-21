# ADR: Iniciativa de automação fim a fim do fluxo pedido → entrega (A1-A8)

## Status

**Aceito em 2026-05-21** — todas as frentes A1-A8 (+ A6.2 + A8.1) entregues, mergeadas
em `develop` e em produção. Migrations aplicadas no Supabase prod; Vercel Cron
configurado com `CRON_SECRET`. Auditoria final do agente production-engineer pegou 4
bugs no código entregue — todos corrigidos no commit `b6212bf`.

Relacionado: [[ADR_expansao_mpi_em_op]] (fase 2 entregue dentro do A4) ·
[[Backlog de Ajustes#AJ-0011 — Sincronia de status entre OP / Expedição / Entrega|AJ-0011]]
(promovido a checkpoint persistido em ondas anteriores; o A5 adiciona timeline
auditável por cima disso) · [[Jornada — Pedido da Loja]] ·
[[Jornada — Produção do Dia]] · [[Jornada — Expedição e Entrega]].

## Contexto

### O que motivou

Após o fechamento das ondas 1-3 do [[Call 2026-05-13 — Plano de Ataque]] e a
aprovação do ADR de MPI ([[ADR_expansao_mpi_em_op]]), o fluxo Pedido → Fabricação
→ Entrega ficou **funcionalmente completo**, mas com vários flancos abertos
identificados em auditoria interna:

- **Liberação ingênua:** `releaseOrder` não checava capacidade nem viabilidade
  do planejamento. Qualquer pedido com `availableForRelease=true` no snapshot
  era liberado direto, sem visibilidade do gestor sobre o motivo de um bloqueio.
- **Demanda agregada inacessível:** a única rota que somava demanda entre lojas
  (`/api/store-orders/aggregated-quantities`) era órfã (sem consumidor após
  AJ-0006) e lia direto de `store_order_items` — ignorava sub-receita / MPI,
  trazendo número sub-relatado.
- **Tentativas de entrega sem registro:** uma falha de entrega virava
  `delivery_executions.status='tentativa_falha'` sobrescrevendo a anterior. Sem
  histórico, sem motivo estruturado, sem reagendamento. Métricas de OTIF
  impossíveis.
- **Fase 1 do MPI travada em "schedule único":** a expansão de produto-MPI
  rodava na mesma planning key do pai (`lineId` herdado). Quando a fábrica
  tinha linha dedicada para MPI (massa em uma linha, produto final em outra),
  o sistema não respeitava.
- **Timeline ausente no chão de fábrica:** o `store_order_events` registrava
  evento `producao_status` por pedido — útil pra loja, mas opaco pro gestor da
  OP. Sem ver "quanto tempo essa OP ficou em cada estágio".
- **Liberação manual repetitiva:** todo dia o gestor abria a lista e clicava
  N vezes "Liberar para produção". Tarefa puramente operacional, sem decisão
  envolvida na maioria dos casos.
- **Métricas operacionais ausentes:** lead time, OTIF, ocupação, falhas — nada
  agregado em dashboard. O gestor só conseguia tirar via planilhas externas.
- **Roteirização fake:** `buildRouteMeta` (`chao-fabrica/entregas/page.tsx`)
  fabricava "Rota A/B/C" via `hashCode(orderCode+store+deliveryDate)`. Nenhum
  vínculo com geografia real, nenhum agrupamento honesto.

Em paralelo, a fase 1 do MPI já tinha entregado o caso central pedido pelo
Daniel (pizza → OP separada de massa) — mas a "Limitação conhecida" do
[[ADR_expansao_mpi_em_op]] (lead-time zero, schedule herdado do pai) começava a
incomodar quando o cliente cadastrava MPI com linha dedicada.

### Princípios que guiaram as decisões

1. **Não inventar dado que não existe no schema.** Se o `stores` não tem CEP /
   lat-long, a roteirização **não** vai fingir geo. Agrupamento honesto por
   sinal real (zona manual + janela horária) é melhor que "Rota A/B" hash-based.
2. **Persistir auditoria, não entidade.** Onde o problema é "perdi o histórico",
   resolver com tabela append-only de eventos — não substituir a entidade
   principal (OP, execução de entrega). `production_order_events` e
   `delivery_attempts` são puros logs.
3. **Override do gestor sempre auditado.** Capacidade vai estourar? OK, libere
   — mas com `liberacao_forcada` registrado no histórico. Decisão humana
   precisa ficar visível.
4. **Erros estruturados com prefixo "Invalid".** Convenção surgida nesta
   iniciativa: server-side joga `Error` com mensagem `"Invalid <coisa>: ..."`,
   route handler mapeia automaticamente pra 400. Sem custom error classes em
   cima de cada caso.
5. **Cron como ator do sistema, não usurpando o gestor.** Auto-release
   precisava rodar à noite sem `triggeredByProfileId`. Evento gravado com
   `metadata.origin = "sistema"` em vez de mentir que foi um humano.

## Decisões — frente a frente

### A1 — Validação server-side em `releaseOrder` com override forçável

**Decisão:** o `releaseOrder` em `workflow.ts` ganhou validação obrigatória via
`assertPlanningAllowsRelease` (`src/lib/supabase-data/release-validation.ts`).
Três razões de bloqueio: `order_cancelled`, `order_not_planned`,
`order_not_releasable`. As duas últimas aceitam override via parâmetro `force`,
que dispara um segundo evento `liberacao_forcada` no `store_order_events`.

**Por que essa abordagem:**
- Mover a validação pro server-side fecha o flanco onde a UI podia chamar a API
  com qualquer `orderId`. Não dá pra confiar só no botão habilitado/desabilitado
  na lista.
- Manter o override em vez de virar hard-block: o gestor **precisa** poder
  forçar (ex: cliente VIP, exceção justificada). Bloquear sem escape seria
  pior que o estado anterior.
- Eventos separados (`liberacao_producao` vs `liberacao_forcada`) deixam o
  relatório de exceções trivial — basta filtrar por `event_type`.

**Alternativa rejeitada:** custom error classes para cada razão. O route
handler ficaria com `if (err instanceof OrderCancelledError) ... else if
(err instanceof OrderNotPlannedError)`. Bagunça. Convenção `Invalid:` no
prefixo da mensagem cobre todos os casos com um regex no handler.

**Tradeoff aceito:** a UI só descobre "é forçável?" depois do primeiro POST
falhar. `ReleaseOrderBlockedError` no client carrega `forceable: boolean` e
`performReleaseOrderWithConfirm` (`src/lib/release-order-with-confirm.ts`)
encapsula o dialog. Duas chamadas em vez de uma, mas evita duplicar lógica
de validação no client.

### A2 — Card "Demanda por produto" derivado do engine

**Decisão:** novo card no `gestor-fabrica/pedidos` que mostra demanda agregada
(data × produto) somando todas as lojas. **Derivado do engine** (após
`buildFactoryPlanningData`), não consulta separada ao banco. A rota órfã
`/api/store-orders/aggregated-quantities` foi deletada no commit `b6212bf`.

**Por que essa abordagem:**
- A rota antiga lia direto de `store_order_items` — ignorava sub-receita / MPI.
  Pedido de 10 pizzas mostrava "10 pizza" mas escondia "5kg massa pizza".
  Depois do A4 (expansão de MPI), o engine **já** tinha o número certo.
- Derivar da snapshot é gratuito (o snapshot já é calculado pro motor). Zero
  query nova; zero risco de divergência.

**Alternativa rejeitada:** manter a rota antiga e fazer ela chamar o motor. O
contrato HTTP da rota original retornava `{[productId]: kg}` — incompatível com
a estrutura por planning key. Migrar consumidores (zero) seria pior que deletar.

### A3 — Tabela `delivery_attempts` append-only

**Decisão:** nova tabela `delivery_attempts` com enum
`delivery_failure_reason` (8 valores: `cliente_ausente`, `endereco_errado`,
`recusa_cliente`, `estabelecimento_fechado`, `veiculo_avaria`,
`acesso_bloqueado`, `documentacao_pendente`, `outro`). Cada falha grava uma
linha nova — `(order_id, attempt_number)` único garante ordem cronológica.
Reagendamento (`reschedule_to date`) opcional. Dialog estruturado no
`chao-fabrica/entregas` substitui o caminho legado de "só virar
`tentativa_falha`".

**Por que essa abordagem:**
- Append-only com `attempt_number` resolve o problema raiz (sobrescrever
  histórico) sem mexer em `delivery_executions`. As duas tabelas coexistem:
  a execução tem o status corrente, o histórico de tentativas vive na tabela
  nova.
- Enum em vez de texto livre: 8 motivos cobrem o vocabulário de padaria
  conhecido (Adriano confirmou na call). "Outro motivo" + `reason_notes`
  cobrem a cauda longa.
- `reschedule_to` no mesmo registro permite ver o ciclo completo
  (falhou → reagendou pra X → entregou) num único select.

**Tradeoff aceito:** OTIF imprecision. A métrica conta "entregue antes do fim
do dia D = no prazo", mas não considera janela horária da loja. Documentado
explicitamente em [[Runbook A1-A8]].

### A4 — Fase 2 do MPI: linha/setor nativos

**Decisão:** `expandRecipeIntoItems` (`src/lib/factory-planning/recipe-expansion.ts`)
passa a usar `mpiProduct.operationalLineId ?? mpiProduct.lineId` quando
existente. Quando o MPI tem linha própria e ela difere da linha do pai, o
schedule herdado do pai é **descartado** (o `scheduleId` da planning key vira
`null` para o MPI). Fechou a "Limitação conhecida" da fase 1 do
[[ADR_expansao_mpi_em_op]].

**Por que essa abordagem:**
- Default-on do MPI já estava ativo desde 2026-05-20. A regressão de mover a
  MPI pra outra linha quando o cadastro pede só vale **se a linha foi
  cadastrada** — então pra quem não preencheu, comportamento é idêntico ao da
  fase 1.
- Descartar o schedule do pai quando a linha muda é correto: o schedule é da
  linha do pai. Tentar reaproveitar geraria planning key inválida (schedule
  de outra linha).

**Alternativa rejeitada:** propagar o schedule do pai e deixar o motor "se
virar". Quebra a invariante "schedule pertence à linha", abre porta pra bugs
sutis no kanban quando o operador filtra por linha.

### A5 — Timeline de OPs em `production_order_events`

**Decisão:** nova tabela `production_order_events` indexada por
`planning_key` (chave natural estável da OP — mesma do
`workflow_production_items.production_item_key`). Toda chamada de
`updateProductionItemStatus` emite uma linha automaticamente. Endpoint
`GET /api/factory-planning/ops/[opId]/timeline` + card "Histórico da OP" na
página de detalhe da OP.

**Por que indexar por `planning_key` e não por `opCode`:**
- `opCode` é **derivado** em runtime (`OP-{date}-{seq}`) e o `seq` muda
  conforme novas OPs entram no dia. Persistir `opCode` quebraria o histórico
  toda vez que o motor recalcula.
- `planning_key` é construída com `(date|lineId|scheduleId|productId)` — só
  muda se o cadastro do produto / cronograma muda. Estável o suficiente para
  rastreio.

**Tradeoff aceito:** se a planning key mudar (cadastro alterado mid-flight),
eventos antigos viram "órfãos" — aparecem no histórico mas não na timeline
da nova OP. Aceitável; é o mesmo comportamento do `workflow_production_items`.

### A6 — Auto-release helper + endpoint batch

**Decisão:** `autoReleaseEligibleOrders` em `workflow.ts` itera todos os
pedidos do dia, filtra por `availableForRelease`, e libera em batelada.
Mantém a trava do A1 — pedidos bloqueados caem em `failed[]` sem interromper o
batch. Endpoint `POST /api/factory-planning/auto-release` + botão "Auto-liberar
elegíveis" no gestor (manual). Cron diário fica para A6.2.

**Por que separar manual de cron:**
- O gestor precisa poder rodar antes do cron (rotina assíncrona). Manual
  carrega `triggeredByProfileId` do gestor; cron carrega `null`.
- `metadata.origin` no evento (`"manual" | "sistema"`) preserva quem rodou —
  bug detectado e corrigido no commit de auditoria (`b6212bf`).

### A6.2 — Vercel Cron `0 20 * * *`

**Decisão:** `vercel.json` configura cron diário 20:00 UTC (17:00 BRT)
apontando para `GET /api/cron/auto-release`. Autenticação via
`Authorization: Bearer ${CRON_SECRET}`. Sem secret configurado o endpoint
devolve 503 (deploy inerte e seguro); secret errado devolve 401.

**Por que 17:00 BRT:**
- Cutoff típico de pedidos da padaria do Daniel é tarde. 17:00 BRT garante que
  todos os pedidos do dia já entraram, mas dá tempo de o gestor ver o relatório
  e ajustar antes do fechamento do dia.

**Por que GET-only:**
- Vercel Cron só dispara GET. Manter o endpoint GET-only força o ator do
  sistema a passar pelo header — não dá pra UI chamar por engano.

**Isolamento por tenant:** o cron itera tenants ativos via admin client
(bypassa RLS), cria cliente tenant-scoped por tenant, e roda
`autoReleaseEligibleOrders` por tenant. Falha em um tenant **não** interrompe
os outros — a resposta JSON agrega `released/skipped/failed` por tenant para
log no Vercel.

### A7 — Métricas operacionais on-demand

**Decisão:** `buildFactoryMetrics` em `src/lib/supabase-data/factory-metrics.ts`
calcula 4 indicadores num único endpoint:
- **Lead time** (por estágio + total): médias derivadas dos eventos de A5.
- **OTIF**: pedidos entregues no prazo / atrasados / pendentes, com
  thresholds visuais (≥95% verde, ≥80% amarelo, <80% vermelho).
- **Ocupação** por linha (`scheduledKg / capacityKg`), com thresholds
  (≥90% vermelho, ≥70% amarelo, <70% azul). Pico identificado.
- **Falhas de entrega** por motivo (do enum de A3).

Endpoint `GET /api/factory-planning/metrics?windowDays=N` + card
`FactoryMetricsCard` no dashboard do gestor.

**Por que on-demand e não materializada:**
- Volume atual é pequeno; cálculo roda em ms. Edge Function fica como caminho
  de escape **sem mudar contrato** se virar gargalo.
- Materializar agora obrigaria decidir refresh strategy (cron? trigger?) sem
  dado real de carga.

**Tradeoff aceito:** o cálculo refaz todo o snapshot a cada request. Cache de
10s do `getFactoryPlanningSnapshot` ajuda, mas dois usuários abrindo o
dashboard simultaneamente disparam 2 cálculos. Aceitável até carga real
mostrar problema.

### A8 — Roteirização honesta

**Decisão:** substituir o `buildRouteMeta` hash-based por `buildDeliveryRoutes`
(`src/lib/delivery-routing.ts`). Agrupamento por chave dupla:

1. Se `store.deliveryZone` preenchida (texto livre que o gestor cadastra) →
   `"Zona X"`.
2. Senão, se `store.receiveWindow` definida → `"Janela HH:MM - HH:MM"`.
3. Senão → `"Sem agrupamento"` (rota livre).

Dentro do grupo: ordena por janela horária mais cedo, depois código da loja.
`routeCode = "R-YYMMDD-NN"`.

**Por que não inventar geo:**
- Schema atual de `stores` não tem CEP / endereço / lat-long. Qualquer
  clusterização geográfica seria mentira.
- Janela horária é o sinal real disponível — a loja **precisa** receber até
  certo horário. Agrupar por janela é honesto e útil pro operador.
- `deliveryZone` como texto livre dá ao gestor poder de cluster manual sem
  forçar geocoding. Se cadastrar nada, fallback transparente para janela.

**Alternativa rejeitada:** integrar geocoding externo (Google Maps API). Custo,
complexidade de chave, latência. Fora de escopo desta onda. Pode entrar como
versão futura sem mudar contrato — `buildDeliveryRoutes` aceita qualquer
`StoreProfile.deliveryZone` (se preenchido por geocoding, funciona igual).

### A8.1 — Campo "Zona de Entrega" no cadastro de loja

**Decisão:** form de cadastro de loja em `/gestor-dados/lojas` ganha campo
opcional "Zona de Entrega" (texto livre), com helper explicando o fallback
para janela. `createStore` / `updateStore` em `master-data-admin.ts` persistem
em `stores.delivery_zone` (string vazia → null).

**Por que entregar junto com A8:**
- Sem UI pra preencher, a coluna `delivery_zone` (migration `20260521140000`)
  ficaria sempre vazia e a roteirização cairia no fallback eterno. A8 destrava
  A8 — sem A8.1 a feature está dormente.

## Tradeoffs aceitos (resumidos)

| Tradeoff | Decisão | Por que aceitamos |
|---|---|---|
| **OTIF imprecisa** (não considera janela horária real, só "fim do dia D") | Calcular OTIF com `delivery_date` simples | Sem dado de "horário prometido" no banco, qualquer regra mais fina seria heurística. Doc explícita no runbook. |
| **planning_key fase 1 vs fase 2** | Fase 2 muda MPI pra linha nativa, descarta schedule do pai | Cadastro novo (linha nativa do MPI) tem que ter prioridade sobre herança. Quem não preencheu, comportamento é idêntico ao da fase 1. |
| **Cron sem `triggeredByProfileId`** | Evento grava `metadata.origin="sistema"` | Mentir um profile fake seria pior que sinalizar honestamente "foi o cron". Filtrar relatório por origem trivial. |
| **Métricas on-demand recalculam snapshot** | Aceitar custo até dado real de carga | Materialização prematura sem dado de uso é over-engineering. Caminho de escape via Edge Function não muda contrato. |
| **`delivery_attempts` independente de `delivery_executions`** | Duas tabelas coexistem | Mudar `delivery_executions` pra carregar histórico exigiria reescrever a entidade central. Append-only por fora é mais barato. |

## Mapa de impacto

| Camada | Impacto |
|---|---|
| **DB** | 3 migrations: `delivery_attempts` (tabela + enum), `production_order_events` (tabela), `stores.delivery_zone` (coluna nullable). Todas com RLS por tenant. |
| **API** | 4 endpoints novos: `POST /api/delivery-executions/attempts`, `POST /api/factory-planning/auto-release`, `GET /api/factory-planning/ops/[opId]/timeline`, `GET /api/factory-planning/metrics`. 1 endpoint de cron: `GET /api/cron/auto-release`. 1 endpoint deletado: `/api/store-orders/aggregated-quantities`. |
| **Motor** | `expandRecipeIntoItems` ganha resolução de linha nativa (A4). Engine adiciona derivação de demanda agregada por produto (A2). |
| **UI gestor** | Dialog "Liberar mesmo assim" nas duas páginas de pedido (A1). Card "Demanda por produto" (A2). Card "Métricas operacionais" no dashboard (A7). Botão "Auto-liberar elegíveis" (A6). Card "Histórico da OP" no detalhe (A5). |
| **UI chão** | Dialog estruturado de tentativa falha + badge histórica (A3). Botão mobile corrigido pra usar dialog em vez de caminho legado (commit de auditoria). |
| **UI master-data** | Campo "Zona de Entrega" no cadastro de loja (A8.1). |
| **Cron / infra** | `vercel.json` + `CRON_SECRET` no Vercel Dashboard. |
| **Testes** | +8 testes (release-validation, delivery-routing, recipe-expansion fase 2). Total: 141/141. |

## Consequências

- O fluxo Pedido → Fabricação → Entrega passa a ser **auditável fim a fim**.
  Toda decisão excepcional (forçar release, falhar entrega) deixa pegada
  estruturada no banco.
- O gestor ganha autonomia operacional: auto-release diário e on-demand
  removem a tarefa manual repetitiva. Override forçável mantém poder de
  decisão para os casos não-rotineiros.
- A iniciativa **não muda o modelo** do AJ-0009 (fábrica abre pedido). Tudo
  aqui assume o modelo atual (loja cria). Se / quando AJ-0009 for codado,
  release validation e auto-release vão precisar conviver com `order_windows`
  — convém revisitar.
- OTIF e ocupação ficam disponíveis como KPIs, mas a precisão depende de
  cadastro completo (capacidade da linha, janela de recebimento da loja).
  Cadastro incompleto = métrica visual mas pouco acionável.
- Geocoding real continua fora de escopo. Se o cliente quiser rotas
  geográficas, abrir AJ específico — o desacoplamento permite plugar sem
  reescrever `buildDeliveryRoutes`.

## Pendências conhecidas (não-bloqueantes)

| ID | Descrição | Quando voltar |
|---|---|---|
| Edge Function de métricas | A7 roda on-demand. Migrar pra Edge Function materializada se latência ficar visível. | Quando snapshot >500ms ou dashboard travar |
| Geocoding real em `stores` | A8 agrupa por zona manual / janela. Quando cliente pedir clusterização geográfica de verdade, integrar API externa. | Quando cliente pedir |
| OTIF com janela horária | Métrica atual considera "fim do dia D". Refinar quando o schema ganhar horário prometido por loja. | Quando o cadastro de loja tiver `expected_delivery_time` |

## Auditoria final — bugs flagrados e corrigidos

A auditoria do agente production-engineer (pós-implementação) identificou 4
issues — todos no commit `b6212bf`:

1. **Mobile bypass do dialog A3:** botão "Registrar falha" no card mobile
   ainda chamava `updateExecution` direto. Agora abre o mesmo dialog
   estruturado do desktop.
2. **`releaseOrder` ignorava `referenceDate`:** validação sempre rodava contra
   `new Date()`. Adicionado `referenceDate?: string` em `ReleaseOrderOptions`,
   propagado via route handler + hook do cliente.
3. **Evento `liberacao_producao` sem origem:** cron liberava sem registrar
   que foi o sistema. Adicionado `metadata.origin = "manual" | "sistema"` +
   título distinto no evento.
4. **Rota órfã `/api/store-orders/aggregated-quantities`:** zero consumidores
   após A2. Deletada.

## Próximos passos

1. **Acompanhamento por uma semana:** validar via `Vercel logs` que o cron
   está rodando diariamente; conferir contagem `released/skipped/failed` por
   tenant.
2. **Cadastro real de `delivery_zone`:** Daniel/Adriano preenchem nas lojas
   ativas para ativar agrupamento real (sem cadastro, fallback de janela
   ainda funciona).
3. **Treinar gestores no override:** o dialog "Liberar mesmo assim" é
   intencional — mostrar que **deve ser usado** quando o gestor confia, e o
   evento `liberacao_forcada` é audit trail, não punição.
4. **Não levar A6 / A6.2 / A7 para o backlog do AJ-0009:** se / quando o
   modelo de janelas entrar, revisar.
