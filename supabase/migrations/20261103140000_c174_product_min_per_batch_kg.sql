-- Cartão #174 (Xpan, 03/11): mínimo por batida informado em QUILOS.
-- O cadastro calcula `min_per_batch` (unidades inteiras, fração descartada) pelo peso por
-- unidade da batida, a mesma conta da capacidade máxima (80 kg -> 210 panetones).
-- null = mínimo informado em unidades (produtos de antes) ou sem mínimo.
alter table public.products
  add column if not exists min_per_batch_kg numeric(12, 3);

alter table public.products
  drop constraint if exists products_min_per_batch_kg_check;

alter table public.products
  add constraint products_min_per_batch_kg_check
  check (min_per_batch_kg is null or min_per_batch_kg > 0);

comment on column public.products.min_per_batch_kg is
  'Mínimo por batida em kg (cartão #174). O cadastro converte em min_per_batch (unidades inteiras). null = sem mínimo em kg.';
