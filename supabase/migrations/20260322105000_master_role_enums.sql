do $$
begin
  if not exists (
    select 1
    from pg_enum
    join pg_type on pg_type.oid = pg_enum.enumtypid
    where pg_type.typname = 'user_role'
      and pg_enum.enumlabel = 'administrador-master'
  ) then
    alter type public.user_role add value 'administrador-master';
  end if;

  if not exists (
    select 1
    from pg_enum
    join pg_type on pg_type.oid = pg_enum.enumtypid
    where pg_type.typname = 'permission_group'
      and pg_enum.enumlabel = 'administrador-master'
  ) then
    alter type public.permission_group add value 'administrador-master';
  end if;
end $$;
