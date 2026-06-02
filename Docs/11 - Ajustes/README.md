# 11 - Ajustes

> Backlog ativo de ajustes vindos de calls, testes do cliente, ou descobertas durante implementação.
>
> Diferente de [[Dívida Técnica]] (que é estrutural / arquitetural), os Ajustes aqui são **demandas operacionais** com data de entrada e idealmente data de entrega.

## Índice

- [[Backlog de Ajustes]] — lista única consolidada com status (A-fazer / Em andamento / Concluído)
- [[Runbook A1-A8]] — operação do fluxo automatizado (cron, override, falhas, métricas, rotas) entregue em 2026-05-21
- [[Call 2026-05-13 — Daniel + Adriano + Leonora]] — registro completo da call de validação
- [[Call 2026-05-13 — Plano de Ataque]] — sequência proposta para executar os ajustes

## Convenção

Cada ajuste tem ID `AJ-####` com sequência crescente. O ID nunca é reaproveitado.

| Campo | Valor |
|---|---|
| ID | `AJ-####` |
| Origem | call/Trello/testes/cliente — quem trouxe |
| Data de entrada | `YYYY-MM-DD` |
| Severidade | 🔴 crítico · 🟡 importante · 🟢 polimento |
| Categoria | UX · Bug · Regra · Modelo · Futuro |
| Status | A-fazer · Em-andamento · Concluído · Adiado |
| Área afetada | wikilinks para a página relevante |

## Fluxo recomendado

1. Toda call/teste/bug que gera ação → criar entrada no [[Backlog de Ajustes]].
2. Antes de executar: ler a página da regra/jornada/módulo afetado.
3. Ao executar: atualizar status no backlog **e** registrar no [[10 - Changelog Vivo/2026-05|Changelog do mês]].
4. Ao concluir: marcar `Concluído`, manter no backlog para histórico, adicionar `Concluído em` data.

## Visão atual (2026-05-30)

- **Origem dominante:** call de 2026-05-13 (Daniel + Adriano) + board Trello 26/05 + auditoria interna pós-Ondas 1-3.
- **Concluído em 2026-05-21:** Iniciativa A1-A8 (8 frentes + A6.2 + A8.1) — fluxo Pedido → Entrega auditável fim a fim. Ver [[Runbook A1-A8]] + [[decisoes/ADR_iniciativa_automacao_pedido_entrega]].
- **Concluído em 2026-05-30 (Sprint 23 — PR #1 → develop, 25 commits, 188 testes):** ajustes do board 26/05 + gaps 13/05 — AJ-0024/0025 (motor), AJ-0026/0027/0028 + grade de pedido (loja), AJ-0001 (Kanban acionável), AJ-0003.1/0004.1/0006.1/0008.1, AJ-0023. Ver tabela em [[Backlog de Ajustes#2026-05-30 — Sprint 23 (Trello 26/05 + gaps 13/05) — fechada (PR #1)|Backlog · Sprint 23]].
- **Decidido (não ativar):** **AJ-0009** — modelo "fábrica abre pedido" foi implementado (fundação + UI + migration aplicada), mas fica **parqueado atrás da flag `NEXT_PUBLIC_FACTORY_OPENS_ORDERS` (OFF)**. Decisão de cliente (2026-05-30): a **loja** cria os pedidos (1 por janela). Ver [[decisoes/ADR_modelo_fabrica_abre_pedido]].
- **Aberto / pendente:** AJ-A7.1 / A7.2 / A8.2 (otimizações derivadas, não-bloqueantes), AJ-0019 (limpar banco — Giuseppe), Fase 4b do AJ-0009 (`order_windows`, só se o modelo for redesenhado), AJ-0021/0022 (futuro v12).
