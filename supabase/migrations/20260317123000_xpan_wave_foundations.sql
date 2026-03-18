alter table public.stores
  add column if not exists ordering_blocked_days public.weekday_code[] not null default '{}'::public.weekday_code[],
  add column if not exists receiving_blocked_days public.weekday_code[] not null default '{}'::public.weekday_code[];

alter table public.ingredients
  add column if not exists external_code text;

alter table public.products
  add column if not exists external_code text;

alter table public.delivery_executions
  add column if not exists checklist_state jsonb not null default '{}'::jsonb,
  add column if not exists checklist_completed_at timestamptz;

create unique index if not exists idx_ingredients_external_code_unique
on public.ingredients (lower(external_code))
where external_code is not null and btrim(external_code) <> '';

create unique index if not exists idx_products_external_code_unique
on public.products (lower(external_code))
where external_code is not null and btrim(external_code) <> '';
