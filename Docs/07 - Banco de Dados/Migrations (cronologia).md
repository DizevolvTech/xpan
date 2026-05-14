---
title: "14 — Migrations: cronologia"
projeto: "Xpan / Daniel Augusto v2"
total_migrations: 29
---

# Migrations em ordem cronológica

Tabela compacta: timestamp → arquivo → propósito (1 linha) → tipo de impacto.

| # | Data/timestamp | Arquivo | Propósito | Impacto |
|---|---|---|---|---|
| 1 | 2026-03-09 13:00 | `20260309130000_initial_schema.sql` | Cria 15 enums (`record_status`…`occurrence_status`), helper `set_updated_at`, **20 tabelas iniciais** (profiles, stores, categories…), índices e triggers de updated_at. Cria bucket `profile-avatars`. | **Bootstrap**: 20 novas tabelas + 15 enums + 1 função + 14 triggers |
| 2 | 2026-03-09 17:00 | `20260309170000_row_level_security.sql` | Cria helpers `current_profile_id`, `current_user_role`, `is_admin`, `can_access_store`; habilita RLS em 18 tabelas; ~20 políticas iniciais (SELECT/INSERT/UPDATE). | **RLS-base**: 4 funções + ativação RLS global |
| 3 | 2026-03-09 19:30 | `20260309193000_profile_public_labels.sql` | Função `list_profile_labels()` (definer, grant authenticated). | Função |
| 4 | 2026-03-09 20:00 | `20260309200000_management_write_policies.sql` | Policies INSERT/UPDATE/DELETE para catálogo: `profiles`, `categories`, `subcategories`, `stores`, `ingredients`, `ingredient_components`, `products`, `product_recipe_items`, `schedule_lines`. | RLS (escrita) |
| 5 | 2026-03-17 12:30 | `20260317123000_xpan_wave_foundations.sql` | `stores.ordering_blocked_days`/`receiving_blocked_days`; `ingredients.external_code`, `products.external_code`; `delivery_executions.checklist_state jsonb` + `checklist_completed_at`. Unique index parcial em `external_code`. | Alteração (5 colunas) |
| 6 | 2026-03-17 14:30 | `20260317143000_xpan_sale_lead_days.sql` | `products.sale_lead_days int default 0`. | Alteração (1 coluna) |
| 7 | 2026-03-17 17:00 | `20260317170000_product_operational_subcategory.sql` | `products.operational_subcategory_id` (FK opcional para subcategories); backfill = subcategory_id. | Alteração |
| 8 | 2026-03-18 19:30 | `20260318193000_store_order_management_status.sql` | `store_orders.management_status` (`ativo`/`cancelado`), `cancelled_at`/`cancelled_by_profile_id`, `reopened_at`/`reopened_by_profile_id`. CHECK em valores válidos. | Alteração (5 colunas + check) |
| 9 | 2026-03-19 11:45 | `20260319114500_store_order_occurrence_events.sql` | **Cria** `store_order_events` e `store_occurrence_events`. RLS scoped por order/ocorrência. Reescreve policy de UPDATE em `store_occurrences` para envolver role + scope. | **Novas tabelas** (2) + RLS |
| 10 | 2026-03-19 15:30 | `20260319153000_business_code_sequences.sql` | **Cria** `business_code_sequences` com policy `using(false)`. Funções `rebuild_business_code_sequences()` e `next_business_code_number()` (definer). Executa rebuild. | **Nova tabela + 2 funções** |
| 11 | 2026-03-19 18:30 | `20260319183000_permission_module_chao_fabrica_entregas.sql` | Seed: módulo `chao-fabrica.entregas`. | Seed catálogo |
| 12 | 2026-03-19 19:45 | `20260319194500_store_responsible_profile_link.sql` | `stores.responsible_profile_id` (FK) + index; backfill por nome batendo `profiles.role='loja'`; popula `profile_store_access` para responsáveis. | Alteração + backfill |
| 13 | 2026-03-22 10:50 | `20260322105000_master_role_enums.sql` | Adiciona valor `administrador-master` aos enums `user_role` e `permission_group`. | Enum |
| 14 | 2026-03-22 11:00 | `20260322110000_saas_multi_tenant_master.sql` | **Migration estrutural**: cria `tenants`, adiciona `tenant_id` em ~21 tabelas, backfill cascateado, NOT NULL, unique indexes por tenant, drop dos uniques globais, recria helpers RLS (`current_user_tenant_id`, `current_tenant_id`, `is_master_admin`, reescreve `can_access_store`), reescreve **TODAS** as policies para tenant-scoped, recria `next_business_code_number(…, p_tenant_id)`. | **Multi-tenant rollout** |
| 15 | 2026-03-22 17:35 | `20260322173500_master_permission_modules.sql` | Seed: módulos `administrador-master.dashboard` e `administrador-master.clientes`. | Seed |
| 16 | 2026-03-24 11:00 | `20260324110000_tenant_support_occurrences.sql` | 4 novos enums (`tenant_support_*`); cria `tenant_support_occurrences` e `tenant_support_occurrence_events`; RLS restrita a role=administrador no tenant. | **2 novas tabelas + 4 enums** |
| 17 | 2026-03-24 14:30 | `20260324143000_product_preparation_steps.sql` | Cria `product_preparation_steps` (com CHECK nos 4 stage_keys válidos), popula 4 etapas automaticamente para todo produto, RLS catálogo. | **Nova tabela** |
| 18 | 2026-03-26 11:30 | `20260326113000_xpan_sale_day_and_ingredient_units.sql` | `products.sale_lead_days` default → 1 + backfill `<=0` para 1. `ingredients.purchase_unit`/`purchase_to_consumption_factor` (alter idempotente). Backfill `purchase_unit=unit`. | Default change + backfill |
| 19 | 2026-03-26 21:30 | `20260326213000_xpan_fk_support_indexes.sql` | 12 índices em FKs (ingredient_components, product_preparation_steps, product_recipe_items, schedule_*). | Índices |
| 20 | 2026-03-26 21:50 | `20260326215000_xpan_remaining_fk_indexes.sql` | 19 índices em FKs restantes (profile_store_access, store_occurrences, store_orders, tenant_support_*, workflow_*, user_permissions). | Índices |
| 21 | 2026-03-26 22:45 | `20260326224500_xpan_rls_policy_performance_cleanup.sql` | **Reescreve TODAS as policies** envolvendo `auth.uid()` em `(select auth.uid())` para hot path. Quebra policies `manage_catalog_admin` em INSERT/UPDATE/DELETE separadas. Adiciona DELETE policies onde faltava. | **RLS rewrite (performance + granularidade)** |
| 22 | 2026-03-26 23:20 | `20260326232000_xpan_drop_redundant_unused_indexes.sql` | Drop de 10 índices redundantes em `tenant_id` (cobertos por composite). | Limpeza |
| 23 | 2026-03-26 23:55 | `20260326235500_xpan_drop_non_fk_unused_indexes.sql` | Drop de 2 índices não-FK não usados. | Limpeza |
| 24 | 2026-03-27 00:05 | `20260327000500_product_ingredient_short_name.sql` | `ingredients.short_name` e `products.short_name`. | Alteração |
| 25 | 2026-03-27 12:30 | `20260327123000_schedule_day_priorities.sql` | `schedule_line_item_snapshots.day_priorities jsonb`. | Alteração |
| 26 | **2026-05-05 18:00** | `20260505180000_xpan_operational_sale_lead_days.sql` | `operational_settings.sale_lead_days int default 1 check>=0`. Tenant agora pode definir o sale_lead_days padrão. | Alteração |
| 27 | **2026-05-05 19:00** | `20260505190000_xpan_product_expedition_lead_days.sql` | `products.expedition_lead_days int default 1 not null check>=0`. **Gap entre dia de produção e dia de entrega** (caso paradigma: bolo precisa esfriar 1 dia). | Alteração |
| 28 | **2026-05-05 20:00** | `20260505200000_xpan_drop_oven_break_stages.sql` | Normaliza `products.break_stage` em `(antes_forno, depois_forno)` para `depois_divisao`. Enum mantém valores. | Backfill |
| 29 | **2026-05-05 21:00** | `20260505210000_xpan_register_drift_tables.sql` | **Migration retroativa de drift**: registra `production_line_types`, `product_changelog` (já aplicadas direto no DB), `subcategories.line_type_id` (FK). Substitui policies que usavam `current_setting('app.current_tenant_id')` por `current_tenant_id()`. Cobertura de índices em FKs novas. | **Drift + RLS fix + nova tabela + nova FK** |

## Foco nas migrations recentes (maio 2026)

### `20260505180000` — `operational_settings.sale_lead_days`
- Antes: `sale_lead_days` era atributo só do produto (`products.sale_lead_days`).
- Depois: tenant também tem default global (`operational_settings.sale_lead_days`). UI passa a permitir configurar padrão da operação inteira.

### `20260505190000` — `products.expedition_lead_days`
- Cria o gap **individual por produto** entre produção e entrega.
- Default = 1 (regra de negócio paradigmática: "bolo cozido na quinta vai pra loja na sexta após esfriar 1 dia").
- Constraint: `>= 0`. Idempotente (idem `add column if not exists`, depois `set default`/`set not null` + `drop constraint if exists`).
- Bancos antigos: faz backfill `coalesce → 1`.

### `20260505200000` — Drop antes/depois forno em `break_stage`
- Antes: `break_stage` aceita 4 valores. UI usava todos.
- Decisão de produto: UI passa a oferecer só `antes_divisao`/`depois_divisao`.
- Migration **não modifica o enum** (PostgreSQL não permite drop de valor sem recriar tipo) — só faz UPDATE em produtos existentes, normalizando para `depois_divisao`. Comentário explica.

### `20260505210000` — Registro retroativo do drift (production_line_types, product_changelog, line_type_id)
- **Importante**: a migration é explicitamente retroativa. Tabelas e coluna já estavam no banco — alguém aplicou direto via SQL ou MCP. O time formalizou no repo.
- Substitui policies legacy que liam `current_setting('app.current_tenant_id')` (não populado no fluxo SaaS atual) por `current_tenant_id()`. Sem essa correção, qualquer SELECT/UPDATE pela API daria zero linhas porque o setting estava vazio.
- Adiciona índices nas FKs (`subcategories_line_type_id`, `product_changelog_product/tenant/changed_by`).
- Idempotente.

## Notas sobre numeração

- Quase todas as migrations seguem o formato `YYYYMMDDHHMMSS_descricao.sql` — convencional Supabase. O timestamp **não** corresponde ao mtime do arquivo (vide `ls -la` mostra dates como Mar 9, Mar 17 etc), porque é o nome lógico.
- Há um gap grande entre 27/03 e 05/05 (~5 semanas sem migration) — provavelmente período de iteração apenas no front (commits recentes citam "ajustes ux maio 2026").
