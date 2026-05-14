---
title: "10 — Catálogo de Tabelas (Schema `public`)"
projeto: "Xpan / Daniel Augusto v2"
banco: "Supabase / PostgreSQL"
total_tabelas: 28
---

# Catálogo de Tabelas

Schema `public` consolidado a partir de `supabase/bootstrap.sql` + migrations posteriores.
Todas as tabelas com `tenant_id` são **tenant-scoped**; o isolamento real é feito por RLS via `public.current_tenant_id()`.

Convenções:
- **PK**: `id uuid` gerado por `gen_random_uuid()`
- **`legacy_id`**: chave herdada do mock JSON (suporte a re-importação).
- **`code`** (com unique por `tenant_id`): código de negócio legível.
- **`updated_at`** mantido por trigger `set_updated_at()`.

---

## Domínio 1 — Tenancy / Usuários

### `tenants`
- **Propósito**: cliente SaaS (padaria) raiz. Cria o "envelope" de isolamento.
- **Colunas**: `id`, `legacy_id`, `slug` (único global), `name`, `status`.
- **Relacionamentos**: pai de praticamente todo o schema via `tenant_id`.
- **Triggers**: `set_tenants_updated_at`.
- **RLS**: somente `administrador-master` (`is_master_admin()`) faz SELECT. Não tem policy de INSERT/UPDATE/DELETE — gerenciamento via service-role / migration.
- **Tenant-scoped?** Não — é a tabela raiz.
- Definição: `supabase/migrations/20260322110000_saas_multi_tenant_master.sql:1-9`.

### `profiles`
- **Propósito**: identidade interna da aplicação (1 perfil por usuário Supabase Auth + 1 por master sem auth).
- **Colunas-chave**: `auth_user_id` (FK lógica para `auth.users`), `tenant_id` (nullable só para `administrador-master`), `role user_role`, `status`, `email`, `name`, endereço completo, `avatar_path`, `password_updated_at`.
- **Constraint**: `profiles_tenant_role_check` — `administrador-master` exige `tenant_id IS NULL`; qualquer outro role exige `tenant_id IS NOT NULL`.
- **Relacionamentos**: referenciada por quase tudo (criadores/auditores/responsáveis).
- **Triggers**: `set_profiles_updated_at`.
- **RLS**: SELECT/UPDATE do próprio registro (`auth.uid()=auth_user_id`) ou se `is_admin()` no mesmo tenant. INSERT/DELETE apenas `is_admin()`.
- **Tenant-scoped?** Sim (exceto master).
- `supabase/migrations/20260309130000_initial_schema.sql:77-98` + `20260322110000_saas_multi_tenant_master.sql:23-24,317-331`.

### `permission_modules`
- **Propósito**: catálogo global de módulos (rotas) e a qual grupo de role pertencem.
- **Colunas**: `module_key` (PK semântica única), `label`, `route`, `group_key permission_group`.
- **RLS**: SELECT para qualquer authenticated; sem policies de escrita (seed via migration).
- **Tenant-scoped?** Não — é catálogo global.
- `20260309130000_initial_schema.sql:100-107`.

### `user_permissions`
- **Propósito**: matriz `profile × módulo → access_level`.
- **Colunas**: `tenant_id` (cascade), `profile_id`, `module_key` (FK em `permission_modules.module_key`), `access_level permission_level`.
- **Unique**: `(tenant_id, profile_id, module_key)`.
- **Triggers**: `set_user_permissions_updated_at`.
- **RLS**: SELECT do próprio ou `is_admin()` do tenant. INSERT/UPDATE/DELETE somente admin do mesmo tenant.
- **Tenant-scoped?** Sim.
- `20260309130000_initial_schema.sql:109-117` + multi-tenant master.

### `profile_store_access`
- **Propósito**: ACL de qual usuário `role=loja` pode ver/operar qual loja.
- **Colunas**: `tenant_id`, `profile_id`, `store_id` (todos cascade).
- **Unique**: `(tenant_id, profile_id, store_id)`.
- **RLS**: SELECT do próprio ou admin do tenant; INSERT/UPDATE/DELETE só admin do tenant.
- **Tenant-scoped?** Sim. Usada por `can_access_store()` como tabela de junção.
- `20260309130000_initial_schema.sql:144-150` + `20260326224500_xpan_rls_policy_performance_cleanup.sql:188-222`.

---

## Domínio 2 — Configuração Operacional

### `operational_settings`
- **Propósito**: 1 linha por tenant — horário de corte de pedidos, lead day padrão de expedição, lead day padrão de venda.
- **Colunas**: `tenant_id` (unique), `order_cutoff_time time`, `expedition_lead_days int >=0`, `sale_lead_days int >=0` (default 1).
- **Constraint**: `operational_settings_sale_lead_days_check`.
- **Triggers**: `set_operational_settings_updated_at`.
- **RLS**: SELECT para qualquer authenticated com mesmo tenant; INSERT/UPDATE/DELETE apenas `administrador` e `gestor-dados`.
- **Tenant-scoped?** Sim (unique no tenant).
- `20260309130000_initial_schema.sql:119-125` + `20260505180000_xpan_operational_sale_lead_days.sql`.

### `business_code_sequences`
- **Propósito**: contadores monotônicos para gerar códigos de negócio (ex.: `PD-202605-0001`).
- **Colunas**: `tenant_id`, `prefix`, `scope_key` (ex.: `YYYYMM`), `current_value bigint >=0`. PK composta `(tenant_id, prefix, scope_key)`.
- **RLS**: política `business_code_sequences_no_direct_access` bloqueia **todo** acesso (`using(false) with check(false)`) para qualquer role — incluindo authenticated. Acesso apenas via `next_business_code_number()` que é `SECURITY DEFINER`. **Padrão de segurança importante**.
- **Tenant-scoped?** Sim.
- `20260319153000_business_code_sequences.sql:1-18` + revisão tenant em `20260322110000_saas_multi_tenant_master.sql:86-87,363-417`.

---

## Domínio 3 — Catálogo: Lojas, Categorias, Produtos, Ingredientes

### `stores`
- **Propósito**: ponto-de-venda físico do tenant; consome a produção.
- **Colunas**: `tenant_id`, `code`, `name`, `responsible` (nome), `responsible_profile_id` (FK em profiles), `email`, `phone`, `status`, `receive_window` (text livre, ex.: "06:00-09:00"), `ordering_days weekday_code[]`, `receiving_days weekday_code[]`, `ordering_blocked_days weekday_code[]`, `receiving_blocked_days weekday_code[]`.
- **Unique**: `(tenant_id, code)`.
- **Triggers**: `set_stores_updated_at`.
- **RLS**: SELECT via `can_access_store()` (loja só vê as suas; admin/gestor/chão veem todas do tenant). INSERT/UPDATE/DELETE: `administrador`, `gestor-dados`.
- **Tenant-scoped?** Sim.
- `20260309130000_initial_schema.sql:127-142` + reforço de FK profile em `20260319194500_store_responsible_profile_link.sql`.

### `categories`
- **Propósito**: agrupador de alto nível para produtos (ex.: Salgados, Doces).
- **Colunas**: `tenant_id`, `code`, `external_code` (opcional, vindo de ERP externo), `name`, `responsible`, `status`.
- **Unique**: `(tenant_id, code)`.
- **RLS**: SELECT para authenticated no tenant; CRUD restrito a `administrador` e `gestor-dados`.
- **Tenant-scoped?** Sim.

### `subcategories`
- **Propósito**: subdivisão dentro de categoria; carrega **regras operacionais** (tipo de linha, capacidade kg/dia, horário de funcionamento).
- **Colunas**: `tenant_id`, `code`, `name`, `category_id` (restrict), `type line_type` (`Seco`/`Úmido`), `operating_hours`, `capacity_per_day_kg`, `status`, `line_type_id` (FK opcional em `production_line_types`).
- **Unique**: `(tenant_id, code)`.
- **Triggers**: `set_subcategories_updated_at`.
- **RLS**: SELECT no tenant; CRUD `administrador`/`gestor-dados`.
- **Tenant-scoped?** Sim.
- Linha de produção (`line_type_id`) adicionada em `20260505210000_xpan_register_drift_tables.sql:44-55`.

### `production_line_types`
- **Propósito**: catálogo de tipos de linha de produção do tenant (substitui o enum estático `line_type`).
- **Colunas**: `tenant_id`, `name`, `status`, `sort_order`. Unique `(tenant_id, name)`.
- **RLS**: política única `production_line_types_tenant_scope` (`for all` se `tenant_id = current_tenant_id()`). **NB**: não há filtro de role — qualquer usuário authenticated do tenant pode CRUD nesta tabela. Achado a destacar.
- **Tenant-scoped?** Sim.
- `20260505210000_xpan_register_drift_tables.sql:14-38`.

### `schedule_lines`
- **Propósito**: rodada/lote de cronograma — agrupa quais produtos vão para a linha de produção, com status `pendente`/`ativo`/`inativo` e trilha de auditoria (criou/auditou/desativou).
- **Colunas**: `tenant_id`, `code`, `name`, `subcategory_id` (restrict), `revision_of_id` (self-FK), `status schedule_status`, `created_by_profile_id`, `audited_at`, `audited_by_profile_id`, `audit_notes`, `deactivated_at`, `deactivated_by_profile_id`.
- **Unique**: `(tenant_id, code)`.
- **RLS**: SELECT no tenant; INSERT/DELETE só `administrador`/`gestor-dados`; UPDATE inclui também `gestor-fabrica` (linha de auditoria), `20260326224500:512-549`.
- **Tenant-scoped?** Sim.

### `schedule_line_item_snapshots`
- **Propósito**: snapshot imutável dos produtos congelados numa linha + parâmetros (`minimum_production`, `production_days`, `day_priorities`).
- **Colunas**: `tenant_id`, `schedule_line_id` (cascade), `product_id` (cascade), `minimum_production numeric`, `production_days weekday_code[]`, `day_priorities jsonb` (default `{}`).
- **Unique**: `(schedule_line_id, product_id)`.
- **RLS**: SELECT no tenant; CRUD `administrador`/`gestor-dados`.
- **Tenant-scoped?** Sim.
- `day_priorities` adicionada em `20260327123000_schedule_day_priorities.sql`.

### `ingredients`
- **Propósito**: matéria-prima da fábrica; pode ser `puro` (compra direta) ou `misturado` (sub-receita).
- **Colunas-chave**: `tenant_id`, `code`, `external_code`, `name`, `short_name`, `type ingredient_type`, `unit unit_code` (consumo), `purchase_unit unit_code`, `purchase_to_consumption_factor`, `metadata` (texto livre), `observation`, `status`.
- **Unique**: `(tenant_id, code)` e `(tenant_id, lower(external_code))` parcial.
- **Triggers**: `set_ingredients_updated_at`.
- **RLS**: SELECT no tenant; CRUD `administrador`/`gestor-dados`.
- **Tenant-scoped?** Sim.

### `ingredient_components`
- **Propósito**: receita do `ingrediente misturado` — referencia outro ingrediente OU outro produto, com qty/unidade.
- **Colunas**: `tenant_id`, `ingredient_id` (cascade), `ingredient_reference_id`?, `product_reference_id`?, `name`, `quantity > 0`, `unit unit_code`, `observation`, `sort_order`.
- **Check XOR**: exatamente uma das duas refs deve ser não-nula.
- **RLS**: SELECT no tenant; CRUD `administrador`/`gestor-dados`.
- **Tenant-scoped?** Sim.

### `products`
- **Propósito**: SKU vendável e/ou usado em receita. Carrega regras de produção, expedição e venda.
- **Colunas (resumo)**: `tenant_id`, `code`, `external_code`, `name`, `short_name`, `description`, `subcategory_id` (catálogo), `operational_subcategory_id` (subcategoria operacional, default = subcategoria comercial), `active`, `available_for_ordering`, `validity_days`, `minimum_production_kg`, `economic_production_kg`, `allows_storage`, `production_days weekday_code[]`, **`sale_lead_days int default 1`**, **`expedition_lead_days int default 1 check >=0`** (gap entre produção e entrega — ex.: bolo esfria 1 dia), `unit_profiles jsonb`, `packaging_profile jsonb`, `is_sold_loose`, `preparation_mode`, `break_percent numeric(8,3)`, `break_stage break_stage default 'antes_divisao'`, `break_comment`, `can_be_ingredient`, `ingredient_profile jsonb`, `weight_label`, `production_unit`, `sales_unit`, `sales_to_kg_factor`, `expedition_unit`, `expedition_to_kg_factor`, `is_mpi_ingredient`.
- **Unique**: `(tenant_id, code)` e `(tenant_id, lower(external_code))` parcial.
- **Triggers**: `set_products_updated_at`.
- **RLS**: SELECT no tenant; CRUD `administrador`/`gestor-dados`.
- **Tenant-scoped?** Sim.
- Evolução: `20260317143000_xpan_sale_lead_days.sql` (cria sale_lead_days=0), `20260317170000_product_operational_subcategory.sql`, `20260326113000_xpan_sale_day_and_ingredient_units.sql` (default=1), `20260327000500_product_ingredient_short_name.sql`, `20260505190000_xpan_product_expedition_lead_days.sql`, `20260505200000_xpan_drop_oven_break_stages.sql` (normaliza `break_stage` para `antes_divisao`/`depois_divisao`).

### `product_recipe_items`
- **Propósito**: receita do produto. Cada linha referencia um `ingredient` OU outro `product` (semi-acabado).
- **Colunas**: `tenant_id`, `product_id` (cascade), `source_type recipe_source_type`, `ingredient_source_id`?, `product_source_id`?, `label`, `quantity > 0`, `unit unit_code`, `sort_order`.
- **Check XOR**: alinhamento entre `source_type` e qual coluna está preenchida.
- **Triggers**: `set_product_recipe_items_updated_at`.
- **RLS**: SELECT no tenant; CRUD `administrador`/`gestor-dados`.
- **Tenant-scoped?** Sim.

### `product_preparation_steps`
- **Propósito**: define quais estágios de preparo cada produto percorre (`em_preparacao`, `em_producao`, `em_forno`, `embalando`) e a ordem.
- **Colunas**: `tenant_id`, `product_id` (cascade), `stage_key production_item_status` (restrito a 4 valores via CHECK), `sort_order`.
- **Unique**: `(tenant_id, product_id, stage_key)`.
- **Triggers**: `set_product_preparation_steps_updated_at`.
- **RLS**: SELECT no tenant; CRUD `administrador`/`gestor-dados`.
- **Tenant-scoped?** Sim.
- `20260324143000_product_preparation_steps.sql` — popula automaticamente as 4 etapas para todo produto existente no `INSERT…SELECT cross join`.

### `product_changelog`
- **Propósito**: versionamento textual + snapshot JSONB das alterações em produtos.
- **Colunas**: `tenant_id`, `product_id` (cascade), `version_number` (unique com `product_id`), `change_description`, `changed_by_profile_id`, `changed_by_name`, `snapshot_data jsonb`.
- **RLS**: `product_changelog_tenant_scope` — qualquer authenticated do tenant lê e escreve (sem filtro de role). Achado.
- **Tenant-scoped?** Sim.
- `20260505210000_xpan_register_drift_tables.sql:61-91`.

---

## Domínio 4 — Pedidos (Sales/Order Domain)

### `store_orders`
- **Propósito**: pedido feito pela loja para a fábrica.
- **Colunas**: `tenant_id`, `code` (`PD-YYYYMM-####`), `store_id` (restrict), `created_by_profile_id`, `ordered_at`, `base_date date`, `delivery_date date`, `receive_window_snapshot`, `expedition_lead_days_snapshot int>=0`, `note`, `management_status` (`ativo`|`cancelado`), `cancelled_at`, `cancelled_by_profile_id`, `reopened_at`, `reopened_by_profile_id`.
- **Unique**: `(tenant_id, code)`.
- **Triggers**: `set_store_orders_updated_at`.
- **RLS**: SELECT via `can_access_store(store_id)`; INSERT: loja só cria com `created_by_profile_id=eu` e `can_access_store`; admins criam livremente. UPDATE: idem + `gestor-fabrica`/`gestor-dados`.
- **Tenant-scoped?** Sim.
- Snapshots em colunas = imuneidade a mudanças posteriores em `stores` ou `operational_settings`.

### `store_order_items`
- **Propósito**: itens (produto × quantidade) do pedido, com **snapshots** de unidade, fator de conversão e código.
- **Colunas**: `tenant_id`, `order_id` (cascade), `product_id` (restrict), `product_code_snapshot`, `product_name_snapshot`, `requested_quantity >=0`, `requested_unit`, `sales_to_kg_factor_snapshot`, `internal_kg_snapshot`, `expedition_unit_snapshot`, `expedition_to_kg_factor_snapshot`, `operational_unit_snapshot`.
- **RLS**: SELECT/INSERT via `can_access_store` no parent order (sub-select).
- **Tenant-scoped?** Sim.

### `store_order_events`
- **Propósito**: log de eventos textuais no ciclo de vida do pedido (criação, cancelamento, reabertura, notas).
- **Colunas**: `tenant_id`, `order_id` (cascade), `event_type text`, `title`, `description`, `metadata jsonb`, `created_by_profile_id`, `created_at`.
- **RLS**: SELECT via scope do pedido; INSERT por qualquer role (admin, gestor-fabrica, gestor-dados, chão-fábrica, loja) desde que tenha scope do pedido.
- **Tenant-scoped?** Sim.
- `20260319114500_store_order_occurrence_events.sql:1-10`.

---

## Domínio 5 — Produção / Expedição / Entrega

### `workflow_order_releases`
- **Propósito**: marca quando o pedido foi "liberado" para a fábrica iniciar produção.
- **Colunas**: `tenant_id`, `order_id` (unique, cascade), `released_at`, `released_by_profile_id`.
- **Triggers**: `set_workflow_order_releases_updated_at`.
- **RLS**: SELECT via scope do pedido. INSERT/UPDATE/DELETE: `administrador`, `gestor-fabrica`, `chao-fabrica`.
- **Tenant-scoped?** Sim.

### `workflow_production_items`
- **Propósito**: estado por item-produto-de-produção (chave composta serializada em `production_item_key`); status e progresso.
- **Colunas**: `tenant_id`, `production_item_key text` (chave única por tenant), `status production_item_status default 'nao_iniciado'`, `progress numeric(5,2)`, `updated_by_profile_id`.
- **Unique**: `(tenant_id, production_item_key)`.
- **RLS**: SELECT/CRUD restritos a `administrador`, `gestor-fabrica`, `chao-fabrica`. Loja **não** lê este registro (compõe-se pelo `store_order_items` no front).
- **Tenant-scoped?** Sim.

### `delivery_executions`
- **Propósito**: execução da entrega: status `aguardando_expedicao`→`pronto_coleta`→`em_rota`→`no_destino`→`entregue`/`tentativa_falha` + checklist JSONB.
- **Colunas**: `tenant_id`, `order_id` (unique, cascade), `status delivery_execution_status`, `updated_by_profile_id`, `checklist_state jsonb`, `checklist_completed_at`.
- **RLS**: SELECT via scope do pedido. INSERT/UPDATE/DELETE: `administrador`, `gestor-fabrica`, `chao-fabrica`.
- **Tenant-scoped?** Sim.
- Checklist adicionado em `20260317123000_xpan_wave_foundations.sql:11-13`.

---

## Domínio 6 — Ocorrências (Suporte e Qualidade)

### `store_occurrences`
- **Propósito**: ocorrência de qualidade/quantidade num pedido específico (ex.: produto faltou, veio quebrado).
- **Colunas**: `tenant_id`, `code` (`OC-YYYYMM-####`), `order_id` (cascade), `order_item_id`, `product_id`, `product_name_snapshot`, `problem_type`, `quantity_type occurrence_quantity_type` (`percentual`|`kg`|`operacional`), `quantity > 0`, `quantity_unit_snapshot`, `description`, `status occurrence_status` (`aberta`|`em_analise`|`resolvida`|`fechada`), `opened_by_profile_id`, `resolved_by_profile_id`, `resolved_at`.
- **Unique**: `(tenant_id, code)`.
- **Triggers**: `set_store_occurrences_updated_at`.
- **RLS**: SELECT via scope do pedido. INSERT: loja só se `opened_by=eu` e `can_access_store`; admin/gestor-fabrica livres. UPDATE: scope do pedido + role em (`administrador`,`gestor-fabrica`,`loja`).
- **Tenant-scoped?** Sim.

### `store_occurrence_events`
- **Propósito**: tracking textual/comentários numa ocorrência.
- **Colunas**: `tenant_id`, `occurrence_id` (cascade), `event_type`, `content`, `metadata jsonb`, `created_by_profile_id`.
- **RLS**: SELECT via scope do pedido. INSERT por `administrador`/`gestor-fabrica`/`loja` com scope da ocorrência.
- **Tenant-scoped?** Sim.

### `tenant_support_occurrences`
- **Propósito**: canal de suporte **entre tenant e administrador-master** (ticket B2B).
- **Colunas**: `tenant_id` (cascade), `code` (unique com tenant), `title`, `category tenant_support_occurrence_category`, `priority tenant_support_occurrence_priority`, `description`, `status tenant_support_occurrence_status`, `opened_by_profile_id`, `assigned_to_profile_id`, `last_message_at`, `resolved_at`, `closed_at`.
- **Triggers**: `set_tenant_support_occurrences_updated_at`.
- **RLS**: SELECT/INSERT/UPDATE somente `role=administrador` do tenant.
- **Tenant-scoped?** Sim.
- `20260324110000_tenant_support_occurrences.sql`.

### `tenant_support_occurrence_events`
- **Propósito**: mensagens trocadas no ticket; `author_scope tenant_support_actor_side` indica `cliente`/`master`/`sistema`.
- **Colunas**: `tenant_id`, `occurrence_id` (cascade), `event_type`, `author_scope`, `content`, `created_by_profile_id`.
- **RLS**: SELECT/INSERT somente `role=administrador` do tenant. **Observação importante**: o master não tem policy explícita aqui — interage via service-role na app.
- **Tenant-scoped?** Sim.

---

## Resumo numérico

| Domínio | Tabelas |
|---|---|
| Tenancy / Usuários | 5 (tenants, profiles, permission_modules, user_permissions, profile_store_access) |
| Configuração Operacional | 2 (operational_settings, business_code_sequences) |
| Catálogo | 11 (stores, categories, subcategories, production_line_types, schedule_lines, schedule_line_item_snapshots, ingredients, ingredient_components, products, product_recipe_items, product_preparation_steps, product_changelog → na verdade 12) |
| Pedidos | 3 (store_orders, store_order_items, store_order_events) |
| Produção / Entrega | 3 (workflow_order_releases, workflow_production_items, delivery_executions) |
| Ocorrências | 4 (store_occurrences, store_occurrence_events, tenant_support_occurrences, tenant_support_occurrence_events) |
| **Total** | **28** |
