-- Ajustes da call 24/07/2026, item 3: ETAPA/FUNÇÃO do ingrediente na receita.
--
-- O mesmo ingrediente pode entrar duas vezes no mesmo produto com pesos diferentes
-- (farinha na esponja + farinha complementar na massa; chantilly no recheio + na
-- cobertura). A repetição já funcionava — o que faltava era dizer QUAL A FUNÇÃO de
-- cada linha, para o padeiro pesar POR ETAPA em vez de ver só o total.
--
-- `product_recipe_items.stage`: etapa da linha. O próprio enum define a ORDEM canônica
-- (esponja → massa → recheio → cobertura → acabamento → montagem); NÃO existe coluna de
-- ordem separada — o `sort_order` já existente ordena DENTRO da etapa.
--
-- Default 'massa' para todas as linhas existentes: nada muda nas impressões até alguém
-- preencher as etapas. Enquanto o produto não tiver nenhuma linha fora de 'massa', a
-- folha de produção mantém a heurística legada de "Adic." por palavra-chave e sai
-- idêntica à de hoje.

-- DRIFT: `observation` existe no banco de produção mas NUNCA teve migration no repo (é
-- gravada por replaceProductRecipeItems e lida no mapeamento). Ambiente novo montado só a
-- partir do repo quebrava ao salvar receita. Fechando aqui, junto — `if not exists` torna
-- isso um no-op onde a coluna já existe.
alter table public.product_recipe_items
  add column if not exists observation text not null default '';

alter table public.product_recipe_items
  add column if not exists stage text not null default 'massa';

alter table public.product_recipe_items
  drop constraint if exists product_recipe_items_stage_check;

alter table public.product_recipe_items
  add constraint product_recipe_items_stage_check
  check (stage in ('esponja', 'massa', 'recheio', 'cobertura', 'acabamento', 'montagem'));

comment on column public.product_recipe_items.stage is
  'Etapa/função do ingrediente no produto (esponja, massa, recheio, cobertura, acabamento, montagem). A ordem canônica é a do enum; sort_order ordena dentro da etapa. Default massa preserva o comportamento das receitas legadas.';
