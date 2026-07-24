# Regra — Alteração de Receita (com produto em produção)

> Item 6 do checklist XPAN (2026-07). Trata do impacto de editar a **receita** de um
> produto que já tem pedido/OP em andamento.

## Princípio

Editar a receita de um produto **não** deve desestabilizar o cronograma, orfanar OPs já
liberadas nem travar a liberação de pedidos. A reauditoria do cronograma só é exigida
quando a edição muda a **composição/timing da grade** — não em toda alteração de receita.

## As três partes do item 6 e onde estão resolvidas

1. **Lote em preparação eliminado/restaurado para permitir liberação correta do pedido.**
   Coberto por **AJ-0025** + **XPAN-6.3**. A edição de receita reaproveita a revisão
   pendente existente (id estável — AJ-0025) e, quando muda só receita/dados
   não-cronograma, **não reconstrói** a revisão pendente (XPAN-6.3,
   `master-data-admin.ts` → `updateProduct`). Consequência: a grade/revisão em curso (o
   "lote em preparação") não é invalidada nem desativada, o `planningKey` não muda, o
   cronograma ativo continua ativo e o pedido **segue liberável** após a alteração.
   Antes (AJ-0025), uma revisão nova era criada com id diferente → `planningKey` mudava →
   ativo desativado + OPs órfãs → pedido preso/não-liberável.

2. **Alterações de receita não devem impactar OPs já liberadas.**
   Coberto por **XPAN-6.2/6.3** + `hasCommittedWorkOnScheduleLine`
   (`master-data-admin.ts`). Trabalho comprometido (OPs lançadas, iniciadas ou pedidos
   liberados na linha) preserva o cronograma ativo; edição só de receita nem chega a
   mexer na revisão.

3. **Auditoria de cronograma só quando a alteração afeta o cronograma.**
   Coberto por **XPAN-6.3**: `changeAffectsCronograma(changedFields)`
   (`product-changelog-diff.ts`) — só campos cronograma-relevantes
   (`active`, `available_for_ordering`, `production_days`, `expedition_lead_days`,
   `minimum_production_kg`, `capacity_per_batch`) ou troca de linha executora disparam
   a reauditoria. Mudança de ingredientes/quantidades, nome, descrição, modo de preparo,
   quebra, embalagem ou validade **não** exige reauditoria.

## Campos que disparam reauditoria de cronograma

Ver `SCHEDULE_RELEVANT_FIELDS` em
`src/lib/supabase-data/product-changelog-diff.ts`. Qualquer campo fora dessa lista é
tratado como alteração que **não** afeta o cronograma.
