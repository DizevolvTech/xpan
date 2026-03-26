alter table public.ingredients
  add column if not exists short_name text;

alter table public.products
  add column if not exists short_name text;
