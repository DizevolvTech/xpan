---
title: "13 — Políticas RLS"
projeto: "Xpan / Daniel Augusto v2"
estado: "consolidado pós 20260326224500 + drift 20260505210000"
---

# Políticas RLS por tabela

Todas as tabelas listadas têm `enable row level security`. Roles citados são valores de `public.user_role`. "Mesmo tenant" = `tenant_id = public.current_tenant_id()`.

## Padrões repetidos

1. **`select_authenticated_no_tenant`**: SELECT livre para qualquer authenticated, sem filtro de tenant. Usado apenas em `permission_modules` (catálogo global).
2. **`select_authenticated_tenant`**: SELECT se `tenant_id = current_tenant_id()`. Usado em quase todas as tabelas de catálogo.
3. **`manage_catalog_admin`**: SELECT/INSERT/UPDATE/DELETE só com role ∈ (`administrador`, `gestor-dados`) **e** mesmo tenant. Para todo o catálogo (categories, subcategories, ingredients, products, recipes, schedule_lines etc).
4. **`scope_by_order`**: SELECT/INSERT/UPDATE via `EXISTS (… store_orders … can_access_store(store_id))`. Usado em itens, eventos, releases, ocorrências e execuções de entrega.
5. **`factory_only`**: INSERT/UPDATE/DELETE restritos a (`administrador`, `gestor-fabrica`, `chao-fabrica`). Usado em workflow_order_releases, workflow_production_items, delivery_executions.
6. **`tenant_all_no_role`**: `for all using(tenant_id=current_tenant_id())` sem filtro de role. **Risco**: usado em `production_line_types` e `product_changelog` (vide achados).

## Tabela por tabela

### `tenants`
- `tenants_select_master_only` (SELECT): só `is_master_admin()`. Nada de INSERT/UPDATE/DELETE via API.

### `profiles`
- `profiles_select_self_or_admin` (SELECT): `(select auth.uid()) = auth_user_id` **ou** admin do mesmo tenant. Versão otimizada em `20260326224500:1-13` (envolve `auth.uid()` em subselect para hot path).
- `profiles_update_self_or_admin` (UPDATE): mesma regra.
- `profiles_insert_admin` (INSERT): apenas `is_admin()` — `supabase/migrations/20260309200000_management_write_policies.sql:1-6`.
- `profiles_delete_admin` (DELETE): apenas `is_admin()`.

### `permission_modules`
- `permission_modules_select_authenticated` (SELECT): qualquer authenticated. Não tem policy de escrita — catálogo é seed via migration.

### `user_permissions`
- `user_permissions_select_self_or_admin` (SELECT): próprio profile OU admin do mesmo tenant.
- `user_permissions_insert_admin` / `update_admin` / `delete_admin` (INSERT/UPDATE/DELETE): só admin do tenant. `20260326224500:611-649`.

### `operational_settings`
- `operational_settings_select_authenticated` (SELECT): authenticated do mesmo tenant.
- `operational_settings_insert_catalog_admin` / `update` / `delete` (CRUD): `administrador` ou `gestor-dados` do tenant. `20260326224500:224-270`.

### `stores`
- `stores_select_by_scope` (SELECT): mesmo tenant **e** `can_access_store(id)`. Loja só vê suas; demais roles vêem todas do tenant.
- `stores_insert_manager_scope` / `update` / `delete` (CRUD): `administrador` / `gestor-dados`. `20260326224500:140-186`.

### `profile_store_access`
- `profile_store_access_select_self_or_admin` (SELECT): próprio profile OU admin do tenant.
- `profile_store_access_insert_admin` / `update` / `delete`: só `is_admin()` no mesmo tenant. `20260326224500:188-222`.

### `categories`
- `categories_select_authenticated` (SELECT): authenticated do tenant.
- `categories_insert_manager_scope` / `update` / `delete`: admin/gestor-dados. `20260326224500:44-90`.

### `subcategories`
- Igual a `categories` (vide `20260326224500:92-138`).

### `production_line_types`
- `production_line_types_tenant_scope` (FOR ALL): `tenant_id = current_tenant_id()`. **Sem filtro de role** — qualquer authenticated do tenant CRUD aqui (incluindo `loja` e `chao-fabrica`). `supabase/migrations/20260505210000_xpan_register_drift_tables.sql:32-38`. **Achado de risco** — revisar se loja/chão precisam editar tipos de linha.

### `schedule_lines`
- `schedule_lines_select_authenticated` (SELECT): tenant.
- `schedule_lines_insert_manager_scope` (INSERT): admin/gestor-dados.
- `schedule_lines_update_by_scope` (UPDATE): admin/gestor-dados **+ gestor-fabrica** (auditoria de linha é função da fábrica).
- `schedule_lines_delete_manager_scope` (DELETE): admin/gestor-dados.
- `20260326224500:512-561`.

### `schedule_line_item_snapshots`
- SELECT no tenant; CRUD admin/gestor-dados (4 policies). `20260326224500:563-609`.

### `ingredients`
- SELECT no tenant; CRUD admin/gestor-dados (4 policies). `20260326224500:272-318`.

### `ingredient_components`
- SELECT no tenant; CRUD admin/gestor-dados (4 policies). `20260326224500:320-366`.

### `products`
- SELECT no tenant; CRUD admin/gestor-dados (4 policies). `20260326224500:368-414`.

### `product_recipe_items`
- SELECT no tenant; CRUD admin/gestor-dados (4 policies). `20260326224500:464-510`.

### `product_preparation_steps`
- SELECT no tenant; CRUD admin/gestor-dados (4 policies). `20260326224500:416-462`.

### `product_changelog`
- `product_changelog_tenant_scope` (FOR ALL): só filtra tenant. **Sem filtro de role**. `20260505210000:85-91`. **Achado**: qualquer authenticated do tenant escreve no changelog — risco de poluição/auditoria forjada.

### `store_orders`
- `store_orders_select_by_scope` (SELECT): tenant + `can_access_store(store_id)`.
- `store_orders_insert_store_or_admin` (INSERT):
  - `loja` cria se `created_by_profile_id = current_profile_id()` e `can_access_store(store_id)`; ou
  - role ∈ (`administrador`, `gestor-fabrica`, `gestor-dados`) sem restrição extra.
- `store_orders_update_factory_or_admin` (UPDATE): mesmas regras de insert.
- Sem policy de DELETE — pedidos não se apagam, marcam-se `management_status='cancelado'`. **Regra de negócio escondida via ausência de policy**.

### `store_order_items`
- SELECT: scope via order.
- INSERT: scope via order + filtros de role iguais aos do `store_orders`.
- **Sem policy de UPDATE/DELETE** — itens viram imutáveis após criação. Itens só seguem o lifecycle do parent (cascade on delete do order, que por sua vez nunca é deletado).

### `store_order_events`
- SELECT: scope via order.
- INSERT: scope via order + role ∈ qualquer um (`administrador`, `gestor-fabrica`, `chao-fabrica`, `gestor-dados`, `loja`). Append-only.

### `workflow_order_releases`
- SELECT: scope via order.
- INSERT/UPDATE/DELETE: `administrador`, `gestor-fabrica`, `chao-fabrica`. `20260326224500:651-701`.

### `workflow_production_items`
- SELECT/INSERT/UPDATE/DELETE: `administrador`, `gestor-fabrica`, `chao-fabrica`. **Loja não consegue ler** — front compõe progresso por outras vias. `20260326224500:703-753`.

### `delivery_executions`
- SELECT: scope via order.
- INSERT/UPDATE/DELETE: `administrador`, `gestor-fabrica`, `chao-fabrica`. `20260326224500:755-805`.

### `store_occurrences`
- SELECT: scope via order.
- INSERT:
  - admin/gestor-fabrica livres (scope ok).
  - `loja` só se `opened_by_profile_id = current_profile_id()` e `can_access_store`.
- UPDATE `store_occurrences_update_by_scope`: scope do pedido + role ∈ (`administrador`, `gestor-fabrica`, `loja`). **`chao-fabrica` e `gestor-dados` não fecham ocorrências**. `20260322110000:1224-1259`.
- Sem DELETE.

### `store_occurrence_events`
- SELECT: scope via order/ocorrência.
- INSERT: scope + role ∈ (`administrador`, `gestor-fabrica`, `loja`).

### `business_code_sequences`
- `business_code_sequences_no_direct_access` (FOR ALL, `to public`): `using(false) with check(false)`. **Bloqueio total**. Acesso só via funções definer `next_business_code_number()` / `rebuild_business_code_sequences()`.

### `tenant_support_occurrences` e `tenant_support_occurrence_events`
- SELECT/INSERT/UPDATE somente role `administrador` **dentro do tenant** (`tenant_support_occurrences_*_admin_scope`). `20260324110000_tenant_support_occurrences.sql:110-172`.
- Note que o `administrador-master` **não tem policy explícita** — interação via service-role no backend (não pelo cliente Supabase normal).

---

## Achados RLS críticos

1. **`production_line_types` e `product_changelog`** têm `for all using(tenant_id=…) with check(tenant_id=…)` sem filtro de role: qualquer authenticated do tenant pode mutar. Possível regressão de segurança. Arquivos: `20260505210000_xpan_register_drift_tables.sql:32-38,85-91`.
2. **`list_profile_labels()` cross-tenant** (vide `12-funcoes-triggers.md`): retorna nomes de perfis de **qualquer** tenant.
3. **`business_code_sequences`** é exemplo correto de "tabela trancada + função definer" — replicar esse padrão se criar nova sequência.
4. **Ausência de DELETE policy** em `store_orders`, `store_order_items`, `store_order_events`, `store_occurrences`, `store_occurrence_events`: é regra de negócio (audit trail imutável). Documentar.
5. **Loja só vê suas lojas via `profile_store_access`**: dependência crítica. Se a tabela ACL ficar dessincronizada, a loja não vê seus próprios pedidos. `20260319194500_store_responsible_profile_link.sql:32-36` faz o backfill automático para `responsible`.
6. **`tenants_select_master_only`**: gestor/admin **não** vê a própria tenant na tabela `tenants` — qualquer banner/header com nome da padaria precisa vir de `operational_settings`/`profiles`, não de `tenants`.
7. **`auth.uid()` envolvido em `(select auth.uid())`** em `20260326224500`: melhora plano de execução (substitui chamada por scan único) — política de performance.
