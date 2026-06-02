-- Coluna economic_batch_unit em products: tipo de unidade do lote econômico.
-- Hoje só existe um número em Kg (economic_production_kg); este campo expressa
-- a unidade física do lote econômico (forma / maceira / pacote / unidade / kg).
-- Nullable: bancos antigos e produtos sem lote econômico definido ficam null.

alter table public.products
  add column if not exists economic_batch_unit text;

alter table public.products
  drop constraint if exists products_economic_batch_unit_check;

alter table public.products
  add constraint products_economic_batch_unit_check
  check (economic_batch_unit is null or economic_batch_unit in ('kg', 'forma', 'maceira', 'pacote', 'unidade'));

comment on column public.products.economic_batch_unit is
  'Unidade do lote econômico: kg | forma | maceira | pacote | unidade. Null = não definido.';
