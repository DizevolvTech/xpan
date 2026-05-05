alter table public.operational_settings
  add column if not exists sale_lead_days integer not null default 1;

alter table public.operational_settings
  drop constraint if exists operational_settings_sale_lead_days_check;

alter table public.operational_settings
  add constraint operational_settings_sale_lead_days_check
  check (sale_lead_days >= 0);
