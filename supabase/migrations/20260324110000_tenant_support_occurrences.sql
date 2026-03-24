do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'tenant_support_occurrence_status'
  ) then
    create type public.tenant_support_occurrence_status as enum (
      'aberta',
      'em_analise',
      'aguardando_cliente',
      'resolvida',
      'fechada'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'tenant_support_occurrence_priority'
  ) then
    create type public.tenant_support_occurrence_priority as enum (
      'baixa',
      'media',
      'alta'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'tenant_support_occurrence_category'
  ) then
    create type public.tenant_support_occurrence_category as enum (
      'cadastro',
      'usuarios',
      'acesso',
      'financeiro',
      'operacao',
      'outro'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'tenant_support_actor_side'
  ) then
    create type public.tenant_support_actor_side as enum (
      'cliente',
      'master',
      'sistema'
    );
  end if;
end
$$;

create table if not exists public.tenant_support_occurrences (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  title text not null,
  category public.tenant_support_occurrence_category not null default 'outro',
  priority public.tenant_support_occurrence_priority not null default 'media',
  description text not null,
  status public.tenant_support_occurrence_status not null default 'aberta',
  opened_by_profile_id uuid references public.profiles(id) on delete set null,
  assigned_to_profile_id uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz null,
  closed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tenant_support_occurrence_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  occurrence_id uuid not null references public.tenant_support_occurrences(id) on delete cascade,
  event_type text not null,
  author_scope public.tenant_support_actor_side not null default 'sistema',
  content text not null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_tenant_support_occurrences_tenant_code_unique
on public.tenant_support_occurrences (tenant_id, code);

create index if not exists idx_tenant_support_occurrences_tenant_status
on public.tenant_support_occurrences (tenant_id, status);

create index if not exists idx_tenant_support_occurrences_tenant_updated
on public.tenant_support_occurrences (tenant_id, updated_at desc);

create index if not exists idx_tenant_support_occurrence_events_occurrence
on public.tenant_support_occurrence_events (occurrence_id, created_at desc);

drop trigger if exists set_tenant_support_occurrences_updated_at
on public.tenant_support_occurrences;

create trigger set_tenant_support_occurrences_updated_at
before update on public.tenant_support_occurrences
for each row execute function public.set_updated_at();

alter table public.tenant_support_occurrences enable row level security;
alter table public.tenant_support_occurrence_events enable row level security;

drop policy if exists tenant_support_occurrences_select_admin_scope
on public.tenant_support_occurrences;

create policy tenant_support_occurrences_select_admin_scope
on public.tenant_support_occurrences
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() = 'administrador'::public.user_role
);

drop policy if exists tenant_support_occurrences_insert_admin_scope
on public.tenant_support_occurrences;

create policy tenant_support_occurrences_insert_admin_scope
on public.tenant_support_occurrences
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() = 'administrador'::public.user_role
);

drop policy if exists tenant_support_occurrences_update_admin_scope
on public.tenant_support_occurrences;

create policy tenant_support_occurrences_update_admin_scope
on public.tenant_support_occurrences
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() = 'administrador'::public.user_role
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() = 'administrador'::public.user_role
);

drop policy if exists tenant_support_occurrence_events_select_admin_scope
on public.tenant_support_occurrence_events;

create policy tenant_support_occurrence_events_select_admin_scope
on public.tenant_support_occurrence_events
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() = 'administrador'::public.user_role
);

drop policy if exists tenant_support_occurrence_events_insert_admin_scope
on public.tenant_support_occurrence_events;

create policy tenant_support_occurrence_events_insert_admin_scope
on public.tenant_support_occurrence_events
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() = 'administrador'::public.user_role
);
