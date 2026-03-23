insert into public.permission_modules (module_key, label, route, group_key)
values
  (
    'administrador-master.dashboard',
    'Painel SaaS',
    '/administrador-master',
    'administrador-master'::public.permission_group
  ),
  (
    'administrador-master.clientes',
    'Clientes',
    '/administrador-master/clientes',
    'administrador-master'::public.permission_group
  )
on conflict (module_key) do update
set
  label = excluded.label,
  route = excluded.route,
  group_key = excluded.group_key;
