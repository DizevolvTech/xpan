create or replace function public.list_profile_labels()
returns table(id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select profiles.id, profiles.name
  from public.profiles
  where profiles.status = 'ativo'::public.record_status
  order by profiles.name asc;
$$;

revoke all on function public.list_profile_labels() from public;
grant execute on function public.list_profile_labels() to authenticated;
