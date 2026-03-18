alter table public.products
  add column if not exists sale_lead_days integer not null default 0;
