# Regra — Drop antes/depois do forno

> Stub. Esta regra está documentada dentro de [[Regra — Pedido da Loja]] (seção "Drop antes/depois do forno") e [[ENUMs#break_stage]].

## Resumo

- `products.break_stage` (enum `break_stage`) tem 4 valores: `antes_divisao`, `depois_divisao`, `antes_forno`, `depois_forno`.
- **Migration `20260505200000`** normalizou todas ocorrências de `antes_forno`/`depois_forno` para `depois_divisao` na UI. Os valores **continuam no enum** (Postgres não permite drop sem recriar tipo) — ficam só como histórico inacessível pelo front.
- **`products.break_percent`** define o percentual de perda (ex: 5% queima).

## Onde está

- ENUM: `supabase/migrations/20260309130000_initial_schema.sql` (criação) + `supabase/migrations/20260505200000_xpan_drop_oven_break_stages.sql` (normalização).
- Coluna: `products.break_stage` + `products.break_percent numeric(8,3)`.
- > ⚠️ Atenção: motor de cronograma **ignora `breakPercent`** ao calcular capacidade — capacidade nominal vs produção real divergem. Ver `src/lib/factory-planning/engine.ts:542`. Item #9 em [[Dívida Técnica]].

## Mais

Para o detalhe do fluxo no chão (quando o operador registra), ver:
- [[Jornada — Produção do Dia]]
- [[Regra — Pedido da Loja]] (seção sobre drop)
