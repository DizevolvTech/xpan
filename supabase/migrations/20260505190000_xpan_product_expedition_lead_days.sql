-- Coluna expedition_lead_days em products: gap individual entre dia de produção e dia de entrega.
-- Default 1 (caso paradigma: bolo precisa esfriar 1 dia antes de ir pra loja).
-- Bancos antigos podem já ter a coluna nullable — garantir not null + default + check.

alter table public.products
  add column if not exists expedition_lead_days integer;

update public.products set expedition_lead_days = 1 where expedition_lead_days is null;

alter table public.products alter column expedition_lead_days set default 1;
alter table public.products alter column expedition_lead_days set not null;

alter table public.products
  drop constraint if exists products_expedition_lead_days_check;

alter table public.products
  add constraint products_expedition_lead_days_check
  check (expedition_lead_days >= 0);
