# Banco — Visão Geral

> Supabase / PostgreSQL. Schema `public`. Multi-tenant single-DB com RLS.

## Números

- **28 tabelas** no schema `public`. Ver [[Catálogo de Tabelas]].
- **18 ENUMs** (`record_status`, `user_role`, `permission_level`, etc.). Ver [[ENUMs]].
- **29 migrations** versionadas. Ver [[Migrations (cronologia)]].
- **~50 policies RLS** distintas. Ver [[RLS Policies]].
- **8 funções** no schema `public` (helpers RLS + business codes). Ver [[Funções e Triggers]].

## Domínios

1. **Tenancy / Usuários** — `tenants`, `profiles`, `permission_modules`, `user_permissions`, `profile_store_access` (5 tabelas)
2. **Configuração Operacional** — `operational_settings`, `business_code_sequences` (2)
3. **Catálogo** — `stores`, `categories`, `subcategories`, `production_line_types`, `schedule_lines`, `schedule_line_item_snapshots`, `ingredients`, `ingredient_components`, `products`, `product_recipe_items`, `product_preparation_steps`, `product_changelog` (12)
4. **Pedidos** — `store_orders`, `store_order_items`, `store_order_events` (3)
5. **Produção / Entrega** — `workflow_order_releases`, `workflow_production_items`, `delivery_executions` (3)
6. **Ocorrências** — `store_occurrences`, `store_occurrence_events`, `tenant_support_occurrences`, `tenant_support_occurrence_events` (4)

Ver [[Schema ER (Mermaid)]] para diagramas por domínio.

## Convenções

- **PK**: `id uuid` gerado por `gen_random_uuid()`.
- **`legacy_id`**: chave herdada do mock JSON (suporte a re-importação).
- **`code`** (unique por `tenant_id`): código de negócio legível.
- **`updated_at`**: mantido por trigger `set_updated_at()` na maioria das tabelas (não em todas — ver [[Funções e Triggers#Achados]]).
- **Snapshots em colunas**: pedidos/itens/expedição persistem unidades, fatores e códigos como snapshot — imunidade a mudanças posteriores em produtos/lojas.
- **Append-only**: `store_order_events`, `store_occurrence_events`, `tenant_support_occurrence_events`, `product_changelog` — sem UPDATE/DELETE.

## Achados estruturais (importantes)

1. **`production_line_types` e `product_changelog`** têm RLS sem filtro de role → qualquer authenticated do tenant pode CRUD. Risco. Ver [[Riscos de Segurança#R1.1]].
2. **`list_profile_labels()`** é `security definer` sem filtro de tenant → vazamento cross-tenant de nomes. Ver [[Funções e Triggers]].
3. **`business_code_sequences`** é tabela trancada (`using(false)`); acesso só via funções `definer`. **Padrão de segurança a replicar** em outras sequências.
4. **`break_stage`** carrega valores deprecated impossíveis de dropar (`antes_forno`, `depois_forno`); migration `20260505200000` apenas normaliza dados.
5. **Migration retroativa de drift** (`20260505210000`): tabelas aplicadas direto no DB sem migration; substitui policies legacy que liam `current_setting('app.current_tenant_id')` (não populado no fluxo SaaS) — sem essa fix, queries da API retornavam vazio.
6. **Ausência proposital de DELETE policies** em `store_orders`/itens/eventos/ocorrências = audit trail imutável; cancelamento é via `management_status='cancelado'`.
7. **`updated_at` sem trigger** em `delivery_executions` e `workflow_production_items` — bug latente se o app esquecer de gravar.

## Helpers RLS centrais

- `current_tenant_id()` — pedra angular do isolamento multi-tenant.
- `can_access_store(target)` — única bottleneck de scope de loja. Mudar essa função tem blast radius enorme.
- `is_admin()` / `is_master_admin()` — desambiguação de role.

Ver [[Funções e Triggers]].

## Acesso

- **Via app**: `src/lib/supabase-data/` (cliente SSR `@supabase/ssr`).
- **Via migration**: arquivos versionados em `supabase/migrations/`.
- **Via MCP**: ferramentas `mcp__supabase_daniel_augusto__*` (incluindo `apply_migration`, `execute_sql`, `get_advisors`).

> ⚠️ Atenção: usar `mcp__supabase_daniel_augusto__apply_migration` ou `execute_sql` aplica direto no projeto remoto. Isso aconteceu antes (drift) e gerou a migration retroativa `20260505210000`. **Preferir** sempre versionar via repo.
