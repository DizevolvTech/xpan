-- Cartão #42 (Xpan, 29/10): mínimo por batida, na unidade de venda do produto.
-- A geração das OPs divide a quantidade em batidas entre este mínimo e a capacidade por
-- batida (máximo), com o menor número de batidas e as maiores primeiro (12 = 8 + 4 com
-- mín. 4 / máx. 9). Vazio = regra anterior (enche até o máximo; a última leva a sobra).
alter table public.products
  add column if not exists min_per_batch numeric(12, 3);

alter table public.products
  drop constraint if exists products_min_per_batch_check;

alter table public.products
  add constraint products_min_per_batch_check
  check (min_per_batch is null or min_per_batch > 0);

comment on column public.products.min_per_batch is
  'Mínimo por batida na unidade de venda (cartão #42). null = sem mínimo.';
