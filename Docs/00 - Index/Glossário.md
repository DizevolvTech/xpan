# Glossário

> Termos do domínio Xpan, ordenados alfabeticamente. Quando um termo aparece em outras páginas, ele sempre vem com `[[Glossário#Termo|Termo]]` ou apenas em itálico.

## Cronograma e Datas

- **D+2** — Dia da entrega: data em que a fábrica entrega para a loja. Ver [[Regra — D+2 e D+3]].
- **D+3** — Dia da venda: data em que o produto é vendido na loja, geralmente um dia depois de D+2. Ver [[Regra — D+2 e D+3]].
- **D+X** — Notação genérica para "X dias após hoje" no cronograma. UI mostra colunas D+1..D+N na tela de pedido.
- **Lead day (sale)** — Dias de antecedência globais para vendas. Persiste em `operational_settings.sale_lead_days`. Ver [[Regra — Lead Days]].
- **Lead day (expedition)** — Dias de antecedência por produto na expedição. Persiste em `products.expedition_lead_days`. Ver [[Regra — Lead Days]].
- **Drift retroativo** — Quando um produto muda de linha/categoria após snapshots já gerados, o sistema reaplica o vínculo histórico via `product_changelog`. Ver [[Regra — Drift Retroativo]].
- **Dia fechado** — Domingo ou feriado da fábrica. D+X "pula" esses dias na contagem. Ver [[Regra — Domingo e Feriados]].
- **Dias de cobertura** — Termo do cliente (Adriano, call 2026-05-13): número de dias que um pedido cobre, dependente do ciclo de produção do produto. **Fórmula implementada (Onda 3, AJ-0014):** `max(1, round(7 / nº de dias de produção do produto na semana))` → 1x/semana = 7, 3x/semana ≈ 2, todo dia = 1. Visualmente: número de quadradinhos verdes na grade de pedido, cada um com a data real (AJ-0016). Limitação: "cardápio sáb-only = 1" não é distinguível de "1x/sem = 7" sem tipo de produto dedicado. Ver [[Backlog de Ajustes#AJ-0014 — Cálculo correto de dias de cobertura (quadradinhos verdes)|AJ-0014]].

## Produção

- **Linha de produção** — Agrupamento de produtos com mesmo fluxo de fábrica. Tabela: `subcategories` (subcategoria de fato é a linha). Ver [[Catálogo de Tabelas]].
- **Sublinha de produção** — Agrupamento mais granular dentro de uma linha. Configurada em `/gestor-fabrica/sublinhas-producao`.
- **Ordem de Produção (OP)** — Lote concreto a ser produzido no dia. Tabela: `workflow_production_items`. Ver [[Jornada — Produção do Dia]].
- **Drop antes do forno** — Quantidade descartada antes da assadeira ir ao forno. Reduz disponibilidade.
- **Drop depois do forno** — Quantidade descartada após assar (queimado, derrubado). Não recupera.
- **Pré-pesagem** — Etapa em `/impressao/pre-pesagem` que imprime ficha de ingredientes em peso.

## Pedidos e Distribuição

- **Pedido da Loja** — Solicitação que a loja faz para a fábrica, por D+X, por produto. Tabela: `store_orders` + `store_order_items`. Ver [[Jornada — Pedido da Loja]].
- **Lote mínimo** — Quantidade mínima por pedido de produto. Pode ter múltiplo (ex: múltiplo de 6). Ver [[Regra — Lote Mínimo e Múltiplos]].
- **Coluna destacada** — No UI do pedido, a coluna D+X "primária" do dia (geralmente D+2). Visualmente realçada.
- **Snapshot** — Congelamento de uma linha de cronograma para auditoria. Tabela: `schedule_line_item_snapshots`. Ver [[Engine — Snapshot]].
- **Liberação de ordem** — Ato do Gestor de Fábrica de transformar pedidos consolidados em OPs. Tabela: `workflow_order_releases`.

## Expedição e Entrega

- **Expedição** — Conferência e separação dos produtos por loja após produção. Ver [[Jornada — Expedição e Entrega]].
- **Entrega** — Transporte físico para a loja, com checklist. Tabela: `delivery_executions`.
- **Ocorrência** — Registro de problema (loja → fábrica ou interno). Tabelas: `store_occurrences`, `tenant_support_occurrences`. Ver [[Jornada — Ocorrências]].

## Plataforma e Permissões

- **Tenant** — Cliente do SaaS (uma rede de padaria). Identificado por `tenant_id`. Ver [[Multi-tenancy]].
- **Persona** — Tipo de usuário. 6 valores em `user_role`. Ver [[Personas — Visão Geral]].
- **Módulo** — Unidade de permissão (27 total). Ver [[Catálogo dos 27 Módulos]].
- **Nível de permissão** — 4 valores: `sem_acesso` (0) → `visualizar` (1) → `operar` (2) → `gerenciar` (3). Ver [[Modelo 4 Níveis × 27 Módulos]].
- **Administrador Master** — Persona SaaS, vê todos os tenants (read-only sobre dados, write apenas em tenancy/clientes). Cookie `da_master_tenant` define qual tenant ele está "olhando".
- **Tenant ativo** — Tenant atualmente carregado na sessão; deriva do usuário ou do cookie no caso do master.
- **RLS** — Row Level Security do Postgres. Isolamento entre tenants é garantido aqui. Ver [[RLS Policies]].
