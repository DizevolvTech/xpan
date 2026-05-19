# Backlog de Ajustes

> Lista única, numerada, com status. Atualizar conforme cada ajuste é trabalhado.

**Última revisão:** 2026-05-19

---

## 🔴 Crítico (estrutural ou bloqueante)

### AJ-0009 — Mudar modelo: fábrica abre pedido → loja preenche
**Origem:** Call 2026-05-13 (Bloco 9) · **Status:** A-fazer · **Categoria:** Modelo
**Área:** [[Jornada — Pedido da Loja]] · [[Regra — Pedido da Loja]] · `src/lib/supabase-data/store-orders.ts` · `src/app/loja/pedidos/page.tsx`

**O quê:** Loja não cria pedido — fábrica abre pedidos (1 ou mais dias) e loja vê lista de "pedidos disponíveis para preencher".

**Por quê:** Atual permite duplicidade implícita, não respeita o calendário da fábrica, e quebra a noção de "ciclo de pedido aberto pela fábrica".

**Impacto:** alto — afeta DB (nova entidade `order_window` ou similar?), API, UI loja, UI gestor-fábrica.

**Decisão pendente:**
- [ ] Definir entidade: `order_windows` (período aberto pela fábrica) vs apenas mudar UX mantendo `store_orders`?
- [ ] Definir quando a fábrica abre: manual, automático por cronograma, ou ambos?

---

### AJ-0014 — Cálculo correto de dias de cobertura (quadradinhos verdes)
**Origem:** Call 2026-05-13 (Bloco 14) · **Status:** A-fazer · **Categoria:** Regra
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
**Origem:** Call 2026-05-13 (Bloco 11) + Dívida [[Dívida Técnica#D05]] · **Status:** A-fazer · **Categoria:** Bug
**Área:** [[Integrações entre Jornadas]] · `src/lib/factory-planning/engine.ts:740-747` · `src/lib/factory-planning/workflow.ts` · `src/lib/factory-planning/delivery.ts`

**Sintoma:** Item aparece como "aguardando expedição" no painel mas dentro está 100% concluído; quando vai pra expedição, está "aguardando produção".

**Causa provável:** promoção para `aguardando_expedicao` é **derivada em runtime** (não persistida) — UI compõe `orderStatus + executionStatus` com cache de 10s. Sem evento de transição.

**Fix:** persistir transição em `delivery_executions.status` quando 100% das OPs do pedido estiverem concluídas. Disparar evento em `store_order_events`.

---

### AJ-0008 — MPI / Ingrediente misturado deve gerar OP separada
**Investigado em:** 2026-05-19 (Giuseppe) — **decisão de produto pendente**
**Origem:** Call 2026-05-13 (Bloco 4) · **Status:** Investigado / A-decidir · **Categoria:** Bug/Regra

> **Achado:** `engine.ts` → `buildProductionOrdersFromPlannedItems` (`src/lib/factory-planning/engine.ts:611`) gera OP **apenas** dos produtos finais pedidos pela loja, agrupados por planning key. **Não há nenhuma referência a `recipe`, `canBeIngredient`, `isMpiIngredient` ou `misturado` em todo o `engine.ts`.** Conclusão: o motor **nunca** gera OP separada para ingrediente `misturado`/MPI — a sub-receita só é expandida adiante na folha de produção / pré-pesagem (`printing-documents.ts`), não vira OP.
>
> Não é um bug pontual: é uma **lacuna estrutural** (explosão de receita / grafo de dependência de produção). O Aditivo do Adriano já apontava "manter o modelo MPI-como-produto + legenda" — a legenda foi feita em [[#AJ-0020 — Legenda/tooltip diferenciando "ingrediente" e "produto MPI"|AJ-0020]].
>
> **Recomendação:** tratar como feature de fase 2, decidir junto de [[#AJ-0009 — Mudar modelo: fábrica abre pedido → loja preenche|AJ-0009]] e [[#AJ-0021 — Armazenamento / produção sob estoque (shelf life)|AJ-0021]]. Levar a Daniel + Adriano: (a) manter modelo atual (MPI só vira OP se for pedido) — só legenda, **ou** (b) implementar geração automática de OP para sub-receita (estrutural, alto impacto no motor e nos 110 testes).
**Área:** [[Engine — Visão Geral]] · [[Catálogo de Tabelas#ingredients]] · `src/lib/factory-planning/engine.ts`

**O quê:** Quando uma receita consome um ingrediente do tipo `misturado` (com sub-receita), o sistema **deveria gerar OP separada** para esse ingrediente. Daniel cadastrou e não viu.

**Investigação necessária:**
- [ ] O motor enxerga `ingredient_type='misturado'` e `is_mpi_ingredient`?
- [ ] Ou só `products.can_be_ingredient` é considerado?
- [ ] Diferença entre `ingredients` (com `type='misturado'`) e `products` com `is_mpi_ingredient=true` — qual o caminho correto?

**Aditivo (Adriano):** manter o modelo atual de "MPI como produto" (`is_mpi_ingredient`), mas adicionar **legenda/tooltip** para reduzir confusão entre "ingrediente" e "produto MPI".

---

## 🟡 Importante (UX/Bug operacional)

### AJ-0001 — Visualização Kanban read-only (acompanhamento)
**Origem:** Call 2026-05-13 (Bloco 1) · **Status:** A-fazer · **Categoria:** UX
**Área:** novo módulo (?) ou inserir em `gestor-fabrica/dashboard` · `src/app/gestor-fabrica/page.tsx`

**O quê:** Cards de pedido em colunas por status (Aberto → Em produção → Aguardando expedição → Entregue). Read-only; clique navega para o detalhe respeitando a persona (loja → pedido, fábrica/chão → OP).

**Escopo Giuseppe:** só visualização e navegação. **Não manipular status pelo Kanban.**

---

### AJ-0002 — Dashboard com cards clicáveis
**Concluído em:** 2026-05-19 (a commitar) — Onda 2 · gestor-fábrica (ver nota)
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
**Concluído em:** 2026-05-19 (a commitar) — Onda 2 · **só a parte UX** (ver nota)
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
**Concluído em:** 2026-05-19 (a commitar) — Onda 2
**Origem:** Call 2026-05-13 (Bloco 12) · **Status:** Concluído · **Categoria:** UX

> **Feito:** diff por produto na seção "Revisões pendentes" comparando a revisão pendente com a versão anterior (via `revisionOfId`), usando só snapshots já no client — **não depende de `product_changelog`** (contorna [[Dívida Técnica#D20]]). Mostra produtos adicionados/removidos/alterados e, por campo, valor antigo → novo (carga base, dias de produção, lead expedição, prioridade diária).
**Área:** `src/app/gestor-fabrica/sublinhas-producao/page.tsx`

**O quê:** Na lista de "auditorias pendentes", mostrar o que foi alterado (campo + valor antigo / novo) ou destacar a linha alterada. Hoje só mostra que há 1 alteração pendente.

**Pode usar:** `product_changelog` (já existe, embora pobre — ver [[Dívida Técnica#D20]]).

---

### AJ-0013 — Visibilidade de pedido liberado para produção
**Concluído em:** 2026-05-19 (a commitar) — Onda 2
**Origem:** Call 2026-05-13 (Bloco 13) · **Status:** Concluído · **Categoria:** Bug/UX

> **Investigado:** não era bug — OPs com `productionDate` futura recebem `status="agendado"` (engine.ts:745) e somem da fila do dia. **Feito:** KPI "Agendadas (próximos dias)" + painel dedicado em `ordens-producao` listando cada OP agendada com a data prevista e link direto para a OP.
**Área:** `src/app/gestor-fabrica/ordens-producao/page.tsx`

**Sintoma:** Daniel liberou pedido para produção e não viu aparecer na fila. Pode estar agendado para data futura (lead days).

**Fix:** painel deve mostrar "X pedidos agendados para próximos dias" com a data prevista. Sem isso, parece bug.

---

### AJ-0016 — Mostrar data no quadradinho de cobertura
**Origem:** Call 2026-05-13 (Adriano, Bloco 14) · **Status:** A-fazer · **Categoria:** UX
**Área:** mesma de AJ-0014

**O quê:** Quadradinho verde de cobertura mostra "Sáb 17", "Dom 18" — não só dia da semana. Porque venda varia por dia.

---

### AJ-0017 — Entregas: card "aguardando produção" navegável para OP
**Concluído em:** 2026-05-19 (a commitar) — Onda 2
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
**Origem:** Implementação Onda 1 (2026-05-19, Giuseppe) · **Status:** A-fazer · **Categoria:** Dívida Técnica
**Área:** `src/app/loja/pedidos/[orderId]/page.tsx` · `src/app/loja/pedidos/page.tsx` · `src/components/production/product-form-dialog.tsx`

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

### 2026-05-19 — Onda 2 (bug fixes operacionais) — 5 feitos + 1 investigado

Sem mudança de regra de negócio. `tsc --noEmit` limpo, `eslint` 0 erros (segue só o warning pré-existente [[#AJ-0023 — Dead code descoberto durante a Onda 1|AJ-0023]]), 110/110 testes.

| ID | Resultado | Arquivos principais |
|---|---|---|
| AJ-0007 | Aviso proativo de pedido duplicado (UX). Bonus DB UNIQUE adiado p/ AJ-0009 | `src/app/loja/pedidos/page.tsx` |
| AJ-0017 | "Ver OP" na entrega aguardando produção (mapa orderId→opId em runtime) | `src/app/chao-fabrica/entregas/page.tsx` |
| AJ-0013 | KPI + painel de OPs agendadas para próximos dias | `src/app/gestor-fabrica/ordens-producao/page.tsx` |
| AJ-0012 | Diff por produto na auditoria (compara revisões, sem product_changelog) | `src/app/gestor-fabrica/sublinhas-producao/page.tsx` |
| AJ-0002 | `KPICard` com `href` + 5 cards do dashboard navegáveis + `?status` em 3 telas | `src/components/shared/kpi-card.tsx` · `gestor-fabrica/page.tsx` · `pedidos` · `ordens-producao` · `entregas` |
| AJ-0008 | **Investigado** — motor não gera sub-OP por design; decisão de produto pendente | (sem código — ver bloco AJ-0008) |

> **Decisões pendentes p/ levar ao cliente:** (1) AJ-0008 — manter modelo MPI-como-produto (só legenda) vs implementar OP automática de sub-receita (estrutural). (2) AJ-0007 — quando adicionar o `UNIQUE` no banco (amarrado ao AJ-0009/Onda 4). Onda 2 não fez `next build` aqui (validação por `tsc`/`eslint`/testes); `useSearchParams` segue padrão já commitado no repo.

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
