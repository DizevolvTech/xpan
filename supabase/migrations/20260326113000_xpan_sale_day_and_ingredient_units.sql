alter table public.products
  alter column sale_lead_days set default 1;

update public.products
set sale_lead_days = 1
where coalesce(sale_lead_days, 0) <= 0;

alter table public.ingredients
  add column if not exists purchase_unit public.unit_code,
  add column if not exists purchase_to_consumption_factor numeric(12, 6) not null default 1;

update public.ingredients
set purchase_unit = unit
where purchase_unit is null;
