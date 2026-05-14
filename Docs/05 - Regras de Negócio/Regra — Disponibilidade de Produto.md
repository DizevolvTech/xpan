# Regra — Disponibilidade de Produto

> Stub. A regra completa está em [[Regra — Lote Mínimo e Múltiplos]] (seção "Disponibilidade").

## Resumo (10 condições)

Um produto está disponível para um pedido se TODAS as condições AND forem verdadeiras (ver `src/lib/factory-planning/engine.ts` para detalhe):

1. `products.active === true`
2. `products.available_for_ordering === true`
3. `products.status === 'ativo'`
4. Produto pertence à categoria/subcategoria correta
5. Dia da semana ∈ `products.production_days`
6. Dia da semana ∈ `stores.ordering_days` para a loja origem
7. Dia da semana NÃO ∈ `stores.ordering_blocked_days`
8. Dia de entrega ∈ `stores.receiving_days`
9. Dia de entrega NÃO ∈ `stores.receiving_blocked_days`
10. Sale lead days ([[Regra — Lead Days]]) e cutoff time (`operational_settings.order_cutoff_time`) atendidos

## Onde está

- `src/lib/factory-planning/engine.ts` — agregação das condições
- `src/lib/supabase-data/store-orders.ts` — validação no ato de criação
- `src/lib/factory-planning/units.ts` — conversões de unidade

## Pontos frágeis

- **`moveToNextAllowedWeekday` fail-open** com `allowedDays=[]` — loop infinito ou comportamento inesperado. Ver `src/lib/factory-planning/engine.ts:131`. Item #5 em [[Dívida Técnica]].
- Combinação de 10 ANDs torna debugging difícil — sem mensagem dizendo qual falhou.

## Mais

Ver:
- [[Regra — Lote Mínimo e Múltiplos]] (completa)
- [[Regra — Domingo e Feriados]] (não há feriados — só dias bloqueados na loja)
- [[Jornada — Pedido da Loja]]
