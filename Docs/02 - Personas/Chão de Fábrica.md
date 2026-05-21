# Chão de Fábrica

> **Slug:** `chao-fabrica`
> **Escopo:** Execução diária da operação
> **Definição:** `src/lib/permission-modules.ts:143-148`

## Descrição

Persona de **execução diária**: operadores de produção que iniciam ordens, mudam status (em forno, embalando, concluído), executam a expedição e registram entregas.

> 💡 É a **única persona não-admin cujo nível default é `operar`** (acima de `visualizar`, abaixo de `gerenciar`). Pode mudar estado, mas não pode criar/excluir.

## Capacidades

Default `operar` em todos os módulos do grupo `chao-fabrica` (`src/lib/permission-modules.ts:470-472`).

**Grupos permitidos**: apenas `chao-fabrica` (`src/lib/permission-modules.ts:489`).

## Rotas

| Rota | Arquivo |
|---|---|
| `/chao-fabrica` (Visão Geral) | `src/app/chao-fabrica/page.tsx:15` |
| `/chao-fabrica/ordens-producao` | `src/app/chao-fabrica/ordens-producao/page.tsx:64` |
| `/chao-fabrica/ordens-producao/[opId]` | `src/app/chao-fabrica/ordens-producao/[opId]/page.tsx:32` |
| `/chao-fabrica/expedicao` | `src/app/chao-fabrica/expedicao/page.tsx:73` |
| `/chao-fabrica/expedicao/[expeditionId]` | `src/app/chao-fabrica/expedicao/[expeditionId]/page.tsx:31` |
| `/chao-fabrica/entregas` ⚠️ | `src/app/chao-fabrica/entregas/page.tsx:93` |
| `/chao-fabrica/perfil` | `src/app/chao-fabrica/perfil/page.tsx:3` |

Layout: `src/app/chao-fabrica/layout.tsx`.

> ⚠️ **Bug latente**: `/chao-fabrica/entregas` é o **único módulo do grupo sem `matchSubRoutes`** (`src/lib/permission-modules.ts:341`). Se vier a ter sub-rotas como `/chao-fabrica/entregas/[id]`, o matching de permissão falha. Adicionado tardiamente em `supabase/migrations/20260319183000_permission_module_chao_fabrica_entregas.sql`. Ver [[Dívida Técnica]].

## Módulos próprios

| Módulo | Label | Default |
|---|---|---|
| `chao-fabrica.dashboard` | Visão Geral | `operar` |
| `chao-fabrica.ops` | Ordens de Produção | `operar` |
| `chao-fabrica.expedicao` | Expedição | `operar` |
| `chao-fabrica.entregas` | Entregas | `operar` |

[[Gestor de Fábrica]] tem `visualizar` em todos os 4 por padrão.

## Tabelas tocadas

- `workflow_order_releases`, `workflow_production_items` (executa OPs, registra drop antes/depois forno)
- `delivery_executions` (expedição + entrega)

## APIs

- `/api/factory-planning/workflow` (`anyOfPermissions` com `gestor-fabrica.ops`)
- `/api/delivery-executions` (`anyOfPermissions` com `gestor-fabrica.expedicao`)

## Pontos de atenção

- **`operar` ≠ `gerenciar`**. Operador pode mudar status de OP, mas não cria nem exclui. Para criar OPs, o [[Gestor de Fábrica]] precisa liberar via `workflow_order_releases`.
- **Drop antes/depois do forno** é primitiva nova (2026-05-05) — operador registra em ambos os pontos. Ver [[Regra — Drop antes e depois do forno]].
- **Sem acesso direto ao motor** de cronograma — apenas consome OPs já liberadas.

## Jornadas envolvidas

- [[Jornada — Produção do Dia]] (ator principal)
- [[Jornada — Expedição e Entrega]] (ator principal)
- Indiretamente afetado por [[Jornada — Cronograma da Semana]] (entrada do dia)
