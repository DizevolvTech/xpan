alter table public.store_orders
  add column if not exists management_status text not null default 'ativo',
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by_profile_id uuid references public.profiles(id) on delete set null;

alter table public.store_orders
  drop constraint if exists store_orders_management_status_check;

alter table public.store_orders
  add constraint store_orders_management_status_check
  check (management_status in ('ativo', 'cancelado'));
