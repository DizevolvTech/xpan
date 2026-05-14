---
title: "11 — ENUMs do schema `public`"
projeto: "Xpan / Daniel Augusto v2"
total_enums: 18
---

# ENUMs

Tipos enumerados criados nas migrations. Listados na ordem em que aparecem.

## Bloco inicial (`20260309130000_initial_schema.sql:5-63`)

### `record_status`
- Valores: `ativo`, `inativo`.
- Onde usado: `tenants.status`, `profiles.status`, `stores.status`, `categories.status`, `subcategories.status`, `ingredients.status`, `production_line_types.status`.

### `schedule_status`
- Valores: `pendente`, `ativo`, `inativo`.
- Onde usado: `schedule_lines.status`. Reflete fluxo de auditoria (criada → auditada → publicada/desativada).

### `ingredient_type`
- Valores: `puro`, `misturado`.
- Onde usado: `ingredients.type`. `misturado` habilita o uso de `ingredient_components`.

### `recipe_source_type`
- Valores: `ingrediente`, `produto`.
- Onde usado: `product_recipe_items.source_type` (XOR garantido por CHECK).

### `break_stage`
- Valores: `antes_divisao`, `depois_divisao`, `antes_forno`, `depois_forno`.
- Onde usado: `products.break_stage` (default `antes_divisao`).
- **NB**: migration `20260505200000_xpan_drop_oven_break_stages.sql` normalizou todas as ocorrências de `antes_forno`/`depois_forno` para `depois_divisao` porque a UI removeu essas opções. Os valores **continuam no enum** (DROP VALUE exige recriar o tipo) — ficam só como histórico inacessível pela UI.

### `weekday_code`
- Valores: `segunda`, `terca`, `quarta`, `quinta`, `sexta`, `sabado`, `domingo`.
- Onde usado em array `weekday_code[]`:
  - `stores.ordering_days`, `stores.receiving_days`, `stores.ordering_blocked_days`, `stores.receiving_blocked_days`.
  - `products.production_days`.
  - `schedule_line_item_snapshots.production_days`.

### `line_type`
- Valores: `Seco`, `Úmido` (com acento, case-sensitive).
- Onde usado: `subcategories.type`. **Status**: enum mantido por compatibilidade, porém a evolução é a tabela `production_line_types` com FK opcional `subcategories.line_type_id` — coexistem (migração drift).

### `user_role`
- Valores originais (`20260309130000`): `administrador`, `gestor-dados`, `gestor-fabrica`, `chao-fabrica`, `loja`.
- Valor extra (`20260322105000_master_role_enums.sql:10`): `administrador-master` (SaaS master, fora do tenant).
- Onde usado: `profiles.role`, helpers RLS (`current_user_role()`).

### `permission_group`
- Mesmos valores que `user_role` (incluindo `administrador-master` adicionado em `20260322105000:20`).
- Onde usado: `permission_modules.group_key`.

### `permission_level`
- Valores: `sem_acesso`, `visualizar`, `operar`, `gerenciar`.
- Onde usado: `user_permissions.access_level` — matriz de granularidade de acesso por módulo.

### `unit_code`
- Valores: `Kg`, `g`, `L`, `ml`, `Un`, `Dz`, `Forma`, `Travessa`, `Pacote`, `Caixa`, `Bandeja`, `Saco`, `Carrinho`, `Assadeira`, `Tela`.
- Onde usado em vários lugares: `ingredients.unit`, `ingredients.purchase_unit`, `ingredient_components.unit`, `products.production_unit`, `products.sales_unit`, `products.expedition_unit`, `product_recipe_items.unit`, `store_order_items.requested_unit`, `store_order_items.expedition_unit_snapshot`, `store_order_items.operational_unit_snapshot`.

### `production_item_status`
- Valores: `nao_iniciado`, `em_preparacao`, `em_producao`, `em_forno`, `embalando`, `concluido`.
- Onde usado: `workflow_production_items.status` (default `nao_iniciado`); `product_preparation_steps.stage_key` (restrito por CHECK aos 4 estágios intermediários — `em_preparacao`/`em_producao`/`em_forno`/`embalando`).

### `delivery_execution_status`
- Valores: `aguardando_expedicao`, `pronto_coleta`, `em_rota`, `no_destino`, `entregue`, `tentativa_falha`.
- Onde usado: `delivery_executions.status` (default `aguardando_expedicao`).

### `occurrence_quantity_type`
- Valores: `percentual`, `kg`, `operacional`.
- Onde usado: `store_occurrences.quantity_type`. Define como interpretar `quantity` + `quantity_unit_snapshot`.

### `occurrence_status`
- Valores: `aberta`, `em_analise`, `resolvida`, `fechada`.
- Onde usado: `store_occurrences.status` (default `aberta`).

## Bloco de suporte ao tenant (`20260324110000_tenant_support_occurrences.sql:1-56`)

### `tenant_support_occurrence_status`
- Valores: `aberta`, `em_analise`, `aguardando_cliente`, `resolvida`, `fechada`.
- Onde usado: `tenant_support_occurrences.status`. Note o estado extra `aguardando_cliente` em relação a `occurrence_status`.

### `tenant_support_occurrence_priority`
- Valores: `baixa`, `media`, `alta`.
- Onde usado: `tenant_support_occurrences.priority` (default `media`).

### `tenant_support_occurrence_category`
- Valores: `cadastro`, `usuarios`, `acesso`, `financeiro`, `operacao`, `outro`.
- Onde usado: `tenant_support_occurrences.category` (default `outro`).

### `tenant_support_actor_side`
- Valores: `cliente`, `master`, `sistema`.
- Onde usado: `tenant_support_occurrence_events.author_scope` (default `sistema`). Indica origem da mensagem no canal entre tenant e administrador-master.

---

## Achados sobre enums

- **Enums com valores deprecated** (não removíveis): `break_stage` tem `antes_forno` e `depois_forno` como histórico — qualquer query nova deve ignorá-los.
- **Duplicação `user_role` vs `permission_group`**: dois enums idênticos vivem em paralelo. Acrescentar role exige `ALTER TYPE` em ambos (vide `20260322105000`).
- **Convivência enum + tabela**: `line_type` (enum) ainda é NOT NULL em `subcategories.type`, e em paralelo existe `subcategories.line_type_id` apontando para `production_line_types`. Migração drift incompleta — front pode estar usando ambos.
- **Acentuação**: `line_type` tem valor `'Úmido'` com acento, case-sensitive. Cuidado ao serializar.
