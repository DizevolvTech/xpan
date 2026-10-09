-- Etapa "operacional" na receita (planilha do cliente, 09/10/2026).
--
-- "Insumos de Processo - Operacionais": contam no custo e no peso por unidade da ficha
-- técnica, mas NÃO entram na massa crua, no limite da masseira nem na quebra ao assar.
-- A regra de cálculo fica no app (production-planning.ts / production-data-utils.ts);
-- aqui só passa a ser aceito o novo valor. Aditivo: nenhuma linha existente muda.

alter table public.product_recipe_items
  drop constraint if exists product_recipe_items_stage_check;

alter table public.product_recipe_items
  add constraint product_recipe_items_stage_check
  check (stage = any (array['esponja', 'massa', 'recheio', 'cobertura', 'operacional', 'acabamento', 'montagem']));
