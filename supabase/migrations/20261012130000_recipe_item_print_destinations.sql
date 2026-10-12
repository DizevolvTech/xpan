-- Destino de impressão por linha da receita (folha de produção, pré-pesagem, separação de
-- embalagens). Aditivo: toda linha existente fica com o par que ela já tinha na prática
-- (folha de produção + pré-pesagem), então nenhuma impressão muda sozinha.
-- Array vazio é válido: a linha só conta no consumo (e no custo, quando existir).
-- O consumo e o peso NÃO leem esta coluna.

alter table public.product_recipe_items
  add column if not exists print_destinations text[] not null default array['producao', 'prepesagem'];

alter table public.product_recipe_items
  drop constraint if exists product_recipe_items_print_destinations_check;

alter table public.product_recipe_items
  add constraint product_recipe_items_print_destinations_check
  check (print_destinations <@ array['producao', 'prepesagem', 'separacao_embalagem']);
