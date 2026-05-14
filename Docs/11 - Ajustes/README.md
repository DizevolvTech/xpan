# 11 - Ajustes

> Backlog ativo de ajustes vindos de calls, testes do cliente, ou descobertas durante implementação.
>
> Diferente de [[Dívida Técnica]] (que é estrutural / arquitetural), os Ajustes aqui são **demandas operacionais** com data de entrada e idealmente data de entrega.

## Índice

- [[Backlog de Ajustes]] — lista única consolidada com status (A-fazer / Em andamento / Concluído)
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

## Visão atual (2026-05-14)

- **Origem dominante:** call de 2026-05-13 com Daniel + Adriano.
- **Total aberto:** 22 ajustes (16 do dia, 6 já em testes anteriores que voltaram).
- **Em destaque (estruturais):** modelo fábrica-cria-pedido (AJ-0009), cálculo de cobertura (AJ-0014), MPI gerando OP (AJ-0008).
