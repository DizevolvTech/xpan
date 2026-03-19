alter table public.stores
  add column if not exists responsible_profile_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_stores_responsible_profile_id
on public.stores (responsible_profile_id);

with matched_profiles as (
  select
    store.id as store_id,
    profile.id as profile_id,
    profile.name,
    row_number() over (
      partition by store.id
      order by
        case when profile.status = 'ativo'::public.record_status then 0 else 1 end,
        profile.created_at asc
    ) as rank_position
  from public.stores as store
  join public.profiles as profile
    on profile.role = 'loja'::public.user_role
   and lower(btrim(profile.name)) = lower(btrim(store.responsible))
  where store.responsible_profile_id is null
)
update public.stores as store
set
  responsible_profile_id = matched.profile_id,
  responsible = matched.name
from matched_profiles as matched
where matched.store_id = store.id
  and matched.rank_position = 1;

insert into public.profile_store_access (profile_id, store_id)
select distinct store.responsible_profile_id, store.id
from public.stores as store
where store.responsible_profile_id is not null
on conflict (profile_id, store_id) do nothing;
