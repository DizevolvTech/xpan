# ADR: Modelo "fábrica abre pedido → loja preenche" (AJ-0009)

## Status

**Aceito (2026-05-30) — Opção C (híbrido faseado), Fase 4a.** Decisão do Giuseppe.
Fundação da Fase 4a **implementada** (migration + ciclo de status + `UNIQUE` que fecha
D03/AJ-0007 + helpers/flag), atrás da feature flag `FACTORY_OPENS_ORDERS` (**default OFF**).
A inversão de UX (loja só preenche / fábrica "abre pedidos") é o **rollout gated**: depende
de (1) aplicar a migration na base, (2) ligar a flag, (3) validação com cliente real — exatamente
o que este ADR recomenda. A **Fase 4b** (`order_windows`, multi-dia/semana) segue aguardando
confirmação da granularidade real (perguntas abertas abaixo).

> Histórico: documento nasceu "Proposto — aguardando decisão do cliente" (Onda 4 do
> [[Call 2026-05-13 — Plano de Ataque]]). O plano alertava: *"Não fazer no calor da hora.
> Antes de codar: decidir."* — decisão tomada em 2026-05-30.

Relacionado: [[Backlog de Ajustes#AJ-0009 — Mudar modelo: fábrica abre pedido → loja preenche|AJ-0009]] ·
desbloqueia o bônus de [[Backlog de Ajustes#AJ-0007 — Bloquear duplicidade antes de abrir o pedido|AJ-0007]] (`UNIQUE` no banco) ·
interage com [[Backlog de Ajustes#AJ-0014 — Cálculo correto de dias de cobertura (quadradinhos verdes)|AJ-0014]] ("soma dos quadradinhos = semana").

## Contexto

### Modelo atual (hoje)

A **loja inicia** o pedido. Em `/loja/pedidos` ela clica "Novo Pedido" e o sistema
**cria** a linha sob demanda via `createStoreOrder` (`src/lib/supabase-data/store-orders.ts:344`).

- `store_orders` (schema `20260309130000_initial_schema.sql:291`): `id, legacy_id, code,
  store_id, created_by_profile_id, ordered_at, base_date, delivery_date,
  receive_window_snapshot, expedition_lead_days_snapshot, note` (+ `management_status`
  adicionado depois: `ativo`/`cancelado`).
- **Uma linha `store_orders` = um pedido de uma loja para uma `delivery_date`.**
- Não existe entidade de "janela/ciclo de pedido aberto pela fábrica".
- Duplicidade evitada **só em código** (`store-orders.ts:373`) — sem `UNIQUE` no banco
  ([[Dívida Técnica#D03]]).
- Status do pedido é **derivado** pelo motor, não persistido.
- Jornada completa documentada em [[Jornada — Pedido da Loja]].

### Modelo desejado (Call 2026-05-13, Bloco 9)

> "A **fábrica abre os pedidos** (semana, dia, etc.) e a loja vê uma **lista de pedidos
> disponíveis para preencher**. Loja não cria, só preenche. Quando a fábrica audita o
> cronograma, isso impacta os pedidos abertos. Após auditar, a fábrica **publica** os
> pedidos pras lojas."

Conceito do cliente: existe um **ciclo de pedido aberto pela fábrica**. A loja deixa de
ser quem cria — passa a ser quem preenche o que a fábrica abriu/publicou.

### Por que mudar

- O modelo atual permite duplicidade implícita e não respeita o calendário da fábrica.
- Quebra a noção de "ciclo de pedido" — a fábrica não controla quando/para quais dias as
  lojas pedem.
- [[Backlog de Ajustes#AJ-0014 — Cálculo correto de dias de cobertura (quadradinhos verdes)|AJ-0014]]
  só fica completo com este modelo: "quando a fábrica abre pedidos em vários dias, a soma
  dos quadradinhos cobre exatamente a semana" — isso pressupõe a entidade "janela".

## Opções de modelo

### Opção A — Nova entidade `order_windows` (janela aberta pela fábrica)

Nova tabela representando o **período/ciclo que a fábrica abre**:

```
order_windows
  id, tenant_id
  status            -- rascunho | publicada | encerrada
  opened_by_profile_id
  scope             -- todas as lojas | grupo | loja específica
  delivery_dates[]  -- os dias que a janela cobre (1..N)
  schedule_ref      -- revisão de cronograma considerada na abertura
  published_at, closes_at
  created_at, updated_at

order_window_stores            -- se escopo por loja/grupo
  order_window_id, store_id

store_orders
  + order_window_id  (FK, nullable durante transição)
```

Fluxo: fábrica **abre** janela (manual ou automático por cronograma) → estado `rascunho`
→ audita/ajusta → **publica** → loja vê "pedidos disponíveis para preencher" (janelas
publicadas sem `store_order` daquela loja) → loja preenche → vira `store_order` vinculado.
`UNIQUE (order_window_id, store_id)` resolve [[Dívida Técnica#D03]]/AJ-0007 naturalmente.

| | |
|---|---|
| **Prós** | Modela fielmente o conceito do cliente; suporta multi-dia/semana (fecha AJ-0014 "soma = semana"); audit trail de abrir/publicar/encerrar; `UNIQUE` natural; separa claramente "janela" (fábrica) de "pedido" (loja). |
| **Contras** | Maior esforço (tabela + RLS + API + 2 UIs + migração); reescreve [[Jornada — Pedido da Loja]] e atualiza [[Regra — Pedido da Loja]]; motor passa a considerar janelas; migração dos pedidos atuais (criar janelas retroativas ou conviver com `order_window_id` nulo no legado). |

### Opção B — Sem nova entidade: inverter quem cria + estado em `store_orders`

A **fábrica** cria as linhas `store_orders` em estado "aberto/rascunho" (sem itens) e a
loja só preenche/edita. Adicionar `store_orders.status` (`aberto` → `preenchido` →
`enviado`) e `opened_by_profile_id`. `UNIQUE (tenant, store, delivery_date)` parcial vira
viável (bônus AJ-0007).

| | |
|---|---|
| **Prós** | Menor esforço; reaproveita `store_orders`; migração trivial (pedidos atuais já contam como `preenchido`); entrega rápido o comportamento "loja só preenche" + resolve AJ-0007. |
| **Contras** | Não modela bem "janela de N dias/semana" (uma `store_orders` = uma `delivery_date`); o "ciclo" fica implícito; a soma multi-dia do AJ-0014 fica forçada; "fábrica abre para todas as lojas" vira N inserts sem entidade-pai; sem objeto claro de "período aberto". |

### Opção C — Híbrido faseado (recomendada)

- **Fase 4a:** Opção B — inverter quem cria + `status` + `UNIQUE`. Entrega cedo o
  comportamento central ("loja não cria, só preenche") e fecha o bônus do AJ-0007.
  Baixo risco, migração trivial, valida o fluxo com o cliente real.
- **Fase 4b (se validado):** introduzir `order_windows` (Opção A) por cima, para
  multi-dia/semana e fechar o AJ-0014 "soma = semana". `store_orders` ganha
  `order_window_id`; os pedidos da 4a continuam válidos (window nulo = legado).

| | |
|---|---|
| **Prós** | Reduz risco; entrega valor incremental; valida com cliente antes do investimento estrutural pesado; mantém caminho aberto para o modelo completo. |
| **Contras** | Duas migrações/ondas; um período com modelo intermediário. |

## Recomendação

**Opção C (híbrido faseado)**, começando pela Fase 4a. Razões: o plano já alerta para o
risco desta onda e recomenda "ronda de validação com cliente real antes de mudar modelo";
a Fase 4a entrega o comportamento que o cliente descreveu ("loja só preenche") e fecha
AJ-0007 com baixo risco; a Fase 4b (entidade `order_windows`) só se justifica depois de
confirmar a granularidade real de "janela" com Daniel/Adriano (ver perguntas abertas).

> A decisão final é do cliente + Giuseppe/Leonora. Este ADR não decide — propõe.

## Perguntas abertas (responder ANTES de codar)

1. **Granularidade da janela:** a fábrica abre por dia, por semana, ou intervalo livre?
   Uma janela cobre quais `delivery_dates`?
2. **Escopo:** a fábrica abre uma janela para **todas** as lojas de uma vez, por grupo,
   ou loja a loja?
3. **Rascunho × publicado:** existe estado em que a fábrica monta antes de a loja ver?
   Quem pode publicar? Pode reabrir/encerrar uma janela publicada?
4. **Auditoria de cronograma × janela aberta:** auditar o cronograma re-deriva o catálogo
   e as datas da janela automaticamente? Bloqueia a edição da loja durante a auditoria?
5. **Migração:** pedidos atuais (ativos/em produção) — criar janelas retroativas ou
   conviver com `order_window_id` nulo (legado)?
6. **"Não pedir":** a loja pode deixar uma janela sem preencher (não pedir nada no ciclo)?
   Como o sistema registra o "não pedido"?
7. **Prazo:** a janela tem cutoff para a loja preencher? Fecha automaticamente depois?
8. **Confirmar relação com AJ-0014:** "janela" == o período de cobertura cuja soma de
   quadradinhos = semana?

## Mapa de impacto

| Camada | Opção B (Fase 4a) | Opção A / Fase 4b |
|---|---|---|
| **DB** | `store_orders.status` + `opened_by_profile_id` + índice `UNIQUE` parcial | Nova tabela `order_windows` (+ `order_window_stores`), FK em `store_orders`, RLS, UNIQUE |
| **API** | Endpoint fábrica "abrir pedido(s)"; `createStoreOrder` vira "preencher" | Endpoints abrir/publicar/encerrar janela; loja lista janelas disponíveis |
| **UI loja** | `loja/pedidos/page.tsx`: deixa de "criar"; lista o que a fábrica abriu | Lista de janelas publicadas → preencher |
| **UI gestor-fábrica** | Tela/ação "abrir pedidos" | Tela de gestão de janelas (abrir/publicar/auditar) |
| **Motor** | Pouco impacto (status novo) | Catálogo/janela passam a depender de `order_window` |
| **Docs** | Atualizar [[Regra — Pedido da Loja]] | Reescrever [[Jornada — Pedido da Loja]]; Glossário "janela de pedido"; [[Schema ER (Mermaid)]]; [[Migrations (cronologia)]] |
| **Migração** | Trivial (pedidos atuais = `preenchido`) | Janelas retroativas ou legado com window nulo |
| **Interações** | Fecha bônus AJ-0007 (`UNIQUE`) | Fecha AJ-0014 "soma = semana"; revisar AJ-0011/AJ-0007 |

## Consequências

- Reescreve a jornada mais central do sistema ([[Jornada — Pedido da Loja]]) — exige
  validação com cliente real antes do rollout (o plano já recomenda).
- Fecha [[Dívida Técnica#D03]] e o bônus do AJ-0007 (`UNIQUE` natural).
- AJ-0014 só fica 100% (soma multi-dia = semana) ao chegar na Fase 4b/Opção A.
- Toda nova tela operacional precisa entrar no catálogo de permissões (ver
  [[decisoes/ADR_navegacao_orientada_por_permissoes]]).
- Risco de regressão em produção alto — recomenda-se feature flag / rollout gradual e
  ambiente de teste com dados reais antes do corte.

## Próximos passos

1. Levar este ADR + as 8 perguntas abertas para Daniel + Adriano + Leonora.
2. Registrar as respostas aqui (atualizar para **Status: Aceito** com a opção escolhida).
3. Só então: escrever o plano de implementação detalhado (migrations, API, UIs, migração
   de dados, feature flag) e iniciar a codificação.
