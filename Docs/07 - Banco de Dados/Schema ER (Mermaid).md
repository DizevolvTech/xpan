---
title: "15 — Diagrama ER (Mermaid)"
projeto: "Xpan / Daniel Augusto v2"
---

# Diagrama ER por domínio

Agrupados em 6 sub-diagramas Mermaid para legibilidade. A entidade raiz `tenants` é referenciada por quase tudo via `tenant_id` (mostrada apenas no primeiro diagrama; nos demais subentenda).

---

## (a) Tenancy / Usuários / Permissões

```mermaid
erDiagram
  tenants ||--o{ profiles : "tenant_id (nullable só p/ master)"
  tenants ||--o{ user_permissions : "tenant_id"
  tenants ||--o{ profile_store_access : "tenant_id"
  tenants ||--o{ operational_settings : "tenant_id (1:1 por tenant)"

  profiles ||--o{ user_permissions : "profile_id"
  permission_modules ||--o{ user_permissions : "module_key (FK pelo texto)"
  profiles ||--o{ profile_store_access : "profile_id"

  tenants {
    uuid id PK
    text slug "unique global"
    text name
    record_status status
  }

  profiles {
    uuid id PK
    uuid auth_user_id "FK auth.users (1:1)"
    uuid tenant_id FK "NULL = master"
    user_role role
    record_status status
    text name
    text email
  }

  permission_modules {
    uuid id PK
    text module_key "unique"
    text label
    text route
    permission_group group_key
  }

  user_permissions {
    uuid id PK
    uuid tenant_id FK
    uuid profile_id FK
    text module_key FK
    permission_level access_level
  }

  profile_store_access {
    uuid id PK
    uuid tenant_id FK
    uuid profile_id FK
    uuid store_id FK
  }

  operational_settings {
    uuid id PK
    uuid tenant_id FK "unique"
    time order_cutoff_time
    int expedition_lead_days
    int sale_lead_days
  }
```

---

## (b) Catálogo (Lojas, Categorias, Produtos, Ingredientes, Receitas)

```mermaid
erDiagram
  stores ||--o{ profile_store_access : "store_id"
  profiles ||--o| stores : "responsible_profile_id"

  categories ||--o{ subcategories : "category_id (restrict)"
  production_line_types ||--o{ subcategories : "line_type_id (set null)"
  subcategories ||--o{ products : "subcategory_id (catálogo)"
  subcategories ||--o{ products : "operational_subcategory_id (set null)"

  products ||--o{ product_recipe_items : "product_id"
  ingredients ||--o{ product_recipe_items : "ingredient_source_id (XOR)"
  products ||--o{ product_recipe_items : "product_source_id (XOR)"

  ingredients ||--o{ ingredient_components : "ingredient_id (mãe)"
  ingredients ||--o{ ingredient_components : "ingredient_reference_id (XOR)"
  products ||--o{ ingredient_components : "product_reference_id (XOR)"

  products ||--o{ product_preparation_steps : "product_id"
  products ||--o{ product_changelog : "product_id"

  stores {
    uuid id PK
    text code "unique por tenant"
    text name
    uuid responsible_profile_id FK
    text receive_window
    weekday_code_array ordering_days
    weekday_code_array receiving_days
    weekday_code_array ordering_blocked_days
    weekday_code_array receiving_blocked_days
  }

  categories {
    uuid id PK
    text code "unique por tenant"
    text external_code
    text name
    record_status status
  }

  subcategories {
    uuid id PK
    text code "unique por tenant"
    uuid category_id FK
    line_type type
    uuid line_type_id FK "drift, opcional"
    text operating_hours
    numeric capacity_per_day_kg
  }

  production_line_types {
    uuid id PK
    text name "unique por tenant"
    record_status status
    int sort_order
  }

  ingredients {
    uuid id PK
    text code "unique por tenant"
    text external_code
    text short_name
    ingredient_type type
    unit_code unit
    unit_code purchase_unit
    numeric purchase_to_consumption_factor
    record_status status
  }

  ingredient_components {
    uuid id PK
    uuid ingredient_id FK
    uuid ingredient_reference_id FK
    uuid product_reference_id FK
    text name
    numeric quantity
    unit_code unit
  }

  products {
    uuid id PK
    text code "unique por tenant"
    text external_code
    text short_name
    uuid subcategory_id FK
    uuid operational_subcategory_id FK
    bool available_for_ordering
    int validity_days
    numeric minimum_production_kg
    numeric economic_production_kg
    weekday_code_array production_days
    int sale_lead_days "default 1"
    int expedition_lead_days "default 1"
    break_stage break_stage
    numeric break_percent
    unit_code production_unit
    unit_code sales_unit
    unit_code expedition_unit
    numeric sales_to_kg_factor
    numeric expedition_to_kg_factor
    bool is_mpi_ingredient
    bool can_be_ingredient
  }

  product_recipe_items {
    uuid id PK
    uuid product_id FK
    recipe_source_type source_type
    uuid ingredient_source_id FK
    uuid product_source_id FK
    text label
    numeric quantity
    unit_code unit
  }

  product_preparation_steps {
    uuid id PK
    uuid product_id FK
    production_item_status stage_key "CHECK"
    int sort_order
  }

  product_changelog {
    uuid id PK
    uuid product_id FK
    int version_number "unique c/ product_id"
    text change_description
    uuid changed_by_profile_id FK
    jsonb snapshot_data
  }
```

---

## (c) Cronograma (Schedule Lines)

```mermaid
erDiagram
  subcategories ||--o{ schedule_lines : "subcategory_id (restrict)"
  schedule_lines ||--o{ schedule_lines : "revision_of_id (self FK, set null)"
  profiles ||--o{ schedule_lines : "created_by / audited_by / deactivated_by"
  schedule_lines ||--o{ schedule_line_item_snapshots : "schedule_line_id"
  products ||--o{ schedule_line_item_snapshots : "product_id"

  schedule_lines {
    uuid id PK
    text code "unique por tenant"
    text name
    uuid subcategory_id FK
    schedule_status status "pendente|ativo|inativo"
    uuid revision_of_id FK "self"
    uuid created_by_profile_id FK
    timestamptz audited_at
    uuid audited_by_profile_id FK
    text audit_notes
    timestamptz deactivated_at
    uuid deactivated_by_profile_id FK
  }

  schedule_line_item_snapshots {
    uuid id PK
    uuid schedule_line_id FK
    uuid product_id FK
    numeric minimum_production
    weekday_code_array production_days
    jsonb day_priorities
  }
```

---

## (d) Pedidos

```mermaid
erDiagram
  stores ||--o{ store_orders : "store_id (restrict)"
  profiles ||--o{ store_orders : "created_by / cancelled_by / reopened_by"
  store_orders ||--o{ store_order_items : "order_id (cascade)"
  products ||--o{ store_order_items : "product_id (restrict)"
  store_orders ||--o{ store_order_events : "order_id (cascade)"
  profiles ||--o{ store_order_events : "created_by_profile_id"

  store_orders {
    uuid id PK
    text code "PD-YYYYMM-#### unique por tenant"
    uuid store_id FK
    uuid created_by_profile_id FK
    timestamptz ordered_at
    date base_date
    date delivery_date
    text receive_window_snapshot
    int expedition_lead_days_snapshot
    text note
    text management_status "ativo|cancelado"
    timestamptz cancelled_at
    uuid cancelled_by_profile_id FK
    timestamptz reopened_at
    uuid reopened_by_profile_id FK
  }

  store_order_items {
    uuid id PK
    uuid order_id FK
    uuid product_id FK
    text product_code_snapshot
    text product_name_snapshot
    numeric requested_quantity
    unit_code requested_unit
    numeric sales_to_kg_factor_snapshot
    numeric internal_kg_snapshot
    unit_code expedition_unit_snapshot
    numeric expedition_to_kg_factor_snapshot
    unit_code operational_unit_snapshot
  }

  store_order_events {
    uuid id PK
    uuid order_id FK
    text event_type
    text title
    text description
    jsonb metadata
    uuid created_by_profile_id FK
  }
```

---

## (e) Produção, Expedição, Entrega

```mermaid
erDiagram
  store_orders ||--|| workflow_order_releases : "order_id (unique, cascade)"
  store_orders ||--|| delivery_executions : "order_id (unique, cascade)"
  profiles ||--o{ workflow_order_releases : "released_by_profile_id"
  profiles ||--o{ delivery_executions : "updated_by_profile_id"
  profiles ||--o{ workflow_production_items : "updated_by_profile_id"

  workflow_order_releases {
    uuid id PK
    uuid order_id FK "unique"
    timestamptz released_at
    uuid released_by_profile_id FK
  }

  workflow_production_items {
    uuid id PK
    text production_item_key "unique por tenant"
    production_item_status status
    numeric progress
    uuid updated_by_profile_id FK
  }

  delivery_executions {
    uuid id PK
    uuid order_id FK "unique"
    delivery_execution_status status
    jsonb checklist_state
    timestamptz checklist_completed_at
    uuid updated_by_profile_id FK
  }
```

Note: `workflow_production_items.production_item_key` é uma chave **textual composta** (não FK direta) — serialização de tenant + order_id + product_id + stage gerada na app. Por isso há `unique (tenant_id, production_item_key)`.

---

## (f) Ocorrências (Qualidade + Suporte SaaS)

```mermaid
erDiagram
  store_orders ||--o{ store_occurrences : "order_id (cascade)"
  store_order_items ||--o{ store_occurrences : "order_item_id (set null)"
  products ||--o{ store_occurrences : "product_id (set null)"
  profiles ||--o{ store_occurrences : "opened_by / resolved_by"
  store_occurrences ||--o{ store_occurrence_events : "occurrence_id (cascade)"
  profiles ||--o{ store_occurrence_events : "created_by_profile_id"

  tenants ||--o{ tenant_support_occurrences : "tenant_id (cascade)"
  tenant_support_occurrences ||--o{ tenant_support_occurrence_events : "occurrence_id (cascade)"
  profiles ||--o{ tenant_support_occurrences : "opened_by / assigned_to"
  profiles ||--o{ tenant_support_occurrence_events : "created_by_profile_id"

  store_occurrences {
    uuid id PK
    text code "OC-YYYYMM-####"
    uuid order_id FK
    uuid order_item_id FK
    uuid product_id FK
    text problem_type
    occurrence_quantity_type quantity_type
    numeric quantity
    text quantity_unit_snapshot
    text description
    occurrence_status status
    uuid opened_by_profile_id FK
    uuid resolved_by_profile_id FK
    timestamptz resolved_at
  }

  store_occurrence_events {
    uuid id PK
    uuid occurrence_id FK
    text event_type
    text content
    jsonb metadata
    uuid created_by_profile_id FK
  }

  tenant_support_occurrences {
    uuid id PK
    text code "unique por tenant"
    text title
    tenant_support_occurrence_category category
    tenant_support_occurrence_priority priority
    text description
    tenant_support_occurrence_status status
    uuid opened_by_profile_id FK
    uuid assigned_to_profile_id FK
    timestamptz last_message_at
    timestamptz resolved_at
    timestamptz closed_at
  }

  tenant_support_occurrence_events {
    uuid id PK
    uuid occurrence_id FK
    text event_type
    tenant_support_actor_side author_scope
    text content
    uuid created_by_profile_id FK
  }
```

---

## Tabela de utilitário (não-domínio)

`business_code_sequences` é tabela auxiliar (não tem relacionamentos visíveis no ER pois é manipulada apenas por funções definer):

```mermaid
erDiagram
  tenants ||--o{ business_code_sequences : "tenant_id (cascade)"

  business_code_sequences {
    uuid tenant_id PK
    text prefix PK
    text scope_key PK
    bigint current_value
  }
```

Acesso só via `next_business_code_number()` / `rebuild_business_code_sequences()`. RLS bloqueia tudo para qualquer role.
