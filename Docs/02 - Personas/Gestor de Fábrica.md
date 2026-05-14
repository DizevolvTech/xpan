# Gestor de Fábrica

> **Slug:** `gestor-fabrica`
> **Escopo:** Planejamento e operação da fábrica
> **Definição:** `src/lib/permission-modules.ts:137-142`

## Descrição

Persona que **planeja e coordena a produção do tenant**: aprova pedidos das lojas, ajusta o cronograma ativo (sublinhas), monitora ordens de produção, expedição e ocorrências.

Auditoria do que o [[Chão de Fábrica]] está fazendo é nativa (visualizar).

## Capacidades

Default: `gerenciar` em todos os módulos `gestor-fabrica` + `visualizar` em todos os módulos `chao-fabrica` (`src/lib/permission-modules.ts:466-469`).

**Grupos permitidos**: `gestor-fabrica` + `chao-fabrica` (`src/lib/permission-modules.ts:488`).

## Rotas

| Rota | Arquivo |
|---|---|
| `/gestor-fabrica` (Visão Geral) | `src/app/gestor-fabrica/page.tsx:31` |
| `/gestor-fabrica/sublinhas-producao` (Auditoria do cronograma) | `src/app/gestor-fabrica/sublinhas-producao/page.tsx:206` |
| `/gestor-fabrica/pedidos` | `src/app/gestor-fabrica/pedidos/page.tsx:46` |
| `/gestor-fabrica/pedidos/[orderId]` | `src/app/gestor-fabrica/pedidos/[orderId]/page.tsx:25` |
| `/gestor-fabrica/ordens-producao` | `src/app/gestor-fabrica/ordens-producao/page.tsx:65` |
| `/gestor-fabrica/ordens-producao/[opId]` | `src/app/gestor-fabrica/ordens-producao/[opId]/page.tsx:32` |
| `/gestor-fabrica/expedicao` | `src/app/gestor-fabrica/expedicao/page.tsx:74` |
| `/gestor-fabrica/expedicao/[expeditionId]` | `src/app/gestor-fabrica/expedicao/[expeditionId]/page.tsx:31` |
| `/gestor-fabrica/ocorrencias` | `src/app/gestor-fabrica/ocorrencias/page.tsx:56` |
| `/gestor-fabrica/perfil` | `src/app/gestor-fabrica/perfil/page.tsx:3` |

Layout: `src/app/gestor-fabrica/layout.tsx`.

## Módulos próprios

| Módulo | Label | Default |
|---|---|---|
| `gestor-fabrica.dashboard` | Visão Geral | `gerenciar` |
| `gestor-fabrica.sublinhas` | Auditoria do cronograma ativo | `gerenciar` |
| `gestor-fabrica.pedidos` | Pedidos | `gerenciar` |
| `gestor-fabrica.ops` | Ordens de Produção | `gerenciar` |
| `gestor-fabrica.expedicao` | Expedição | `gerenciar` |
| `gestor-fabrica.ocorrencias` | Ocorrências | `gerenciar` |

## Cross-persona (`anyOfPermissions`)

APIs aceitam usuários `gestor-fabrica` **ou** `chao-fabrica` em vários casos:

| Endpoint | Permissões aceitas |
|---|---|
| `/api/factory-planning` | `gestor-fabrica.dashboard` OR `chao-fabrica.dashboard` |
| `/api/factory-planning/workflow` | `gestor-fabrica.ops` OR `chao-fabrica.ops` |
| `/api/delivery-executions` | `gestor-fabrica.expedicao` OR `chao-fabrica.expedicao` |
| `/api/store-occurrences` (+ sub-rotas) | `loja.ocorrencias` OR `gestor-fabrica.ocorrencias` |
| `/api/store-orders/aggregated-quantities` | `loja.pedidos` OR `gestor-fabrica.pedidos` |

Lógica em `canAccessAnyPermission` (`src/lib/permission-modules.ts:524-532`).

## Tabelas tocadas

- `store_orders`, `store_order_items`, `store_order_events` (recebe pedidos)
- `schedule_lines`, `schedule_line_item_snapshots` (cronograma ativo)
- `workflow_order_releases`, `workflow_production_items` (libera para chão)
- `delivery_executions` (acompanha expedição)
- `store_occurrences`, `store_occurrence_events` (lado fábrica)

## Pontos de atenção

- **Sublinhas vs Linhas**: sublinhas são auditoria/ajuste fino do cronograma ativo. Diferente de `linhas-producao` do [[Gestor de Dados]].
- **Liberação de ordem** transforma pedidos em OPs concretas — operação crítica. Ver [[Jornada — Cronograma da Semana]].
- **`anyOfPermissions`** significa que muitas mudanças aqui podem afetar `chao-fabrica` simultaneamente. Cuidado em refactor.
- **Não pode editar produtos / lojas** — isso é responsabilidade do [[Gestor de Dados]].

## Jornadas envolvidas

- [[Jornada — Cronograma da Semana]] (ator principal)
- [[Jornada — Pedido da Loja]] (recebe e libera)
- [[Jornada — Produção do Dia]] (audita)
- [[Jornada — Expedição e Entrega]] (audita/aprova)
- [[Jornada — Ocorrências]] (lado fábrica)
