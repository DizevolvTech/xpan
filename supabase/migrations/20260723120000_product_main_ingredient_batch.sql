-- XPAN-8: capacidade por batida derivada do INGREDIENTE PRINCIPAL.
--
-- Hoje `capacity_per_batch` é um número manual e desconectado da capacidade real da
-- masseira/ingrediente principal (ex.: 50 kg de trigo por batida). Estas colunas
-- permitem DERIVAR a capacidade da batida (em unidades de venda) a partir do limite
-- físico do ingrediente principal:
--
--   capacidade = floor(limite_kg * rendimento_un / kg_do_principal_na_receita)
--
-- `products.main_ingredient_limit_kg`: limite físico (kg) do ingrediente principal por
--   batida. Nullable = não definido → capacidade por batida segue manual.
-- `product_recipe_items.is_main`: marca o ingrediente PRINCIPAL da receita (no máximo
--   um por produto, garantido por índice parcial abaixo + na aplicação).

alter table public.products
  add column if not exists main_ingredient_limit_kg numeric;

alter table public.products
  drop constraint if exists products_main_ingredient_limit_kg_check;

alter table public.products
  add constraint products_main_ingredient_limit_kg_check
  check (main_ingredient_limit_kg is null or main_ingredient_limit_kg > 0);

comment on column public.products.main_ingredient_limit_kg is
  'XPAN-8: limite físico (kg) do ingrediente principal por batida (ex.: kg de trigo na masseira). Null = não definido; capacidade por batida segue manual.';

alter table public.product_recipe_items
  add column if not exists is_main boolean not null default false;

comment on column public.product_recipe_items.is_main is
  'XPAN-8: TRUE marca o ingrediente principal da receita. No máximo um por produto (índice parcial product_recipe_items_one_main_per_product). Base para derivar capacidade/rendimento da batida.';

-- Invariante: no máximo um ingrediente principal por produto.
create unique index if not exists product_recipe_items_one_main_per_product
  on public.product_recipe_items (product_id)
  where is_main;
