# Catálogo de Módulos (`permissionModules`)

Fonte canônica: `src/lib/permission-modules.ts:171-425` (array `permissionModules`). Tabela `public.permission_modules` em `supabase/migrations/20260309130000_initial_schema.sql`. Cada item tem `id`, `label`, `route`, `group` (a "área dona"), `icon`, `sidebarOrder`, `landingOrder`, `minimumNavLevel` e opcionalmente `matchSubRoutes`.

> ⚠️ verificar: a descrição do usuário menciona **27 módulos**, mas o array declarado em `permission-modules.ts:171-425` contém **24 entradas** (confirmado por contagem com `grep -E "^    id:"`). Possíveis explicações: (a) inclui os 3 `/perfil` por persona não-master, ou (b) números planejados não materializados ainda. Os route groups `(perfil-*)` vazios reforçam a hipótese (b).

Tabelas Supabase principais derivadas de inspeção a `src/lib/supabase-data/*.ts` e migrações em `supabase/migrations/`.

---

## Grupo `administrador-master` (2 módulos)

### `administrador-master.dashboard` — Painel SaaS
- **Slug.** `administrador-master.dashboard`
- **Rota.** `/administrador-master` (`src/app/administrador-master/page.tsx`)
- **Persona dona.** `administrador-master`
- **Acesso default.** `gerenciar` para `administrador-master`. Sem acesso para qualquer outra persona (não está em `roleAllowedGroups` para nenhuma outra) — `src/lib/permission-modules.ts:484-491`.
- **Tabelas Supabase.** `tenants`, `tenant_support_occurrences` (visão geral SaaS).

### `administrador-master.clientes` — Clientes
- **Slug.** `administrador-master.clientes`
- **Rota.** `/administrador-master/clientes` (`matchSubRoutes: true` em `src/lib/permission-modules.ts:191`)
- **Páginas.** `src/app/administrador-master/clientes/page.tsx`, `src/app/administrador-master/clientes/[tenantId]/page.tsx`
- **Persona dona.** `administrador-master`
- **Acesso default.** `gerenciar` para `administrador-master`; sem acesso para demais.
- **Tabelas Supabase.** `tenants`, `tenant_support_occurrences`, `tenant_support_occurrence_events`, `profiles` (para listar usuários do tenant via `api/master/clients/[tenantId]/users/route.ts`).

---

## Grupo `administrador` (3 módulos)

### `administrador.dashboard` — Dashboard Executivo
- **Rota.** `/administrador` (`src/app/administrador/page.tsx`)
- **Persona dona.** `administrador` do tenant
- **Acesso default.** `gerenciar` para `administrador` (módulo não-master é coberto pelo loop em `src/lib/permission-modules.ts:453-458`). Demais personas: `sem_acesso`.

### `administrador.usuarios` — Usuários e Permissões
- **Rota.** `/administrador/usuarios` (`matchSubRoutes: true`)
- **Página.** `src/app/administrador/usuarios/page.tsx`
- **APIs.** `src/app/api/admin/users/route.ts` (linhas 12-15, 41-44), `src/app/api/admin/users/[userId]/route.ts`
- **Persona dona.** `administrador`
- **Acesso default.** `gerenciar` para `administrador`. Demais: `sem_acesso`.
- **Tabelas Supabase.** `profiles`, `user_permissions`, `profile_store_access`.

### `administrador.ocorrencias` — Canal com o Sistema
- **Rota.** `/administrador/ocorrencias` (`matchSubRoutes: true`)
- **Página.** `src/app/administrador/ocorrencias/page.tsx`
- **APIs.** `src/app/api/admin/support-occurrences/route.ts` e sub-rotas.
- **Persona dona.** `administrador` (canal de comunicação com a Xpan).
- **Tabelas Supabase.** `tenant_support_occurrences`, `tenant_support_occurrence_events`.

---

## Grupo `gestor-dados` (6 módulos)

### `gestor-dados.dashboard` — Visão Geral
- **Rota.** `/gestor-dados` (`src/app/gestor-dados/page.tsx`)
- **Persona dona.** `gestor-dados`. Visível também para `administrador` (via `roleAllowedGroups`).

### `gestor-dados.ingredientes` — Ingredientes
- **Rota.** `/gestor-dados/ingredientes` (`src/app/gestor-dados/ingredientes/page.tsx`)
- **APIs.** `src/app/api/master-data/ingredients/route.ts`, `[ingredientId]/route.ts`
- **Persona dona.** `gestor-dados`
- **Tabelas Supabase.** `ingredients`, `ingredient_components`.

### `gestor-dados.produtos` — Produtos
- **Rota.** `/gestor-dados/produtos` (`src/app/gestor-dados/produtos/page.tsx`)
- **APIs.** `src/app/api/master-data/products/route.ts`, `[productId]/route.ts`, `clone/route.ts`, `changelog/route.ts`
- **Persona dona.** `gestor-dados`
- **Tabelas Supabase.** `products`, `product_recipe_items`, `product_preparation_steps`, `product_changelog`.

### `gestor-dados.setores` — Categorias
- **Rota.** `/gestor-dados/setores` (`matchSubRoutes: true`)
- **Páginas.** `src/app/gestor-dados/setores/page.tsx`, `src/app/gestor-dados/setores/[sectorId]/page.tsx`
- **APIs.** `src/app/api/master-data/categories/route.ts`, `subcategories/route.ts`, `operational-products/route.ts`
- **Persona dona.** `gestor-dados`
- **Tabelas Supabase.** `categories`, `subcategories`.

> ⚠️ verificar: o label do módulo é "Categorias" mas o slug e a rota são "setores" — vestígio de renomeação. Linha `src/lib/permission-modules.ts:255-265`.

### `gestor-dados.linhas` — Linhas de produção
- **Rota.** `/gestor-dados/linhas-producao` (`matchSubRoutes: true`)
- **Páginas.** `src/app/gestor-dados/linhas-producao/page.tsx`, `[lineId]/page.tsx`
- **APIs.** `src/app/api/master-data/schedules/[scheduleId]/route.ts`, `line-types/route.ts`
- **Persona dona.** `gestor-dados`
- **Tabelas Supabase.** `schedule_lines`, `schedule_line_item_snapshots`, `production_line_types`.

### `gestor-dados.lojas` — Lojas
- **Rota.** `/gestor-dados/lojas` (`matchSubRoutes: true`)
- **Página.** `src/app/gestor-dados/lojas/page.tsx`
- **APIs.** `src/app/api/master-data/stores/route.ts`, `[storeId]/route.ts`, `store-users/route.ts`, `operational-settings/route.ts`
- **Persona dona.** `gestor-dados`
- **Tabelas Supabase.** `stores`, `operational_settings`, `profile_store_access`.

---

## Grupo `gestor-fabrica` (6 módulos)

### `gestor-fabrica.dashboard` — Visão Geral
- **Rota.** `/gestor-fabrica` (`src/app/gestor-fabrica/page.tsx`)
- **APIs.** `src/app/api/factory-planning/route.ts` (`anyOfPermissions: ["gestor-fabrica.dashboard","chao-fabrica.dashboard"]`).
- **Persona dona.** `gestor-fabrica`.

### `gestor-fabrica.sublinhas` — Auditoria do cronograma ativo
- **Rota.** `/gestor-fabrica/sublinhas-producao` (`src/app/gestor-fabrica/sublinhas-producao/page.tsx`)
- **Persona dona.** `gestor-fabrica`
- **Tabelas Supabase.** `schedule_lines`, `schedule_line_item_snapshots`.

### `gestor-fabrica.pedidos` — Pedidos
- **Rota.** `/gestor-fabrica/pedidos` (`matchSubRoutes: true`)
- **Páginas.** `page.tsx`, `[orderId]/page.tsx`
- **APIs.** `src/app/api/store-orders/route.ts` (com `anyOfPermissions: ["loja.pedidos","gestor-fabrica.pedidos"]` em rotas de leitura agregada).
- **Persona dona.** `gestor-fabrica` (recebe pedidos das lojas).
- **Tabelas Supabase.** `store_orders`, `store_order_items`, `store_order_events`.

### `gestor-fabrica.ops` — Ordens de Produção
- **Rota.** `/gestor-fabrica/ordens-producao` (`matchSubRoutes: true`)
- **Páginas.** `page.tsx`, `[opId]/page.tsx`
- **APIs.** `src/app/api/factory-planning/workflow/route.ts` (`anyOfPermissions: ["gestor-fabrica.ops","chao-fabrica.ops"]`).
- **Persona dona.** `gestor-fabrica` (compartilha leitura/operação com `chao-fabrica.ops`).
- **Tabelas Supabase.** `workflow_order_releases`, `workflow_production_items`.

### `gestor-fabrica.expedicao` — Expedição
- **Rota.** `/gestor-fabrica/expedicao` (`matchSubRoutes: true`)
- **Páginas.** `page.tsx`, `[expeditionId]/page.tsx`
- **APIs.** `src/app/api/delivery-executions/route.ts` (`anyOfPermissions: ["gestor-fabrica.expedicao","chao-fabrica.expedicao"]`).
- **Persona dona.** `gestor-fabrica` (compartilha com `chao-fabrica.expedicao`).
- **Tabelas Supabase.** `delivery_executions`.

### `gestor-fabrica.ocorrencias` — Ocorrências
- **Rota.** `/gestor-fabrica/ocorrencias` (`matchSubRoutes: true`)
- **Página.** `src/app/gestor-fabrica/ocorrencias/page.tsx`
- **APIs.** `src/app/api/store-occurrences/route.ts` (`anyOfPermissions: ["loja.ocorrencias","gestor-fabrica.ocorrencias"]`).
- **Persona dona.** `gestor-fabrica` (lado fábrica do canal de ocorrências da loja).
- **Tabelas Supabase.** `store_occurrences`, `store_occurrence_events`.

---

## Grupo `chao-fabrica` (4 módulos)

### `chao-fabrica.dashboard` — Visão Geral
- **Rota.** `/chao-fabrica` (`src/app/chao-fabrica/page.tsx`)
- **Persona dona.** `chao-fabrica`. Visível para `gestor-fabrica` em modo `visualizar`.

### `chao-fabrica.ops` — Ordens de Produção
- **Rota.** `/chao-fabrica/ordens-producao` (`matchSubRoutes: true`)
- **Páginas.** `page.tsx`, `[opId]/page.tsx`
- **APIs.** `src/app/api/factory-planning/workflow/route.ts`
- **Persona dona.** `chao-fabrica`. Default `operar`.
- **Tabelas Supabase.** `workflow_order_releases`, `workflow_production_items`.

### `chao-fabrica.expedicao` — Expedição
- **Rota.** `/chao-fabrica/expedicao` (`matchSubRoutes: true`)
- **Páginas.** `page.tsx`, `[expeditionId]/page.tsx`
- **APIs.** `src/app/api/delivery-executions/route.ts`
- **Persona dona.** `chao-fabrica`. Default `operar`.
- **Tabelas Supabase.** `delivery_executions`.

### `chao-fabrica.entregas` — Entregas
- **Rota.** `/chao-fabrica/entregas` (NÃO usa `matchSubRoutes` — única no grupo sem o flag)
- **Página.** `src/app/chao-fabrica/entregas/page.tsx`
- **Persona dona.** `chao-fabrica`. Default `operar`.
- **Tabelas Supabase.** `delivery_executions`.
- **Migração de cadastro.** `supabase/migrations/20260319183000_permission_module_chao_fabrica_entregas.sql` adicionou esse módulo na tabela `permission_modules`.

> ⚠️ verificar: `chao-fabrica.entregas` é o único módulo do grupo sem `matchSubRoutes`. Se vier a ter sub-rotas como `/chao-fabrica/entregas/[id]`, o matching falhará.

---

## Grupo `loja` (3 módulos)

### `loja.dashboard` — Visão Geral
- **Rota.** `/loja` (`src/app/loja/page.tsx`)
- **Persona dona.** `loja`. Default `operar`.

### `loja.pedidos` — Meus Pedidos
- **Rota.** `/loja/pedidos` (`matchSubRoutes: true`)
- **Páginas.** `page.tsx`, `[orderId]/page.tsx`
- **APIs.** `src/app/api/store-orders/route.ts`, `[orderId]/route.ts`, `aggregated-quantities/route.ts`, `store-order-catalog/route.ts`
- **Persona dona.** `loja`. Cruzamento com `gestor-fabrica.pedidos` via `anyOfPermissions`.
- **Restrição extra.** Usuário `loja` é filtrado por `storeIds` em `src/lib/api-auth.ts:111-128` + `src/lib/store-access.ts`.
- **Tabelas Supabase.** `store_orders`, `store_order_items`, `store_order_events`.

### `loja.ocorrencias` — Ocorrências
- **Rota.** `/loja/ocorrencias` (NÃO usa `matchSubRoutes`)
- **Página.** `src/app/loja/ocorrencias/page.tsx`
- **APIs.** `src/app/api/store-occurrences/route.ts` e sub-rotas. `anyOfPermissions: ["loja.ocorrencias","gestor-fabrica.ocorrencias"]`.
- **Persona dona.** `loja`. Default `operar`.
- **Tabelas Supabase.** `store_occurrences`, `store_occurrence_events`.

---

## Tabela-resumo de tabelas Supabase principais

| Tabela | Módulos que tocam |
|---|---|
| `tenants` | administrador-master.* |
| `profiles`, `user_permissions`, `profile_store_access` | administrador.usuarios, gestor-dados.lojas |
| `ingredients`, `ingredient_components` | gestor-dados.ingredientes |
| `products`, `product_recipe_items`, `product_preparation_steps`, `product_changelog` | gestor-dados.produtos |
| `categories`, `subcategories` | gestor-dados.setores |
| `schedule_lines`, `schedule_line_item_snapshots`, `production_line_types` | gestor-dados.linhas, gestor-fabrica.sublinhas |
| `stores`, `operational_settings` | gestor-dados.lojas |
| `store_orders`, `store_order_items`, `store_order_events` | loja.pedidos, gestor-fabrica.pedidos |
| `workflow_order_releases`, `workflow_production_items` | gestor-fabrica.ops, chao-fabrica.ops |
| `delivery_executions` | gestor-fabrica.expedicao, chao-fabrica.expedicao, chao-fabrica.entregas |
| `store_occurrences`, `store_occurrence_events` | loja.ocorrencias, gestor-fabrica.ocorrencias |
| `tenant_support_occurrences`, `tenant_support_occurrence_events` | administrador.ocorrencias, administrador-master.clientes |
| `permission_modules` | (metadata; usada pelo cadastro/seed de módulos) |
| `business_code_sequences` | gestor-dados.* (gera códigos `business-code.ts`) |
