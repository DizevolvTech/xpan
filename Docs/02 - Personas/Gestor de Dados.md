# Gestor de Dados

> **Slug:** `gestor-dados`
> **Escopo:** Catálogo do tenant
> **Definição:** `src/lib/permission-modules.ts:131-136`

## Descrição

Persona responsável pelos **dados mestres do tenant**: ingredientes, produtos, categorias, linhas de produção e cadastro de lojas. Sem visibilidade em outras áreas.

## Capacidades

Default `gerenciar` em todos os 6 módulos do grupo `gestor-dados` (`src/lib/permission-modules.ts:463-465`).

**Grupos permitidos**: apenas `gestor-dados` (`src/lib/permission-modules.ts:487`).

## Rotas

| Rota | Arquivo |
|---|---|
| `/gestor-dados` (Visão Geral) | `src/app/gestor-dados/page.tsx:27` |
| `/gestor-dados/ingredientes` | `src/app/gestor-dados/ingredientes/page.tsx:55` |
| `/gestor-dados/produtos` | `src/app/gestor-dados/produtos/page.tsx:31` |
| `/gestor-dados/setores` | `src/app/gestor-dados/setores/page.tsx:52` |
| `/gestor-dados/setores/[sectorId]` | `src/app/gestor-dados/setores/[sectorId]/page.tsx:16` |
| `/gestor-dados/linhas-producao` | `src/app/gestor-dados/linhas-producao/page.tsx:65` |
| `/gestor-dados/linhas-producao/[lineId]` | `src/app/gestor-dados/linhas-producao/[lineId]/page.tsx:64` |
| `/gestor-dados/lojas` | `src/app/gestor-dados/lojas/page.tsx:68` |
| `/gestor-dados/perfil` | `src/app/gestor-dados/perfil/page.tsx:3` |

Layout: `src/app/gestor-dados/layout.tsx`.

## Módulos próprios

| Módulo | Label exibido | Default |
|---|---|---|
| `gestor-dados.dashboard` | Visão Geral | `gerenciar` |
| `gestor-dados.ingredientes` | Ingredientes | `gerenciar` |
| `gestor-dados.produtos` | Produtos | `gerenciar` |
| `gestor-dados.setores` | **Categorias** ⚠️ | `gerenciar` |
| `gestor-dados.linhas` | Linhas de produção | `gerenciar` |
| `gestor-dados.lojas` | Lojas | `gerenciar` |

> ⚠️ Renomeação inacabada: o label é "Categorias" mas o slug e a rota são "setores". Vestígio em `src/lib/permission-modules.ts:255-265`. Ver [[Dívida Técnica]].

## Tabelas tocadas

- `ingredients`, `ingredient_components`
- `products`, `product_recipe_items`, `product_preparation_steps`, `product_changelog`
- `categories`, `subcategories`
- `schedule_lines`, `schedule_line_item_snapshots`, `production_line_types`
- `stores`, `operational_settings`, `profile_store_access`
- `business_code_sequences` (códigos por entidade)

## APIs

- `/api/master-data/ingredients` + `[ingredientId]`
- `/api/master-data/products` + `[productId]` + `clone` + `changelog`
- `/api/master-data/categories`, `subcategories`, `operational-products`
- `/api/master-data/schedules/[scheduleId]`, `line-types`
- `/api/master-data/stores` + `[storeId]` + `store-users` + `operational-settings`

## Pontos de atenção

- **Produtos têm `product_changelog`** — toda mudança vira evento histórico. Importante para [[Regra — Drift Retroativo]].
- **`operational_settings.sale_lead_days`** é configurado aqui (em "Lojas"), e é **global por tenant**. Não confundir com `expedition_lead_days` por produto. Ver [[Regra — Lead Days]].
- **Linhas vs Sublinhas**: `schedule_lines` é da fábrica, definida por `gestor-dados`. Sublinhas são auditadas pelo [[Gestor de Fábrica]] em `/gestor-fabrica/sublinhas-producao`.
- **Lote mínimo e múltiplos** estão em `products` — ver [[Regra — Lote Mínimo e Múltiplos]].

## Jornadas envolvidas

- [[Jornada — Onboarding de Tenant]] (popula catálogo)
- Pré-requisito para [[Jornada — Pedido da Loja]] (produto disponível) e [[Jornada — Cronograma da Semana]] (linhas, lead days)
