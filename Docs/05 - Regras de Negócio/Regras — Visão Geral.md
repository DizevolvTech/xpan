# Regras de Negócio — Visão Geral

> Catálogo das regras que vivem no código mas afetam decisões operacionais. Cada regra tem página dedicada com `arquivo:linha`, exemplos e pontos de fragilidade.

## Lista

| Regra | Onde dói | Documento |
|---|---|---|
| D+2 / D+3 | Cronograma, Pedido | [[Regra — D+2 e D+3]] |
| Lead Days | Cronograma, Produto, Pedido | [[Regra — Lead Days]] |
| Drift Retroativo | Produto migra de linha | [[Regra — Drift Retroativo]] |
| Lote Mínimo e Múltiplos | Pedido, Produção | [[Regra — Lote Mínimo e Múltiplos]] |
| Disponibilidade de Produto | Pedido | [[Regra — Disponibilidade de Produto]] |
| Domingo e Feriados | Cronograma | [[Regra — Domingo e Feriados]] |
| Drop antes/depois do forno | Produção | [[Regra — Drop antes e depois do forno]] |
| Pedido da Loja (duplicidade, edição, agregação) | Pedido | [[Regra — Pedido da Loja]] |
| Peso da unidade e rendimento da receita (MPI) | Receita, ficha, custo | [[Regra — Peso e Rendimento da Receita]] |

## Lugares onde regras se acumulam

- `src/lib/factory-planning/engine.ts` — motor de cronograma. Quase toda regra de data passa por aqui.
- `src/lib/factory-planning/*.ts` — helpers (`schedule.ts`, `workflow.ts`, `delivery.ts`).
- `src/lib/supabase-data/store-orders.ts` — validações de pedido.
- `supabase/migrations/*.sql` — algumas regras estão em CHECK constraints e defaults.

## Convenção

Cada página de regra contém:

1. **Resumo em 1-2 frases** — para escaneamento rápido.
2. **Onde está no código** — `arquivo:linha`.
3. **Algoritmo / exemplo de cálculo** — caso concreto.
4. **Interações** — com quais outras regras conversa.
5. **Pontos frágeis** — `> ⚠️ Frágil:` ou `> ⚠️ Implícito:`.
6. **Histórico** — quando a regra mudou (link para [[10 - Changelog Vivo/2026-05|Changelog]]).

## Pontos críticos transversais

- **Snapshots em pedidos**: `store_order_items` persiste `product_code_snapshot`, `sales_to_kg_factor_snapshot`, `expedition_unit_snapshot`, etc. Isso **imuniza** o pedido contra mudanças posteriores no produto. Boa prática a defender.
- **`store_orders.expedition_lead_days_snapshot`**: lead day também é snapshotado por pedido — mudanças em `operational_settings` ou em `products.expedition_lead_days` não afetam pedidos antigos.
- **Audit trail imutável**: pedidos não são deletados; cancelamento é `management_status='cancelado'`. Ver [[RLS Policies#store_orders]].
