create table if not exists public.store_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.store_occurrence_events (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.store_occurrences(id) on delete cascade,
  event_type text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_store_order_events_order on public.store_order_events(order_id);
create index if not exists idx_store_occurrence_events_occurrence on public.store_occurrence_events(occurrence_id);

alter table public.store_order_events enable row level security;
alter table public.store_occurrence_events enable row level security;

drop policy if exists store_occurrences_update_by_scope on public.store_occurrences;
drop policy if exists store_occurrences_update_factory_or_admin on public.store_occurrences;
create policy store_occurrences_update_by_scope
on public.store_occurrences
for update
to authenticated
using (
  exists (
    select 1
    from public.store_orders
    where store_orders.id = store_occurrences.order_id
      and public.can_access_store(store_orders.store_id)
  )
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'loja'::public.user_role
  )
)
with check (
  exists (
    select 1
    from public.store_orders
    where store_orders.id = store_occurrences.order_id
      and public.can_access_store(store_orders.store_id)
  )
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'loja'::public.user_role
  )
);

drop policy if exists store_order_events_select_by_scope on public.store_order_events;
create policy store_order_events_select_by_scope
on public.store_order_events
for select
to authenticated
using (
  exists (
    select 1
    from public.store_orders
    where store_orders.id = store_order_events.order_id
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists store_order_events_insert_by_scope on public.store_order_events;
create policy store_order_events_insert_by_scope
on public.store_order_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_orders
    where store_orders.id = store_order_events.order_id
      and public.can_access_store(store_orders.store_id)
  )
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role,
    'gestor-dados'::public.user_role,
    'loja'::public.user_role
  )
);

drop policy if exists store_occurrence_events_select_by_scope on public.store_occurrence_events;
create policy store_occurrence_events_select_by_scope
on public.store_occurrence_events
for select
to authenticated
using (
  exists (
    select 1
    from public.store_occurrences
    join public.store_orders on store_orders.id = store_occurrences.order_id
    where store_occurrences.id = store_occurrence_events.occurrence_id
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists store_occurrence_events_insert_by_scope on public.store_occurrence_events;
create policy store_occurrence_events_insert_by_scope
on public.store_occurrence_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_occurrences
    join public.store_orders on store_orders.id = store_occurrences.order_id
    where store_occurrences.id = store_occurrence_events.occurrence_id
      and public.can_access_store(store_orders.store_id)
  )
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'loja'::public.user_role
  )
);
