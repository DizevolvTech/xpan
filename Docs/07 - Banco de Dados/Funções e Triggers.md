---
title: "12 — Funções e Triggers"
projeto: "Xpan / Daniel Augusto v2"
---

# Funções e Triggers

## Funções de manutenção

### `public.set_updated_at()`
- **Origem**: `supabase/migrations/20260309130000_initial_schema.sql:66-75`.
- **Tipo**: trigger function `language plpgsql` com `set search_path = public`.
- **Comportamento**: setta `new.updated_at = timezone('utc', now())` no `BEFORE UPDATE`. Garante timestamps em UTC mesmo se o cliente esquecer.
- **Aplicada em (triggers `set_<tabela>_updated_at`)**:
  - `profiles`, `user_permissions`, `operational_settings`, `tenants`, `stores`, `categories`, `subcategories`, `production_line_types`, `ingredients`, `products`, `ingredient_components`, `product_recipe_items`, `product_preparation_steps`, `store_orders`, `store_order_items`, `workflow_order_releases`, `store_occurrences`, `tenant_support_occurrences`.
- **NB**: `permission_modules`, `business_code_sequences`, `schedule_line_item_snapshots`, `workflow_production_items`, `delivery_executions`, `store_order_events`, `store_occurrence_events`, `product_changelog`, `tenant_support_occurrence_events` **não** têm trigger de updated_at — algumas porque são append-only (eventos/changelog), outras porque o updated_at é atualizado manualmente em `delivery_executions`/`workflow_production_items` (timestamp ainda existe, mas sem trigger — atenção: pode ficar desatualizado se o code esquecer de gravar).

## Helpers RLS

Todos são `language sql stable security definer set search_path = public` e estão grantadas para `authenticated`. Sem `security definer` perderiam acesso para validar o próprio profile.

### `public.current_profile_id() → uuid`
- Retorna `profiles.id` do usuário authenticated atual (filtrando `status='ativo'`).
- Versões: `20260309170000_row_level_security.sql:1-13` e re-criação idempotente em `20260322110000_saas_multi_tenant_master.sql:441-453`.

### `public.current_user_role() → public.user_role`
- Retorna o role do profile ativo.
- Mesmas origens.

### `public.current_user_tenant_id() → uuid` e alias `public.current_tenant_id() → uuid`
- Origem: `20260322110000_saas_multi_tenant_master.sql:469-491`.
- Lê `profiles.tenant_id` do usuário ativo. **`current_tenant_id()` é o helper canônico para todas as policies tenant-scoped**.
- Importante: a migration `20260505210000_xpan_register_drift_tables.sql:1-7` documenta explicitamente que algumas policies aplicadas direto no DB usavam `current_setting('app.current_tenant_id')` (não populado no fluxo SaaS atual) — a migration retroativa substituiu para `current_tenant_id()`.

### `public.is_admin() → boolean`
- `current_user_role() = 'administrador'`. **Não inclui o master**.
- Origem: `20260322110000:503-511`.

### `public.is_master_admin() → boolean`
- `current_user_role() = 'administrador-master'`. Habilita SELECT em `tenants` e operações SaaS-globais.
- Origem: `20260322110000:493-501`.

### `public.can_access_store(target_store_id uuid) → boolean`
- Origem: `20260309170000_row_level_security.sql:39-62` (v1, sem tenant) → reescrita em `20260322110000_saas_multi_tenant_master.sql:513-545` (v2 com tenant).
- Lógica final:
  - `auth.uid() IS NULL` → falso.
  - `current_tenant_id() IS NULL` → falso (master não vê dados de tenant).
  - Se role ∈ `administrador`/`gestor-dados`/`gestor-fabrica`/`chao-fabrica`: vê se a loja for do mesmo tenant.
  - Se role = `loja`: vê apenas as lojas que constem em `profile_store_access` para o profile **e** com tenant batendo dos dois lados (loja + ACL).
  - Caso contrário, falso.
- **Função central de autorização** — qualquer policy de pedidos/itens/eventos/ocorrências/entregas reusa.

### `public.list_profile_labels() → table(id uuid, name text)`
- Origem: `20260309193000_profile_public_labels.sql:1-12`.
- **Security definer** sem filtro de tenant. Lista todos `profiles.status='ativo'`, retornando só `(id, name)`. Grant a `authenticated`, revoke do `public`.
- **Achado**: como roda como definer e não filtra `tenant_id`, qualquer authenticated obtém a lista global de nomes de perfis (incluindo de outros tenants). Pode ser vazamento de PII em cenário multi-tenant. **Avaliar incluir filtro por `current_tenant_id()`**.

## Helpers de código de negócio

### `public.rebuild_business_code_sequences() → void`
- Origem v1 (sem tenant): `20260319153000_business_code_sequences.sql:20-73`.
- Origem v2 (com tenant): `20260322110000_saas_multi_tenant_master.sql:1349-1408`.
- `security definer`. Varre `store_orders.code` e `store_occurrences.code` por dois padrões regex (`^[A-Z]{2}-[0-9]{6}-[0-9]{4,}$` com scope_key e `^[A-Z]{2}-[0-9]{4,}$` sem scope) e popula/atualiza `business_code_sequences` com o max encontrado por `(tenant_id, prefix, scope_key)`. Usado para recuperar contadores em ambientes restaurados de seed.
- Chamada automática no final de ambas as migrations.

### `public.next_business_code_number(p_prefix text, p_scope_key text default '', p_tenant_id uuid default null) → bigint`
- v1: `20260319153000:75-106`. v2: `20260322110000:1410-1448`.
- `security definer`. Normaliza prefix (upper+trim), exige `tenant_id` (usa `current_tenant_id()` se omitido), faz `INSERT … ON CONFLICT DO UPDATE SET current_value = current_value + 1` retornando o novo valor.
- **Por que é definer**: a tabela `business_code_sequences` tem policy `using(false)/with check(false)` para `public` — bloqueio total para qualquer role. Só esta função, rodando como `definer`, consegue mutar a sequência. Padrão de defesa contra escrita direta.

## Triggers

Todos os triggers ativos no banco são `BEFORE UPDATE … FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()` (lista completa na seção acima). **Não há trigger BEFORE INSERT, AFTER UPDATE, nem trigger que toca múltiplas tabelas.** Não há trigger que esconda regra de negócio (ex.: cancelar pedido não dispara nada — depende do código de aplicação manter `store_order_events` consistente).

## Achados não-óbvios

- **Acesso a `business_code_sequences` só via função**: padrão de "vault" que mantém a sequência intocável pela API. Qualquer feature nova precisa criar wrapper SQL function.
- **`list_profile_labels()` é cross-tenant leak**: vide acima.
- **`set_updated_at` não cobre todas as tabelas**: `delivery_executions.updated_at` e `workflow_production_items.updated_at` existem como colunas mas dependem do app gravar — bug latente se o app esquecer.
- **`can_access_store` é o único bottleneck multi-tenant**: garante simultaneamente o filtro de tenant **e** o scope da loja. Qualquer mudança nesta função tem blast radius enorme.
