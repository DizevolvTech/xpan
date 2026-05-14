# Loja

> **Slug:** `loja`
> **Escopo:** Loja(s) específica(s) via `storeIds`
> **Definição:** `src/lib/permission-modules.ts:149-154`

## Descrição

Persona da **loja física (varejo)**. Coloca pedidos para a fábrica, acompanha status e abre ocorrências.

> 💡 É a **única persona com escopo por loja**. Um usuário `loja` só vê os pedidos e ocorrências das lojas associadas em `profile_store_access`.

## Capacidades

Default `operar` nos módulos do grupo `loja` (`src/lib/permission-modules.ts:473-475`).

**Grupos permitidos**: apenas `loja` (`src/lib/permission-modules.ts:490`).

## Comportamento especial — escopo por loja

- Definido em `src/lib/admin-users.ts:77-87` (`supportsStoreScope`).
- Aplicado em APIs por `getAllowedStoreIds` (`src/lib/api-auth.ts:111-117`) e `canAccessStore` (`src/lib/api-auth.ts:119-124`).
- Filtragem real em `src/lib/store-access.ts:1-8`.
- Quando o `storeId` do recurso não está nos `storeIds` do usuário → 403 via `buildStoreScopeResponse` (`src/lib/api-auth.ts:126-128`).

> ⚠️ Importante: o escopo é aplicado **apenas para `loja`**. Outras personas (gestor-fabrica, admin) veem todas as lojas do tenant.

## Rotas

| Rota | Arquivo |
|---|---|
| `/loja` (Visão Geral) | `src/app/loja/page.tsx:27` |
| `/loja/pedidos` (Meus Pedidos) | `src/app/loja/pedidos/page.tsx:161` |
| `/loja/pedidos/[orderId]` | `src/app/loja/pedidos/[orderId]/page.tsx:93` |
| `/loja/ocorrencias` | `src/app/loja/ocorrencias/page.tsx:83` |
| `/loja/perfil` | `src/app/loja/perfil/page.tsx:3` |

Layout: `src/app/loja/layout.tsx`.

## Módulos próprios

| Módulo | Label | Default |
|---|---|---|
| `loja.dashboard` | Visão Geral | `operar` |
| `loja.pedidos` | Meus Pedidos | `operar` |
| `loja.ocorrencias` | Ocorrências | `operar` |

## Cross-persona

APIs aceitam `loja` **ou** `gestor-fabrica` em rotas de leitura compartilhada:

- `/api/store-orders/aggregated-quantities` — `loja.pedidos` OR `gestor-fabrica.pedidos`
- `/api/store-occurrences` (+ sub-rotas) — `loja.ocorrencias` OR `gestor-fabrica.ocorrencias`

## Tabelas tocadas

- `store_orders`, `store_order_items`, `store_order_events`
- `store_occurrences`, `store_occurrence_events`

## APIs

- `/api/store-orders` + `[orderId]` + `aggregated-quantities`
- `/api/store-order-catalog`
- `/api/store-occurrences` + sub-rotas

## Pontos de atenção

- **`storeIds` filtra antes da permissão de módulo** — usuário `loja` com módulo `loja.pedidos` em `operar` mas sem `storeIds` configurados não vê nada.
- **Pedido por D+X**: regras de calendário definem quando o pedido pode ser feito. Ver [[Regra — D+2 e D+3]] e [[Regra — Lead Days]].
- **Lote mínimo / múltiplos** validados antes do envio. Ver [[Regra — Lote Mínimo e Múltiplos]].
- **Duplicidade de pedidos** é problema histórico — ver [[Regra — Pedido da Loja]].

## Jornadas envolvidas

- [[Jornada — Pedido da Loja]] (ator principal)
- [[Jornada — Ocorrências]] (ator inicial)
- Indiretamente: recebe resultado de [[Jornada — Expedição e Entrega]]
