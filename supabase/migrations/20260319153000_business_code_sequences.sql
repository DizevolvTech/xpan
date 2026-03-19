create table if not exists public.business_code_sequences (
  prefix text not null,
  scope_key text not null default '',
  current_value bigint not null default 0 check (current_value >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (prefix, scope_key)
);

alter table public.business_code_sequences enable row level security;

drop policy if exists business_code_sequences_no_direct_access on public.business_code_sequences;
create policy business_code_sequences_no_direct_access
on public.business_code_sequences
for all
to public
using (false)
with check (false);

create or replace function public.rebuild_business_code_sequences()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_code_sequences (prefix, scope_key, current_value)
  select
    source.prefix,
    source.scope_key,
    max(source.sequence_value) as current_value
  from (
    select
      split_part(code, '-', 1) as prefix,
      split_part(code, '-', 2) as scope_key,
      split_part(code, '-', 3)::bigint as sequence_value
    from public.store_orders
    where code ~ '^[A-Z]{2}-[0-9]{6}-[0-9]{4,}$'

    union all

    select
      split_part(code, '-', 1) as prefix,
      split_part(code, '-', 2) as scope_key,
      split_part(code, '-', 3)::bigint as sequence_value
    from public.store_occurrences
    where code ~ '^[A-Z]{2}-[0-9]{6}-[0-9]{4,}$'

    union all

    select
      split_part(code, '-', 1) as prefix,
      '' as scope_key,
      split_part(code, '-', 2)::bigint as sequence_value
    from public.store_orders
    where code ~ '^[A-Z]{2}-[0-9]{4,}$'

    union all

    select
      split_part(code, '-', 1) as prefix,
      '' as scope_key,
      split_part(code, '-', 2)::bigint as sequence_value
    from public.store_occurrences
    where code ~ '^[A-Z]{2}-[0-9]{4,}$'
  ) as source
  group by source.prefix, source.scope_key
  on conflict (prefix, scope_key) do update
  set
    current_value = greatest(public.business_code_sequences.current_value, excluded.current_value),
    updated_at = timezone('utc', now());
end;
$$;

create or replace function public.next_business_code_number(
  p_prefix text,
  p_scope_key text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_prefix text;
  normalized_scope_key text;
  next_value bigint;
begin
  normalized_prefix := upper(btrim(coalesce(p_prefix, '')));
  normalized_scope_key := btrim(coalesce(p_scope_key, ''));

  if normalized_prefix = '' then
    raise exception 'Business code prefix is required';
  end if;

  insert into public.business_code_sequences as sequences (prefix, scope_key, current_value)
  values (normalized_prefix, normalized_scope_key, 1)
  on conflict (prefix, scope_key) do update
  set
    current_value = sequences.current_value + 1,
    updated_at = timezone('utc', now())
  returning current_value into next_value;

  return next_value;
end;
$$;

select public.rebuild_business_code_sequences();
